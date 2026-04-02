"use client"

import { useEffect, useState } from "react"
import {
  ShieldCheck,
  Zap,
  Brain,
  Download,
  Upload,
  FolderPlus,
  X,
  FileText,
  Clock,
  ArrowRight,
  ChevronDown,
} from "lucide-react"
import { getAuditLogs, type AuditLogEntry } from "@/lib/actions/audit-read"

const ACTION_CONFIG: Record<
  string,
  {
    icon: typeof ShieldCheck
    label: string
    color: string
    iconColor: string
  }
> = {
  "validation.run": {
    icon: ShieldCheck,
    label: "QC Validation Started",
    color: "border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
  "validation.complete": {
    icon: ShieldCheck,
    label: "QC Validation Complete",
    color: "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
  "clean.auto": {
    icon: Zap,
    label: "Auto-Clean Applied",
    color: "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30",
    iconColor: "text-green-600 dark:text-green-400",
  },
  "clean.ai_fix": {
    icon: Brain,
    label: "AI Fix Applied",
    color: "border-violet-200 bg-violet-50 dark:border-violet-900 dark:bg-violet-950/30",
    iconColor: "text-violet-600 dark:text-violet-400",
  },
  "clean.ai_reject": {
    icon: X,
    label: "AI Fix Rejected",
    color: "border-muted bg-muted/30",
    iconColor: "text-muted-foreground",
  },
  "export.download": {
    icon: Download,
    label: "Dataset Exported",
    color: "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
  "dataset.upload": {
    icon: Upload,
    label: "Dataset Uploaded",
    color: "border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
  "dataset.save_to_project": {
    icon: FolderPlus,
    label: "Saved to Project",
    color: "border-teal-200 bg-teal-50 dark:border-teal-900 dark:bg-teal-950/30",
    iconColor: "text-teal-600 dark:text-teal-400",
  },
  "report.generate": {
    icon: FileText,
    label: "Report Generated",
    color: "border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/30",
    iconColor: "text-orange-600 dark:text-orange-400",
  },
}

const DEFAULT_CONFIG = {
  icon: Clock,
  label: "Action",
  color: "border-muted bg-muted/30",
  iconColor: "text-muted-foreground",
}

function formatTime(dateStr: string): string {
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
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function AuditTimeline({ datasetId }: { datasetId: string }) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    getAuditLogs("dataset", datasetId).then((result) => {
      if ("data" in result) setLogs(result.data)
      setLoading(false)
    })
  }, [datasetId])

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="relative flex size-10 items-center justify-center">
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-muted border-t-foreground" />
          <Clock className="size-4 text-foreground" />
        </div>
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
          <Clock className="size-4 text-muted-foreground" />
        </div>
        <p className="mt-3 text-sm font-medium text-muted-foreground">No activity yet</p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          Actions like validation, cleaning, and exports will appear here
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {logs.map((log, idx) => {
        const config = ACTION_CONFIG[log.action] || DEFAULT_CONFIG
        const Icon = config.icon
        const isLast = idx === logs.length - 1
        const isExpanded = expanded.has(log.id)
        const hasMetadata = log.metadata && Object.keys(log.metadata).length > 0

        return (
          <div key={log.id} className="flex gap-3">
            {/* Timeline line + dot */}
            <div className="flex flex-col items-center">
              <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg border ${config.color}`}>
                <Icon className={`size-3.5 ${config.iconColor}`} />
              </div>
              {!isLast && (
                <div className="w-px flex-1 bg-border" />
              )}
            </div>

            {/* Content */}
            <div className={`flex-1 pb-4 ${isLast ? "" : ""}`}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">
                  {config.label}
                </p>
                <span className="text-[11px] text-muted-foreground">
                  {formatTime(log.created_at)}
                </span>
              </div>

              {/* Summary line based on action type */}
              <ActionSummary action={log.action} metadata={log.metadata} />

              {/* Expandable metadata */}
              {hasMetadata && (
                <button
                  onClick={() => toggleExpand(log.id)}
                  className="mt-1 flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronDown className={`size-3 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  {isExpanded ? "Hide details" : "Show details"}
                </button>
              )}

              {isExpanded && hasMetadata && (
                <div className="mt-2 rounded-lg border bg-muted/30 p-3">
                  <MetadataDisplay metadata={log.metadata} action={log.action} />
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ActionSummary({ action, metadata }: { action: string; metadata: Record<string, unknown> }) {
  // Cast to any for JSX rendering — metadata shape varies by action
  const m = metadata as Record<string, any>

  switch (action) {
    case "validation.complete":
      return (
        <p className="text-xs text-muted-foreground">
          {(m.totalIssues as number) ?? 0} issues found
          {(m.critical as number) > 0 && ` (${m.critical} critical)`}
          {m.fileName && ` — ${String(m.fileName)}`}
        </p>
      )
    case "validation.run":
      return (
        <p className="text-xs text-muted-foreground">
          {m.source === "project_backend" ? "Backend QC" : "Pipeline QC"}
          {m.hasCustomConfig ? " with custom profile" : " with default profile"}
        </p>
      )
    case "clean.auto":
      return (
        <p className="text-xs text-muted-foreground">
          {m.totalActions as number} fix{(m.totalActions as number) !== 1 ? "es" : ""}
          {(m.duplicatesRemoved as number) > 0 && `, ${m.duplicatesRemoved} duplicates removed`}
          {(m.spikesRemoved as number) > 0 && `, ${m.spikesRemoved} spikes fixed`}
          {(m.valuesInterpolated as number) > 0 && `, ${m.valuesInterpolated} gaps filled`}
        </p>
      )
    case "clean.ai_fix":
      return (
        <p className="text-xs text-muted-foreground">
          Row {m.row as number} · {m.column as string}:
          <span className="ml-1 font-mono text-red-600 line-through dark:text-red-400">
            {(m.before as string) || "(empty)"}
          </span>
          <ArrowRight className="mx-1 inline size-3 text-muted-foreground" />
          <span className="font-mono text-green-600 dark:text-green-400">
            {m.after as string}
          </span>
          <span className="ml-1">({Math.round((m.confidence as number) * 100)}% confidence)</span>
        </p>
      )
    case "clean.ai_reject":
      return (
        <p className="text-xs text-muted-foreground">
          Row {m.row as number} · {m.column as string} — suggested {m.suggestedValue as string} ({Math.round((m.confidence as number) * 100)}%)
        </p>
      )
    case "export.download":
      return (
        <p className="text-xs text-muted-foreground">
          {String(m.outputFilename ?? "")}
          {m.format && ` (${String(m.format).toUpperCase()})`}
          {m.rowCount && ` · ${Number(m.rowCount).toLocaleString()} rows`}
        </p>
      )
    case "dataset.save_to_project":
      return (
        <p className="text-xs text-muted-foreground">
          {String(m.projectName ?? "")} / {String(m.jobName ?? "")}
          {m.surveyType && ` · ${String(m.surveyType)}`}
        </p>
      )
    default:
      return null
  }
}

function MetadataDisplay({ metadata, action }: { metadata: Record<string, unknown>; action: string }) {
  // For AI fixes, show the explanation prominently
  if ((action === "clean.ai_fix" || action === "clean.ai_reject") && metadata.explanation) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">{metadata.explanation as string}</p>
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          {Object.entries(metadata)
            .filter(([k]) => !["explanation"].includes(k))
            .map(([key, value]) => (
              <div key={key}>
                <span className="text-muted-foreground/60">{key}: </span>
                <span className="text-muted-foreground">{String(value)}</span>
              </div>
            ))}
        </div>
      </div>
    )
  }

  // Generic metadata display
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
      {Object.entries(metadata).map(([key, value]) => (
        <div key={key}>
          <span className="text-muted-foreground/60">{key}: </span>
          <span className="text-muted-foreground">
            {typeof value === "boolean" ? (value ? "Yes" : "No") : String(value ?? "--")}
          </span>
        </div>
      ))}
    </div>
  )
}
