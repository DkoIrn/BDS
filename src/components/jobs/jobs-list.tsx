"use client"

import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { FileText, Clock, FlaskConical } from "lucide-react"
import type { Job, JobStatus } from "@/lib/types/projects"

const statusColors: Record<JobStatus, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800",
  processing: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800",
  completed: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-300 dark:border-green-800",
  failed: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800",
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

export function JobsList({ jobs }: { jobs: Job[] }) {
  if (jobs.length === 0) return null

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {jobs.map((job) => (
        <Link
          key={job.id}
          href={`/projects/${job.project_id}/jobs/${job.id}`}
          className="group flex flex-col rounded-2xl border bg-card p-5 transition-all hover:border-foreground/20 hover:shadow-md"
        >
          {/* Header */}
          <div className="flex items-start gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/50">
              <FileText className="size-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-semibold text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                {job.name}
              </h3>
              <div className={`mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusColors[job.status]}`}>
                {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
              </div>
            </div>
          </div>

          {/* Description */}
          {job.description && (
            <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
              {job.description}
            </p>
          )}

          {/* Stats */}
          <div className="mt-4 flex items-center gap-4 border-t pt-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <FlaskConical className="size-3.5" />
              <span>{job.survey_type}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="size-3.5" />
              <span>{formatTimeAgo(job.created_at)}</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
