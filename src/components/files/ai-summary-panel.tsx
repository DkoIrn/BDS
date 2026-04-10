"use client"

import { useEffect, useState } from "react"
import { CheckCircle, XCircle, AlertTriangle, Info } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import type { IssueCluster, AISummaryResponse } from "@/lib/ai/types"
import { getTopBlockers } from "@/lib/ai/cluster-issues"

interface AISummaryPanelProps {
  clusters: IssueCluster[]
  passRate: number
  totalIssues: number
  rowCount: number
  fileName: string
}

const SEVERITY_BORDER: Record<string, string> = {
  critical: "border-l-red-500",
  warning: "border-l-amber-500",
  info: "border-l-blue-500",
}

const SEVERITY_ICON_COLOR: Record<string, string> = {
  critical: "text-red-500",
  warning: "text-amber-500",
  info: "text-blue-500",
}

export function AISummaryPanel({
  clusters,
  passRate,
  totalIssues,
  rowCount,
  fileName,
}: AISummaryPanelProps) {
  const [loading, setLoading] = useState(false)
  const [aiSummary, setAiSummary] = useState<AISummaryResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Deterministic top blockers (shown immediately)
  const topClusters = getTopBlockers(clusters, 3)

  useEffect(() => {
    if (clusters.length === 0) return

    let cancelled = false
    setLoading(true)
    setError(null)

    async function fetchAISummary() {
      try {
        const clusterSummaries = clusters.map((c) => ({
          severity: c.severity,
          label: c.label,
          count: c.count,
        }))

        const res = await fetch("/api/ai-summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clusters: clusterSummaries,
            passRate,
            totalIssues,
            rowCount,
            fileName,
          }),
        })

        if (!res.ok) {
          const data = await res.json().catch(() => null)
          throw new Error(data?.error || `AI summary failed (${res.status})`)
        }

        const data: AISummaryResponse = await res.json()
        if (!cancelled) {
          setAiSummary(data)
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "AI analysis unavailable"
          setError(message)
          toast.error("AI analysis unavailable", { description: message })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchAISummary()
    return () => {
      cancelled = true
    }
  }, [clusters, passRate, totalIssues, rowCount, fileName])

  if (clusters.length === 0) return null

  // Use AI top blockers if available, otherwise deterministic
  const blockerTexts = aiSummary?.topBlockers ?? topClusters.map((c) => c.label)
  const blockerSeverities = topClusters.map((c) => c.severity)

  return (
    <div className="rounded-2xl border bg-card p-6 space-y-5">
      {/* Top 3 Blockers */}
      <div>
        <h4 className="text-sm font-semibold text-muted-foreground mb-3">
          Top Blockers
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {blockerTexts.slice(0, 3).map((text, i) => {
            const severity = blockerSeverities[i] ?? "info"
            const borderClass = SEVERITY_BORDER[severity] ?? SEVERITY_BORDER.info
            const iconColor = SEVERITY_ICON_COLOR[severity] ?? SEVERITY_ICON_COLOR.info
            const count = topClusters[i]?.count

            return (
              <div
                key={i}
                className={`rounded-lg border border-l-4 ${borderClass} bg-muted/30 p-3`}
              >
                <div className="flex items-start gap-2">
                  {severity === "critical" ? (
                    <AlertTriangle className={`mt-0.5 size-3.5 shrink-0 ${iconColor}`} />
                  ) : severity === "warning" ? (
                    <AlertTriangle className={`mt-0.5 size-3.5 shrink-0 ${iconColor}`} />
                  ) : (
                    <Info className={`mt-0.5 size-3.5 shrink-0 ${iconColor}`} />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-medium leading-tight">{text}</p>
                    {count != null && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {count} instance{count !== 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* AI Summary narrative */}
      <div>
        <h4 className="text-sm font-semibold text-muted-foreground mb-2">
          AI Analysis
        </h4>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-3/4 rounded" />
          </div>
        ) : aiSummary ? (
          <p className="text-sm text-muted-foreground leading-relaxed">
            {aiSummary.summary}
          </p>
        ) : error ? (
          <p className="text-xs text-muted-foreground italic">
            AI analysis unavailable -- showing cluster-based prioritisation.
          </p>
        ) : null}
      </div>

      {/* Recommendation badge */}
      {aiSummary && (
        <div className="flex items-center gap-3">
          {aiSummary.recommendation === "accept" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700 dark:bg-green-900/50 dark:text-green-300">
              <CheckCircle className="size-3.5" />
              Accept ({aiSummary.confidence}%)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 dark:bg-red-900/50 dark:text-red-300">
              <XCircle className="size-3.5" />
              Reject ({aiSummary.confidence}%)
            </span>
          )}
          {aiSummary.reasoning && (
            <p className="text-xs text-muted-foreground">
              {aiSummary.reasoning}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
