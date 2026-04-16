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
      .select("id")
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

    return NextResponse.json({ runId: run.id, totalIssues, passRate })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save validation"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
