import { redirect } from "next/navigation"
import { FolderOpen } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { ProjectsTable } from "@/components/projects/projects-table"
import { CreateProjectDialog } from "@/components/projects/create-project-dialog"
import type { Project } from "@/lib/types/projects"

export default async function ProjectsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: projects } = await supabase
    .from("projects")
    .select("*, jobs(count)")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })

  const typedProjects = (projects ?? []) as Project[]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">
            Manage your survey projects and jobs
          </p>
        </div>
        <CreateProjectDialog />
      </div>

      {typedProjects.length > 0 ? (
        <ProjectsTable projects={typedProjects} />
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <FolderOpen className="size-6 text-muted-foreground" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">No projects yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first project to get started
          </p>
          <div className="mt-4">
            <CreateProjectDialog />
          </div>
        </div>
      )}
    </div>
  )
}
