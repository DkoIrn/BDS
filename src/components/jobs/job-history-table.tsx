"use client"

import { useEffect, useState } from "react"
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Ban,
  ChevronDown,
  ChevronRight,
  History,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { JobRun, JobRunRow, JobStatus } from "@/lib/types/jobs"
import { toJobRun } from "@/lib/types/jobs"

interface JobHistoryTableProps {
  datasetId?: string
  limit?: number
}

const STATUS_CONFIG: Record<
  JobStatus,
  { icon: React.ComponentType<{ className?: string }>; color: string; label: string }
> = {
  queued: { icon: Clock, color: "text-gray-500 bg-gray-100", label: "Queued" },
  running: { icon: Loader2, color: "text-blue-600 bg-blue-100", label: "Running" },
  succeeded: { icon: CheckCircle2, color: "text-emerald-600 bg-emerald-100", label: "Succeeded" },
  failed: { icon: XCircle, color: "text-red-600 bg-red-100", label: "Failed" },
  cancelled: { icon: Ban, color: "text-amber-600 bg-amber-100", label: "Cancelled" },
}

export function JobHistoryTable({ datasetId, limit = 10 }: JobHistoryTableProps) {
  const [jobs, setJobs] = useState<JobRun[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Fetch initial data
  useEffect(() => {
    async function fetchJobs() {
      try {
        const params = new URLSearchParams()
        if (datasetId) params.set("dataset_id", datasetId)
        params.set("limit", String(limit))

        const res = await fetch(`/api/jobs?${params.toString()}`)
        if (res.ok) {
          const data = await res.json()
          const rows: JobRunRow[] = Array.isArray(data) ? data : data.jobs ?? []
          setJobs(rows.map(toJobRun))
        }
      } catch (err) {
        console.error("[JobHistoryTable] Fetch error:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchJobs()
  }, [datasetId, limit])

  // Subscribe to Realtime updates on job_runs
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel("job-runs-updates")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "job_runs",
        },
        (payload: { new: JobRunRow }) => {
          const newJob = toJobRun(payload.new as JobRunRow)
          // Filter by dataset if scoped
          if (datasetId && newJob.datasetId !== datasetId) return
          setJobs((prev) => [newJob, ...prev].slice(0, limit))
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "job_runs",
        },
        (payload: { new: JobRunRow }) => {
          const updated = toJobRun(payload.new as JobRunRow)
          setJobs((prev) =>
            prev.map((j) => (j.id === updated.id ? updated : j))
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [datasetId, limit])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
          <History className="size-4 text-muted-foreground" />
        </div>
        <p className="mt-3 text-sm font-medium text-muted-foreground">
          No validation jobs yet
        </p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          Jobs will appear here after running QC checks
        </p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-border">
      {jobs.map((job) => {
        const config = STATUS_CONFIG[job.status]
        const StatusIcon = config.icon
        const isExpanded = expandedId === job.id
        const issueCount = (job.resultSummary as Record<string, number> | null)?.total_issues
        const profile = (job.configSnapshot as Record<string, string> | null)?.profile_name

        return (
          <div key={job.id}>
            <button
              onClick={() => setExpandedId(isExpanded ? null : job.id)}
              className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/40"
            >
              <div
                className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${config.color}`}
              >
                <StatusIcon
                  className={`size-3.5 ${job.status === "running" ? "animate-spin" : ""}`}
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground truncate">
                    {job.jobType === "validation" ? "QC Validation" : job.jobType}
                  </span>
                  {profile && (
                    <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {profile}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{formatRelative(job.createdAt)}</span>
                  {job.durationMs != null && (
                    <>
                      <span>&middot;</span>
                      <span>{formatDuration(job.durationMs)}</span>
                    </>
                  )}
                  {issueCount != null && (
                    <>
                      <span>&middot;</span>
                      <span>{issueCount} issues</span>
                    </>
                  )}
                  {job.attemptNumber > 1 && (
                    <>
                      <span>&middot;</span>
                      <span>Attempt {job.attemptNumber}/{job.maxAttempts}</span>
                    </>
                  )}
                </div>
              </div>

              <span
                className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${config.color}`}
              >
                {config.label}
              </span>

              {(job.errorSummary || job.errorDetail) ? (
                isExpanded ? (
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                )
              ) : (
                <div className="size-4 shrink-0" />
              )}
            </button>

            {/* Expanded detail */}
            {isExpanded && (job.errorSummary || job.errorDetail) && (
              <div className="border-t bg-muted/20 px-4 py-3">
                {job.errorSummary && (
                  <p className="text-sm text-red-700 font-medium">{job.errorSummary}</p>
                )}
                {job.errorDetail && (
                  <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-muted p-3 text-xs font-mono text-muted-foreground whitespace-pre-wrap">
                    {job.errorDetail}
                  </pre>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function formatRelative(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainSec = seconds % 60
  return `${minutes}m ${remainSec}s`
}
