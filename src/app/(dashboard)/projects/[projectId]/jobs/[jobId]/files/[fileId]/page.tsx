import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Badge } from "@/components/ui/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { FileDetailView } from "@/components/files/file-detail-view"
import { HealthScoreCard } from "@/components/files/health-badge"
import type { Dataset, DatasetStatus } from "@/lib/types/files"
import type { SurveyType } from "@/lib/types/projects"

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const statusVariantMap: Record<
  DatasetStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  uploaded: "secondary",
  parsing: "default",
  parsed: "outline",
  mapped: "default",
  validating: "default",
  validated: "outline",
  validation_error: "destructive",
  error: "destructive",
}

export default async function FileDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; jobId: string; fileId: string }>
}) {
  const { projectId, jobId, fileId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Fetch dataset with ownership check
  const { data: dataset, error: datasetError } = await supabase
    .from("datasets")
    .select("*")
    .eq("id", fileId)
    .eq("user_id", user.id)
    .single()

  if (datasetError || !dataset) {
    notFound()
  }

  const typedDataset = dataset as Dataset

  // Fetch job for survey_type and name
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id, name, survey_type, project_id")
    .eq("id", jobId)
    .eq("user_id", user.id)
    .single()

  if (jobError || !job) {
    notFound()
  }

  // Fetch project for breadcrumb
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single()

  if (projectError || !project) {
    notFound()
  }

  const surveyType = job.survey_type as SurveyType

  // Fetch latest validation run for health score
  const { data: latestRun } = await supabase
    .from("validation_runs")
    .select("total_issues, critical_count, warning_count, info_count, pass_rate, completeness_score")
    .eq("dataset_id", fileId)
    .eq("status", "completed")
    .order("run_at", { ascending: false })
    .limit(1)
    .single()

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/projects" />}>
              Projects
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink
              render={<Link href={`/projects/${projectId}`} />}
            >
              {project.name}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink
              render={
                <Link href={`/projects/${projectId}/jobs/${jobId}`} />
              }
            >
              {job.name}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{typedDataset.file_name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* File metadata header */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">
            {typedDataset.file_name}
          </h1>
          <Badge variant={statusVariantMap[typedDataset.status]}>
            {typedDataset.status.charAt(0).toUpperCase() +
              typedDataset.status.slice(1)}
          </Badge>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>{formatFileSize(typedDataset.file_size)}</span>
          <span>Uploaded {formatDate(typedDataset.created_at)}</span>
          {typedDataset.total_rows != null && (
            <span>{typedDataset.total_rows.toLocaleString()} data rows</span>
          )}
        </div>
      </div>

      {/* Health score card */}
      {latestRun && (
        <HealthScoreCard
          passRate={latestRun.pass_rate}
          totalIssues={latestRun.total_issues}
          criticalCount={latestRun.critical_count}
          warningCount={latestRun.warning_count}
          infoCount={latestRun.info_count}
          totalRows={typedDataset.total_rows ?? undefined}
        />
      )}

      {/* File detail view with mapping interface */}
      <FileDetailView
        dataset={typedDataset}
        jobSurveyType={surveyType}
        projectId={projectId}
        jobId={jobId}
      />
    </div>
  )
}
