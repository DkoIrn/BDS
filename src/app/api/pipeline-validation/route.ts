import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { requireOrgRole } from "@/lib/permissions"

interface PipelineValidationRequest {
  datasetId: string
  issues: {
    type: string
    severity: "critical" | "warning" | "info"
    row?: number
    column?: string
    message: string
    detail?: string
    kpValue?: number
  }[]
  totalRows: number
  cleanActionCount: number
}

/**
 * Save pipeline client-side validation results to the database
 * so health scores and the results dashboard can display them.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const orgResult = await requireOrgRole(supabase, user.id, "reviewer")
  if ("error" in orgResult) {
    return NextResponse.json({ error: orgResult.error }, { status: 403 })
  }

  try {
    const body: PipelineValidationRequest = await request.json()
    const { datasetId, issues, totalRows } = body

    // Verify dataset exists and user has access (via RLS)
    const { data: dataset } = await supabase
      .from("datasets")
      .select("id, file_name, job_id, jobs(project_id, projects(id, org_id))")
      .eq("id", datasetId)
      .single()

    if (!dataset) {
      return NextResponse.json({ error: "Dataset not found" }, { status: 404 })
    }

    // Use service role client for writes (validation_runs/issues have no INSERT RLS policy)
    const adminClient = createServiceClient()

    // Count by severity
    const criticalCount = issues.filter((i) => i.severity === "critical").length
    const warningCount = issues.filter((i) => i.severity === "warning").length
    const infoCount = issues.filter((i) => i.severity === "info").length
    const totalIssues = issues.length

    // Compute pass rate: rows without critical issues / total rows
    const criticalRows = new Set(
      issues.filter((i) => i.severity === "critical" && i.row).map((i) => i.row)
    )
    const passRate = totalRows > 0 ? ((totalRows - criticalRows.size) / totalRows) * 100 : 100

    // Completeness: rows without missing data / total rows
    const missingRows = new Set(
      issues.filter((i) => i.type === "missing" && i.row).map((i) => i.row)
    )
    const completenessScore = totalRows > 0 ? ((totalRows - missingRows.size) / totalRows) * 100 : 100

    // Create validation run (service role — bypasses RLS)
    const { data: run, error: runError } = await adminClient
      .from("validation_runs")
      .insert({
        dataset_id: datasetId,
        total_issues: totalIssues,
        critical_count: criticalCount,
        warning_count: warningCount,
        info_count: infoCount,
        pass_rate: passRate,
        completeness_score: completenessScore,
        status: "completed",
      })
      .select("id")
      .single()

    if (runError) {
      return NextResponse.json({ error: runError.message }, { status: 500 })
    }

    // Insert individual issues
    if (issues.length > 0) {
      const issueRows = issues.map((issue) => ({
        run_id: run.id,
        dataset_id: datasetId,
        row_number: issue.row ?? 0,
        column_name: issue.column ?? "unknown",
        rule_type: issue.type,
        severity: issue.severity,
        message: issue.message,
        expected: issue.detail ?? null,
        actual: null,
        kp_value: issue.kpValue ?? null,
      }))

      const { error: issuesError } = await adminClient
        .from("validation_issues")
        .insert(issueRows)

      if (issuesError) {
        console.error("Failed to insert issues:", issuesError.message)
      }
    }

    // Update dataset status to validated
    await adminClient
      .from("datasets")
      .update({ status: "validated" })
      .eq("id", datasetId)

    // Create version snapshot
    try {
      const { data: fullDataset } = await adminClient
        .from("datasets")
        .select("storage_path, file_size, total_rows, column_mappings")
        .eq("id", datasetId)
        .single()

      // Get next version number
      const { data: existingVersions } = await adminClient
        .from("dataset_versions")
        .select("version_number")
        .eq("dataset_id", datasetId)
        .order("version_number", { ascending: false })
        .limit(1)

      const nextVersion = existingVersions && existingVersions.length > 0
        ? existingVersions[0].version_number + 1
        : 1

      const storagePath = fullDataset?.storage_path ?? ""

      const { error: versionError } = await adminClient
        .from("dataset_versions")
        .insert({
          dataset_id: datasetId,
          version_number: nextVersion,
          storage_path: storagePath,
          row_count: fullDataset?.total_rows ?? totalRows,
          column_count: Array.isArray(fullDataset?.column_mappings) ? fullDataset.column_mappings.length : 0,
          file_size: fullDataset?.file_size ?? 0,
          validation_run_id: run.id,
          issue_count: totalIssues,
          severity_breakdown: {
            critical: criticalCount,
            warning: warningCount,
            info: infoCount,
          },
        })

      if (versionError) {
        console.error("Version insert failed:", versionError.message)
      }
    } catch (versionErr) {
      console.error("Failed to create version snapshot:", versionErr)
    }

    // Log activity event
    try {
      const job = dataset.jobs as unknown as Record<string, unknown> | null
      const project = job?.projects as unknown as Record<string, unknown> | null
      const projectId = project?.id as string | undefined
      const orgId = project?.org_id as string | undefined
      const fileName = dataset.file_name as string | undefined

      if (projectId && orgId) {
        const { logActivity } = await import("@/lib/actions/activity")
        await logActivity({
          projectId,
          orgId,
          actorId: user.id,
          eventType: "validation_run",
          summary: totalIssues === 0
            ? `Validation passed for ${fileName || "dataset"}`
            : `Validation found ${totalIssues} issue${totalIssues !== 1 ? "s" : ""} in ${fileName || "dataset"}`,
          resourceType: "dataset",
          resourceId: datasetId,
          metadata: { totalIssues, criticalCount, passRate },
        })
      }
    } catch {
      // Activity logging is non-critical
    }

    return NextResponse.json({ runId: run.id, totalIssues, passRate })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save validation"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
