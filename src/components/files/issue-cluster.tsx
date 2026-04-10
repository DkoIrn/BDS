"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, AlertTriangle, Info } from "lucide-react"
import type { IssueCluster } from "@/lib/ai/types"

interface IssueClusterRowProps {
  cluster: IssueCluster
}

const SEVERITY_CONFIG = {
  critical: {
    bg: "bg-red-50 dark:bg-red-950/30",
    border: "border-red-200 dark:border-red-900",
    text: "text-red-700 dark:text-red-300",
    sub: "text-red-600 dark:text-red-400",
    badge: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
  },
  warning: {
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-200 dark:border-amber-900",
    text: "text-amber-700 dark:text-amber-300",
    sub: "text-amber-600 dark:text-amber-400",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  },
  info: {
    bg: "bg-blue-50 dark:bg-blue-950/30",
    border: "border-blue-200 dark:border-blue-900",
    text: "text-blue-700 dark:text-blue-300",
    sub: "text-blue-600 dark:text-blue-400",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  },
}

export function IssueClusterRow({ cluster }: IssueClusterRowProps) {
  const [expanded, setExpanded] = useState(false)
  const config = SEVERITY_CONFIG[cluster.severity]

  return (
    <div className={`rounded-lg border ${config.border} overflow-hidden`}>
      {/* Cluster header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 cursor-pointer ${config.bg}`}
      >
        {cluster.severity === "critical" || cluster.severity === "warning" ? (
          <AlertTriangle className={`size-4 shrink-0 ${config.text}`} />
        ) : (
          <Info className={`size-4 shrink-0 ${config.text}`} />
        )}

        <span className={`flex-1 text-sm font-medium ${config.text}`}>
          {cluster.label}
        </span>

        {/* Severity badge */}
        <span
          className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${config.badge}`}
        >
          {cluster.severity}
        </span>

        {/* Count badge */}
        <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          {cluster.count} issue{cluster.count !== 1 ? "s" : ""}
        </span>

        {/* KP range */}
        {cluster.kp_range && (
          <span className="hidden sm:inline text-[11px] text-muted-foreground">
            KP {cluster.kp_range.min.toFixed(1)}-{cluster.kp_range.max.toFixed(1)}
          </span>
        )}

        {expanded ? (
          <ChevronUp className="size-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {/* Expanded issues list */}
      {expanded && (
        <div className="max-h-60 overflow-y-auto border-t border-inherit">
          <div className="divide-y divide-muted/50">
            {cluster.issues.map((issue) => (
              <div
                key={issue.id}
                className="flex items-start gap-3 px-4 py-2 text-xs"
              >
                <span className="shrink-0 font-mono text-muted-foreground w-12">
                  Row {issue.row_number}
                </span>
                <span className="shrink-0 font-medium text-muted-foreground w-24 truncate">
                  {issue.column_name}
                </span>
                <span className="text-muted-foreground">{issue.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
