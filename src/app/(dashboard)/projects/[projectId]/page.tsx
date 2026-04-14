import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Briefcase } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { ProjectStatusBadge } from "@/components/projects/project-status-badge"
import { JobsList } from "@/components/jobs/jobs-list"
import { CreateJobDialog } from "@/components/jobs/create-job-dialog"
import type { Job } from "@/lib/types/projects"
import { ActivityFeed } from "@/components/activity/activity-feed"

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single()

  if (projectError || !project) {
    notFound()
  }

  const { data: jobs } = await supabase
    .from("jobs")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })

  const typedJobs = (jobs ?? []) as Job[]

  return (
    <div className="space-y-8">
      {/* Back link + Project header */}
      <div className="space-y-4">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to Projects
        </Link>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h1 className="text-2xl font-bold tracking-tight">
                {project.name}
              </h1>
              <ProjectStatusBadge status={project.status} />
            </div>
            {project.description && (
              <p className="text-sm text-muted-foreground">
                {project.description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Survey Jobs */}
      <div className="rounded-2xl border bg-card p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Survey Jobs</h2>
          {typedJobs.length > 0 && <CreateJobDialog projectId={projectId} />}
        </div>

        {typedJobs.length > 0 ? (
          <JobsList jobs={typedJobs} />
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <Briefcase className="size-6 text-muted-foreground" />
            </div>
            <h2 className="mt-4 text-lg font-semibold">No jobs yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first survey job to start uploading data
            </p>
            <div className="mt-4">
              <CreateJobDialog projectId={projectId} />
            </div>
          </div>
        )}
      </div>

      {/* Activity */}
      <div className="rounded-2xl border bg-card p-4 sm:p-6">
        <h2 className="text-lg font-semibold mb-4">Activity</h2>
        <ActivityFeed projectId={projectId} />
      </div>
    </div>
  )
}
