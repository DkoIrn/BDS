"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import type { DatasetStatus } from "@/lib/types/files"
import type { JobRunRow, JobStatus } from "@/lib/types/jobs"

interface RealtimePayload {
  new: {
    id: string
    job_id: string
    user_id: string
    file_name: string
    status: DatasetStatus
  }
}

/**
 * RealtimeProvider subscribes to dataset status changes and job_runs events.
 * Since RLS on the Realtime side handles org-scoped visibility,
 * we subscribe without a user_id filter -- RLS ensures users only
 * see updates for datasets in their org's projects.
 */
export function RealtimeProvider({
  userId,
  children,
}: {
  userId: string
  children: React.ReactNode
}) {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    // Channel 1: Dataset status changes (backward-compat for USE_JOB_QUEUE=false)
    const datasetChannel = supabase
      .channel("dataset-status")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "datasets",
        },
        async (payload: { new: RealtimePayload["new"] }) => {
          const { id: datasetId, job_id: jobId, file_name: fileName, status } = payload.new

          if (status === "validated") {
            // Fetch validation run counts for the toast description
            const { data: run } = await supabase
              .from("validation_runs")
              .select("*")
              .eq("dataset_id", datasetId)
              .order("created_at", { ascending: false })
              .limit(1)
              .single()

            // Fetch project_id for navigation URL
            const { data: job } = await supabase
              .from("jobs")
              .select("project_id")
              .eq("id", jobId)
              .single()

            const projectId = job?.project_id
            const description = run
              ? `${run.critical_count} critical, ${run.warning_count} warnings`
              : "Validation complete"

            toast.success(`Validated: ${fileName}`, {
              description,
              action: projectId
                ? {
                    label: "View Results",
                    onClick: () => {
                      router.push(
                        `/projects/${projectId}/jobs/${jobId}/files/${datasetId}`
                      )
                    },
                  }
                : undefined,
            })
          } else if (status === "validation_error") {
            // Fetch project_id for navigation URL
            const { data: job } = await supabase
              .from("jobs")
              .select("project_id")
              .eq("id", jobId)
              .single()

            const projectId = job?.project_id

            toast.error(`Validation failed: ${fileName}`, {
              action: projectId
                ? {
                    label: "View Details",
                    onClick: () => {
                      router.push(
                        `/projects/${projectId}/jobs/${jobId}/files/${datasetId}`
                      )
                    },
                  }
                : undefined,
            })
          }
          // Note: validation_progress changes are NOT toasted -- the JobProgressBar handles those
        }
      )
      .subscribe()

    // Channel 2: Job runs events (for job queue mode)
    const jobRunsChannel = supabase
      .channel("job-runs-status")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "job_runs",
        },
        async (payload: { new: JobRunRow }) => {
          const row = payload.new
          if (row.status === "running") {
            // Fetch dataset name for the toast
            const { data: dataset } = await supabase
              .from("datasets")
              .select("file_name")
              .eq("id", row.dataset_id)
              .single()
            const name = dataset?.file_name ?? "dataset"
            toast.info(`Validation started for ${name}`)
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "job_runs",
        },
        async (payload: { new: JobRunRow }) => {
          const row = payload.new
          const status = row.status as JobStatus

          // Fetch dataset name for the toast
          const { data: dataset } = await supabase
            .from("datasets")
            .select("file_name")
            .eq("id", row.dataset_id)
            .single()
          const name = dataset?.file_name ?? "dataset"

          if (status === "succeeded") {
            const issueCount = (row.result_summary as Record<string, number> | null)?.total_issues
            const description = issueCount != null
              ? `${issueCount} issues found`
              : "Validation complete"
            toast.success(`Validation complete for ${name}`, { description })
          } else if (status === "failed") {
            toast.error(`Validation failed for ${name}`, {
              description: row.error_summary ?? "An error occurred",
            })
          } else if (status === "cancelled") {
            toast.warning(`Validation cancelled for ${name}`)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(datasetChannel)
      supabase.removeChannel(jobRunsChannel)
    }
  }, [userId, router])

  return <>{children}</>
}
