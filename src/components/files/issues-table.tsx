"use client"

import { useState, Fragment, useMemo } from "react"
import { ChevronDown, ChevronRight, Layers } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { getSeverityColor, getSeverityIcon } from "@/lib/utils/severity"
import { IssueRowDetail } from "@/components/files/issue-row-detail"
import type { ValidationIssue, ValidationSeverity } from "@/lib/types/validation"

const RULE_LABELS: Record<string, string> = {
  range_check: "Range Check",
  missing_data: "Missing Data",
  duplicate_rows: "Duplicate Rows",
  near_duplicate_kp: "Near-Duplicate KP",
  outliers_zscore: "Outlier (Z-Score)",
  outliers_iqr: "Outlier (IQR)",
  kp_gaps: "KP Gap",
  monotonicity: "KP Monotonicity",
  cross_column: "Cross-Column Consistency",
  spike_detection: "Spike / Gradient",
  coordinate_sanity: "Coordinate Sanity",
}

function getRuleLabel(ruleType: string): string {
  return RULE_LABELS[ruleType] || ruleType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

const RULE_COLORS: Record<string, string> = {
  range_check: "bg-red-50 text-red-600",
  missing_data: "bg-slate-50 text-slate-600",
  duplicate_rows: "bg-orange-50 text-orange-600",
  near_duplicate_kp: "bg-orange-50 text-orange-600",
  outliers_zscore: "bg-amber-50 text-amber-600",
  outliers_iqr: "bg-amber-50 text-amber-600",
  kp_gaps: "bg-violet-50 text-violet-600",
  monotonicity: "bg-violet-50 text-violet-600",
  cross_column: "bg-teal-50 text-teal-600",
  spike_detection: "bg-pink-50 text-pink-600",
  coordinate_sanity: "bg-blue-50 text-blue-600",
}

function getRuleColor(ruleType: string): string {
  return RULE_COLORS[ruleType] || "bg-muted text-muted-foreground"
}

type ViewMode = "grouped" | "flat"

interface IssuesTableProps {
  issues: ValidationIssue[]
  datasetId: string
  activeSeverity: ValidationSeverity | "all"
  onSeverityChange: (severity: ValidationSeverity | "all") => void
}

export function IssuesTable({
  issues,
  datasetId,
  activeSeverity,
  onSeverityChange,
}: IssuesTableProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("grouped")
  const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set())
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  // Severity filter tabs
  const counts = useMemo(() => ({
    all: issues.length,
    critical: issues.filter((i) => i.severity === "critical").length,
    warning: issues.filter((i) => i.severity === "warning").length,
    info: issues.filter((i) => i.severity === "info").length,
  }), [issues])

  const filtered = useMemo(() =>
    activeSeverity === "all"
      ? issues
      : issues.filter((i) => i.severity === activeSeverity),
    [issues, activeSeverity]
  )

  // Group by rule_type
  const grouped = useMemo(() => {
    const groups: Record<string, ValidationIssue[]> = {}
    for (const issue of filtered) {
      const key = issue.rule_type
      if (!groups[key]) groups[key] = []
      groups[key].push(issue)
    }
    // Sort groups: most issues first
    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length)
  }, [filtered])

  function toggleIssue(issueId: string) {
    setExpandedIssues((prev) => {
      const next = new Set(prev)
      next.has(issueId) ? next.delete(issueId) : next.add(issueId)
      return next
    })
  }

  function toggleGroup(ruleType: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      next.has(ruleType) ? next.delete(ruleType) : next.add(ruleType)
      return next
    })
  }

  const severityTabs: { value: ValidationSeverity | "all"; label: string; color?: string }[] = [
    { value: "all", label: `All ${counts.all}` },
    { value: "critical", label: `${counts.critical} Critical`, color: "text-red-600" },
    { value: "warning", label: `${counts.warning} Warning`, color: "text-amber-600" },
    { value: "info", label: `${counts.info} Info`, color: "text-blue-600" },
  ]

  return (
    <div className="space-y-4">
      {/* Controls bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {severityTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => onSeverityChange(tab.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeSeverity === tab.value
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => setViewMode(viewMode === "grouped" ? "flat" : "grouped")}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        >
          <Layers className="size-3.5" />
          {viewMode === "grouped" ? "Flat view" : "Group by rule"}
        </button>
      </div>

      {/* Issues */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-12 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            {activeSeverity === "all" ? "No issues found" : `No ${activeSeverity} issues`}
          </p>
        </div>
      ) : viewMode === "grouped" ? (
        <div className="space-y-3">
          {grouped.map(([ruleType, groupIssues]) => {
            const isCollapsed = collapsedGroups.has(ruleType)
            const ruleColor = getRuleColor(ruleType)
            const critCount = groupIssues.filter((i) => i.severity === "critical").length
            const warnCount = groupIssues.filter((i) => i.severity === "warning").length

            return (
              <div key={ruleType} className="rounded-2xl border bg-card overflow-hidden">
                {/* Group header */}
                <button
                  onClick={() => toggleGroup(ruleType)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                >
                  {isCollapsed ? (
                    <ChevronRight className="size-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="size-4 text-muted-foreground" />
                  )}
                  <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[11px] font-semibold ${ruleColor}`}>
                    {getRuleLabel(ruleType)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {groupIssues.length} issue{groupIssues.length !== 1 ? "s" : ""}
                  </span>
                  <div className="ml-auto flex items-center gap-1.5">
                    {critCount > 0 && (
                      <span className="rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">
                        {critCount} critical
                      </span>
                    )}
                    {warnCount > 0 && (
                      <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600">
                        {warnCount} warning
                      </span>
                    )}
                  </div>
                </button>

                {/* Group issues */}
                {!isCollapsed && (
                  <div className="border-t">
                    {groupIssues
                      .sort((a, b) => a.row_number - b.row_number)
                      .map((issue) => (
                        <IssueItem
                          key={issue.id}
                          issue={issue}
                          datasetId={datasetId}
                          isExpanded={expandedIssues.has(issue.id)}
                          onToggle={() => toggleIssue(issue.id)}
                        />
                      ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        /* Flat view */
        <div className="rounded-2xl border bg-card overflow-hidden">
          {filtered
            .sort((a, b) => a.row_number - b.row_number)
            .map((issue) => (
              <IssueItem
                key={issue.id}
                issue={issue}
                datasetId={datasetId}
                isExpanded={expandedIssues.has(issue.id)}
                onToggle={() => toggleIssue(issue.id)}
                showRule
              />
            ))}
        </div>
      )}
    </div>
  )
}

function IssueItem({
  issue,
  datasetId,
  isExpanded,
  onToggle,
  showRule,
}: {
  issue: ValidationIssue
  datasetId: string
  isExpanded: boolean
  onToggle: () => void
  showRule?: boolean
}) {
  const colors = getSeverityColor(issue.severity)
  const Icon = getSeverityIcon(issue.severity)

  return (
    <div className="border-b last:border-b-0">
      <button
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
      >
        <div className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg ${colors.bg}`}>
          <Icon className={`size-3 ${colors.text}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-foreground leading-snug">
            {issue.message}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-mono text-muted-foreground">
              Row {issue.row_number}
            </span>
            <span className="text-muted-foreground/30">·</span>
            <span className="text-[11px] text-muted-foreground">
              {issue.column_name}
            </span>
            {issue.kp_value != null && (
              <>
                <span className="text-muted-foreground/30">·</span>
                <span className="text-[11px] text-muted-foreground">
                  KP {issue.kp_value}
                </span>
              </>
            )}
            {showRule && (
              <>
                <span className="text-muted-foreground/30">·</span>
                <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${getRuleColor(issue.rule_type)}`}>
                  {getRuleLabel(issue.rule_type)}
                </span>
              </>
            )}
          </div>
        </div>
        <Badge className={`shrink-0 gap-1 rounded-md text-[10px] ${colors.badge}`}>
          {issue.severity}
        </Badge>
      </button>

      {isExpanded && (
        <div className="border-t bg-muted/20">
          <IssueRowDetail issue={issue} datasetId={datasetId} />
        </div>
      )}
    </div>
  )
}
