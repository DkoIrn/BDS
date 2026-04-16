import { NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { requireOrgRole } from "@/lib/permissions"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const orgResult = await requireOrgRole(supabase, user.id, "viewer")
  if ("error" in orgResult) {
    return NextResponse.json({ error: orgResult.error }, { status: 403 })
  }

  try {
    const admin = createServiceClient()

    // Get all datasets in the user's org
    const { data: datasets } = await admin
      .from("datasets")
      .select("id, file_name, job_id, jobs(project_id, projects(id, name, org_id))")
      .order("created_at", { ascending: false })

    // Filter to datasets in the user's org
    const orgDatasets = (datasets || []).filter((d: Record<string, unknown>) => {
      const job = d.jobs as Record<string, unknown> | null
      const project = job?.projects as Record<string, unknown> | null
      return project?.org_id === orgResult.orgId
    })

    if (orgDatasets.length === 0) {
      return NextResponse.json({ runs: [] })
    }

    const datasetIds = orgDatasets.map((d: Record<string, unknown>) => d.id as string)
    const datasetMap = new Map(
      orgDatasets.map((d: Record<string, unknown>) => {
        const job = d.jobs as Record<string, unknown> | null
        const project = job?.projects as Record<string, unknown> | null
        return [d.id as string, {
          fileName: d.file_name as string,
          projectName: (project?.name as string) || "Unknown Project",
        }]
      })
    )

    // Fetch validation runs for these datasets
    const { data: runs } = await admin
      .from("validation_runs")
      .select("id, dataset_id, total_issues, critical_count, pass_rate, status, run_at")
      .in("dataset_id", datasetIds)
      .order("run_at", { ascending: false })
      .limit(10)

    const result = (runs || []).map((r: Record<string, unknown>) => {
      const info = datasetMap.get(r.dataset_id as string)
      return {
        id: r.id,
        fileName: info?.fileName || "Unknown",
        projectName: info?.projectName || "Unknown Project",
        totalIssues: r.total_issues,
        criticalCount: r.critical_count,
        passRate: r.pass_rate,
        status: r.status,
        runAt: r.run_at,
      }
    })

    return NextResponse.json({ runs: result })
  } catch (err) {
    console.error("Failed to fetch recent runs:", err)
    return NextResponse.json({ runs: [] })
  }
}
