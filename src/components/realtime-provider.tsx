"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import type { DatasetStatus } from "@/lib/types/files"

interface RealtimePayload {
  new: {
    id: string
    job_id: string
    user_id: string
    file_name: string
    status: DatasetStatus
  }
}

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

    const channel = supabase
      .channel("dataset-status")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "datasets",
          filter: `user_id=eq.${userId}`,
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
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, router])

  return <>{children}</>
}
