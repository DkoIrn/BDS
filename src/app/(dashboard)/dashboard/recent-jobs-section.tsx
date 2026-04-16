"use client"

import { useEffect, useState } from "react"
import { CheckCircle, XCircle, FileText, Loader2 } from "lucide-react"

interface RecentRun {
  id: string
  fileName: string
  projectName: string
  totalIssues: number
  criticalCount: number
  passRate: number | null
  status: string
  runAt: string
}

export function RecentJobsSection() {
  const [runs, setRuns] = useState<RecentRun[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchRuns() {
      try {
        const res = await fetch("/api/recent-runs")
        if (res.ok) {
          const data = await res.json()
          setRuns(data.runs ?? [])
        }
      } catch (err) {
        console.error("Failed to fetch recent runs:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchRuns()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (runs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <FileText className="size-8 text-muted-foreground/40" />
        <p className="mt-2 text-sm text-muted-foreground">No validation runs yet</p>
        <p className="text-xs text-muted-foreground/70">
          Runs will appear here after running QC checks
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {runs.map((run) => {
        const passed = run.criticalCount === 0
        const timeAgo = formatTimeAgo(run.runAt)

        return (
          <div
            key={run.id}
            className="flex items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-muted/30"
          >
            <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
              passed ? "bg-green-100 dark:bg-green-950/50" : "bg-red-100 dark:bg-red-950/50"
            }`}>
              {passed ? <CheckCircle className="size-4 text-green-600" /> : <XCircle className="size-4 text-red-600" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{run.fileName}</p>
              <p className="truncate text-xs text-muted-foreground">
                {run.projectName} — {run.totalIssues} issue{run.totalIssues !== 1 ? "s" : ""}
                {run.passRate != null && ` — ${Math.round(run.passRate)}% pass`}
              </p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">{timeAgo}</span>
          </div>
        )
      })}
    </div>
  )
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}
