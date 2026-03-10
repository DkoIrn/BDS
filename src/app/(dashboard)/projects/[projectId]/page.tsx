import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Briefcase } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { ProjectStatusBadge } from "@/components/projects/project-status-badge"
import { JobsList } from "@/components/jobs/jobs-list"
import { CreateJobDialog } from "@/components/jobs/create-job-dialog"
import type { Job } from "@/lib/types/projects"

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
    <div className="space-y-6">
      <div>
        <Link
          href="/projects"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to Projects
        </Link>
      </div>

      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
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

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Survey Jobs</h2>
          {typedJobs.length > 0 && <CreateJobDialog projectId={projectId} />}
        </div>

        {typedJobs.length > 0 ? (
          <JobsList jobs={typedJobs} />
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
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
    </div>
  )
}
