import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { FileText, BarChart3 } from "lucide-react"
import { ExportButtons } from "@/components/files/export-buttons"

export default async function ReportsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: datasets } = await supabase
    .from("datasets")
    .select("id, file_name, file_size, status, job_id, created_at")
    .eq("user_id", user.id)
    .eq("status", "validated")
    .order("created_at", { ascending: false })

  const reportItems = []
  for (const ds of datasets ?? []) {
    const { data: run } = await supabase
      .from("validation_runs")
      .select("id, run_at, total_issues, pass_rate")
      .eq("dataset_id", ds.id)
      .order("run_at", { ascending: false })
      .limit(1)
      .single()

    const { data: job } = await supabase
      .from("jobs")
      .select("id, name, project_id")
      .eq("id", ds.job_id)
      .single()

    let projectName = ""
    if (job) {
      const { data: project } = await supabase
        .from("projects")
        .select("name")
        .eq("id", job.project_id)
        .single()
      projectName = project?.name ?? ""
    }

    if (run) {
      reportItems.push({
        dataset: ds,
        run,
        jobName: job?.name ?? "",
        projectName,
        projectId: job?.project_id ?? "",
        jobId: job?.id ?? "",
      })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Download QC reports and annotated datasets for validated files
        </p>
      </div>

      {reportItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-50">
            <BarChart3 className="size-6 text-amber-600" />
          </div>
          <p className="mt-4 text-sm font-medium text-muted-foreground">No validated datasets yet</p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Run QC on a dataset to generate reports
          </p>
          <Link
            href="/projects"
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background transition-all hover:opacity-90"
          >
            Go to Projects
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {reportItems.map(({ dataset, run, jobName, projectName, projectId, jobId }) => (
            <div
              key={dataset.id}
              className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={`/projects/${projectId}/jobs/${jobId}/files/${dataset.id}`}
                  className="font-medium hover:underline"
                >
                  {dataset.file_name}
                </Link>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{projectName}</span>
                  <span>·</span>
                  <span>{jobName}</span>
                  <span>·</span>
                  <span>
                    {new Date(run.run_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <Badge
                    variant={run.total_issues === 0 ? "outline" : "destructive"}
                    className="rounded-md text-[10px]"
                  >
                    {run.total_issues} issue{run.total_issues !== 1 ? "s" : ""}
                  </Badge>
                  <Badge variant="outline" className="rounded-md text-[10px]">
                    {run.pass_rate?.toFixed(1)}% pass
                  </Badge>
                </div>
              </div>
              <ExportButtons runId={run.id} datasetId={dataset.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
