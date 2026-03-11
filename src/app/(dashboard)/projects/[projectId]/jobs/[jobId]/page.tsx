import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { BarChart3 } from "lucide-react"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileUploadZone } from "@/components/files/file-upload-zone"
import { FileList } from "@/components/files/file-list"
import { getJobFiles } from "@/lib/actions/files"
import type { Job, JobStatus } from "@/lib/types/projects"
import type { Dataset } from "@/lib/types/files"

const statusVariantMap: Record<
  JobStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  pending: "outline",
  processing: "default",
  completed: "secondary",
  failed: "destructive",
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; jobId: string }>
}) {
  const { projectId, jobId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Fetch job with ownership check
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .eq("user_id", user.id)
    .single()

  if (jobError || !job) {
    notFound()
  }

  const typedJob = job as Job

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

  // Fetch existing files
  const filesResult = await getJobFiles(jobId)
  const initialFiles: Dataset[] =
    "data" in filesResult ? filesResult.data : []

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
            <BreadcrumbPage>{typedJob.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">
            {typedJob.name}
          </h1>
          <Badge variant="outline">{typedJob.survey_type}</Badge>
          <Badge variant={statusVariantMap[typedJob.status]}>
            {typedJob.status.charAt(0).toUpperCase() +
              typedJob.status.slice(1)}
          </Badge>
        </div>
        {typedJob.description && (
          <p className="text-sm text-muted-foreground">
            {typedJob.description}
          </p>
        )}
      </div>

      <Tabs defaultValue="files">
        <TabsList>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>

        <TabsContent value="files">
          <div className="space-y-6 pt-4">
            <FileUploadZone
              jobId={jobId}
              userId={user.id}
              existingFiles={initialFiles}
            />
            <FileList files={initialFiles} jobId={jobId} />
          </div>
        </TabsContent>

        <TabsContent value="results">
          <div className="flex flex-col items-center justify-center py-16">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <BarChart3 className="size-6 text-muted-foreground" />
            </div>
            <h2 className="mt-4 text-lg font-semibold">No results yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              QC results will appear here after processing
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
