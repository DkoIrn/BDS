"use client"

import { useState, useMemo, useCallback, useRef, useEffect } from "react"
import {
  Check,
  X,
  Clock,
  ClipboardCheck,
  ArrowLeft,
  ArrowRight,
  SkipForward,
  AlertTriangle,
  CheckCircle,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { logAuditClient } from "@/lib/audit-client"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import type { PipelineState, PipelineAction, TriageDecision } from "../lib/pipeline-state"
import type { ValidationIssue } from "../lib/client-validate"

interface StageReviewProps {
  state: PipelineState
  dispatch: React.Dispatch<PipelineAction>
  validationIssues: ValidationIssue[]
}

/** Stable deterministic issue ID -- must match pipeline-workflow.tsx */
function getIssueId(issue: ValidationIssue, index: number): string {
  return `${issue.type}-${issue.row ?? "x"}-${issue.column ?? "x"}-${index}`
}

type SeverityFilter = "all" | "critical" | "warning" | "info"

const SEVERITY_COLORS: Record<string, { badge: string; row: string }> = {
  critical: {
    badge: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    row: "border-l-red-500 bg-red-50/50 dark:bg-red-950/20",
  },
  warning: {
    badge: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    row: "border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20",
  },
  info: {
    badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    row: "border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20",
  },
}

const TYPE_COLORS: Record<string, string> = {
  missing: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  duplicate: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  outlier: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  kp_gap: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  kp_monotonicity: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
}

const DECISION_STYLES: Record<TriageDecision, { badge: string; row: string; label: string }> = {
  accept: {
    badge: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    row: "border-l-2 border-l-green-500 bg-green-50/50 dark:bg-green-950/20",
    label: "Accepted",
  },
  reject: {
    badge: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    row: "border-l-2 border-l-red-500 bg-red-50/50 dark:bg-red-950/20",
    label: "Rejected",
  },
  defer: {
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    row: "border-l-2 border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20",
    label: "Deferred",
  },
}

export function StageReview({ state, dispatch, validationIssues }: StageReviewProps) {
  const [activeSeverity, setActiveSeverity] = useState<SeverityFilter>("all")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectJustification, setRejectJustification] = useState("")
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false)
  const [bulkRejectJustification, setBulkRejectJustification] = useState("")

  // Issue list with stable IDs
  const issuesWithIds = useMemo(
    () => validationIssues.map((issue, index) => ({ issue, id: getIssueId(issue, index) })),
    [validationIssues]
  )

  // Filtered by severity tab
  const filteredIssues = useMemo(
    () =>
      activeSeverity === "all"
        ? issuesWithIds
        : issuesWithIds.filter((i) => i.issue.severity === activeSeverity),
    [issuesWithIds, activeSeverity]
  )

  // Severity counts for tab badges
  const severityCounts = useMemo(() => {
    const counts = { all: issuesWithIds.length, critical: 0, warning: 0, info: 0 }
    for (const { issue } of issuesWithIds) {
      counts[issue.severity]++
    }
    return counts
  }, [issuesWithIds])

  // Progress tracking
  const progress = useMemo(() => {
    const total = issuesWithIds.length
    let accepted = 0
    let rejected = 0
    let deferred = 0
    for (const { id } of issuesWithIds) {
      const entry = state.triageDecisions[id]
      if (entry) {
        if (entry.decision === "accept") accepted++
        else if (entry.decision === "reject") rejected++
        else if (entry.decision === "defer") deferred++
      }
    }
    const reviewed = accepted + rejected + deferred
    return { total, reviewed, accepted, rejected, deferred }
  }, [issuesWithIds, state.triageDecisions])

  const isComplete = progress.reviewed >= progress.total && progress.total > 0
  const progressPercent = progress.total > 0 ? Math.round((progress.reviewed / progress.total) * 100) : 0

  // Clear selection when severity tab changes
  const handleSeverityChange = useCallback((severity: SeverityFilter) => {
    setActiveSeverity(severity)
    setSelectedIds(new Set())
  }, [])

  // Individual triage actions
  const handleTriage = useCallback(
    (issueId: string, decision: TriageDecision, justification: string | null = null) => {
      const item = issuesWithIds.find((i) => i.id === issueId)
      dispatch({ type: "TRIAGE_ISSUE", issueId, decision, justification })
      logAuditClient({
        action: `triage.${decision}`,
        entityType: "dataset",
        entityId: state.datasetId ?? undefined,
        metadata: {
          issueId,
          issueType: item?.issue.type,
          row: item?.issue.row,
          column: item?.issue.column,
          decision,
          justification,
        },
      })
    },
    [dispatch, state.datasetId, issuesWithIds]
  )

  // Inline reject confirm
  const handleRejectConfirm = useCallback(() => {
    if (!rejectingId || !rejectJustification.trim()) return
    handleTriage(rejectingId, "reject", rejectJustification.trim())
    setRejectingId(null)
    setRejectJustification("")
  }, [rejectingId, rejectJustification, handleTriage])

  // Bulk actions
  const handleBulkAction = useCallback(
    (decision: TriageDecision, justification: string | null = null) => {
      const ids = Array.from(selectedIds)
      dispatch({ type: "TRIAGE_BULK", issueIds: ids, decision, justification })
      logAuditClient({
        action: "triage.bulk_action",
        entityType: "dataset",
        entityId: state.datasetId ?? undefined,
        metadata: { decision, count: ids.length, justification },
      })
      toast.success(`${ids.length} issue${ids.length !== 1 ? "s" : ""} ${decision === "accept" ? "accepted" : decision === "reject" ? "rejected" : "deferred"}`)
      setSelectedIds(new Set())
    },
    [selectedIds, dispatch, state.datasetId]
  )

  const handleBulkRejectConfirm = useCallback(() => {
    if (!bulkRejectJustification.trim()) return
    handleBulkAction("reject", bulkRejectJustification.trim())
    setBulkRejectOpen(false)
    setBulkRejectJustification("")
  }, [bulkRejectJustification, handleBulkAction])

  // Checkbox logic
  const allFilteredSelected =
    filteredIssues.length > 0 && filteredIssues.every((i) => selectedIds.has(i.id))
  const someFilteredSelected =
    filteredIssues.some((i) => selectedIds.has(i.id)) && !allFilteredSelected

  const handleSelectAll = useCallback(() => {
    if (allFilteredSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredIssues.map((i) => i.id)))
    }
  }, [allFilteredSelected, filteredIssues])

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // Indeterminate checkbox ref
  const selectAllRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someFilteredSelected
    }
  }, [someFilteredSelected])

  // --- Completed state ---
  if (state.stages.review.completed) {
    return (
      <Card className="rounded-2xl animate-fade-up" data-onboarding="issue-triage">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="size-5 text-green-600" />
            Review Complete
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{state.stages.review.summary}</p>
          <button
            onClick={() => dispatch({ type: "GO_TO_STAGE", stage: "clean" })}
            className="group inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-all hover:opacity-90 active:scale-[0.98]"
          >
            Continue to Clean
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        </CardContent>
      </Card>
    )
  }

  // --- Skipped state ---
  if (state.stages.review.skipped) {
    return (
      <Card className="rounded-2xl animate-fade-up">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-amber-500" />
            Review Skipped
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Issues were not reviewed before continuing.</p>
          <button
            onClick={() => dispatch({ type: "GO_TO_STAGE", stage: "clean" })}
            className="group inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-all hover:opacity-90 active:scale-[0.98]"
          >
            Continue to Clean
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        </CardContent>
      </Card>
    )
  }

  // --- Active review state ---
  return (
    <>
      <Card className="rounded-2xl animate-fade-up" data-onboarding="issue-triage">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="size-5" />
            Review Issues
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Reviewed: {progress.reviewed}/{progress.total} issues &mdash;{" "}
                {progress.accepted} accepted, {progress.rejected} rejected, {progress.deferred} deferred
              </span>
              <span className="font-semibold text-foreground">{progressPercent}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-green-500 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Severity filter tabs */}
          <div className="flex flex-wrap gap-2">
            {(["all", "critical", "warning", "info"] as const).map((sev) => {
              const isActive = activeSeverity === sev
              const count = severityCounts[sev]
              const colors: Record<string, string> = {
                all: isActive ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/80",
                critical: isActive ? "bg-red-600 text-white" : "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400",
                warning: isActive ? "bg-amber-500 text-white" : "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400",
                info: isActive ? "bg-blue-600 text-white" : "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400",
              }
              return (
                <button
                  key={sev}
                  onClick={() => handleSeverityChange(sev)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer",
                    colors[sev]
                  )}
                >
                  {sev === "all" ? "All" : sev.charAt(0).toUpperCase() + sev.slice(1)}
                  <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-bold", isActive ? "bg-white/20" : "bg-black/5 dark:bg-white/10")}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Issue table */}
          {filteredIssues.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              No issues match this filter.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="w-10 px-3 py-2.5">
                      <input
                        ref={selectAllRef}
                        type="checkbox"
                        checked={allFilteredSelected}
                        onChange={handleSelectAll}
                        className="size-4 cursor-pointer rounded border-muted-foreground/30"
                      />
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Type</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Severity</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Row</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Column</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Message</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Status</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIssues.map(({ issue, id }) => {
                    const entry = state.triageDecisions[id]
                    const decisionStyle = entry ? DECISION_STYLES[entry.decision] : null

                    return (
                      <IssueRow
                        key={id}
                        id={id}
                        issue={issue}
                        entry={entry ? { decision: entry.decision, justification: entry.justification } : null}
                        decisionStyle={decisionStyle}
                        isSelected={selectedIds.has(id)}
                        isRejecting={rejectingId === id}
                        rejectJustification={rejectJustification}
                        onToggleSelect={() => toggleSelect(id)}
                        onAccept={() => handleTriage(id, "accept")}
                        onReject={() => {
                          setRejectingId(id)
                          setRejectJustification("")
                        }}
                        onDefer={() => handleTriage(id, "defer")}
                        onRejectJustificationChange={setRejectJustification}
                        onRejectConfirm={handleRejectConfirm}
                        onRejectCancel={() => {
                          setRejectingId(null)
                          setRejectJustification("")
                        }}
                      />
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => dispatch({ type: "GO_TO_STAGE", stage: "validate" })}
              className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted cursor-pointer"
            >
              <ArrowLeft className="size-3.5" />
              Back
            </button>
            <button
              onClick={() => dispatch({ type: "REVIEW_COMPLETE" })}
              disabled={!isComplete}
              className={cn(
                "group inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all",
                isComplete
                  ? "bg-foreground text-background hover:opacity-90 active:scale-[0.98] cursor-pointer"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              Complete Review
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </button>
            <button
              onClick={() => dispatch({ type: "SKIP_REVIEW" })}
              className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted cursor-pointer"
            >
              <SkipForward className="size-3.5" />
              Skip Review
              {progress.total - progress.reviewed > 0 && (
                <span className="text-xs text-muted-foreground">
                  ({progress.total - progress.reviewed} issue{progress.total - progress.reviewed !== 1 ? "s" : ""} not reviewed)
                </span>
              )}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Floating bulk action toolbar */}
      <div
        className={cn(
          "fixed bottom-6 left-1/2 -translate-x-1/2 z-50",
          "flex items-center gap-3 rounded-2xl border bg-card px-5 py-3 shadow-lg",
          "transition-all duration-200",
          selectedIds.size > 0
            ? "translate-y-0 opacity-100"
            : "translate-y-4 opacity-0 pointer-events-none"
        )}
      >
        <span className="text-sm font-semibold text-foreground">
          {selectedIds.size} selected
        </span>
        <div className="h-5 w-px bg-border" />
        <button
          onClick={() => handleBulkAction("accept")}
          className="inline-flex items-center gap-1.5 rounded-lg bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-700 transition-colors hover:bg-green-200 dark:bg-green-900/50 dark:text-green-300 cursor-pointer"
        >
          <Check className="size-3.5" />
          Accept All
        </button>
        <button
          onClick={() => {
            setBulkRejectOpen(true)
            setBulkRejectJustification("")
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-200 dark:bg-red-900/50 dark:text-red-300 cursor-pointer"
        >
          <X className="size-3.5" />
          Reject All
        </button>
        <button
          onClick={() => handleBulkAction("defer")}
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-200 dark:bg-amber-900/50 dark:text-amber-300 cursor-pointer"
        >
          <Clock className="size-3.5" />
          Defer All
        </button>
        <div className="h-5 w-px bg-border" />
        <button
          onClick={() => setSelectedIds(new Set())}
          className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted cursor-pointer"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Bulk reject dialog */}
      <Dialog open={bulkRejectOpen} onOpenChange={setBulkRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject {selectedIds.size} Issues</DialogTitle>
            <DialogDescription>
              Provide a shared justification for rejecting these issues. This will be recorded in the audit trail.
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={bulkRejectJustification}
            onChange={(e) => setBulkRejectJustification(e.target.value)}
            placeholder="Reason for rejection (required)"
            rows={3}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <DialogFooter>
            <button
              onClick={() => setBulkRejectOpen(false)}
              className="inline-flex items-center rounded-xl border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleBulkRejectConfirm}
              disabled={!bulkRejectJustification.trim()}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all cursor-pointer",
                bulkRejectJustification.trim()
                  ? "bg-red-600 text-white hover:bg-red-700 active:scale-[0.98]"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              <X className="size-3.5" />
              Reject All
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// --- Sub-component: IssueRow ---

interface IssueRowProps {
  id: string
  issue: ValidationIssue
  entry: { decision: TriageDecision; justification: string | null } | null
  decisionStyle: { badge: string; row: string; label: string } | null
  isSelected: boolean
  isRejecting: boolean
  rejectJustification: string
  onToggleSelect: () => void
  onAccept: () => void
  onReject: () => void
  onDefer: () => void
  onRejectJustificationChange: (val: string) => void
  onRejectConfirm: () => void
  onRejectCancel: () => void
}

function IssueRow({
  id,
  issue,
  entry,
  decisionStyle,
  isSelected,
  isRejecting,
  rejectJustification,
  onToggleSelect,
  onAccept,
  onReject,
  onDefer,
  onRejectJustificationChange,
  onRejectConfirm,
  onRejectCancel,
}: IssueRowProps) {
  return (
    <>
      <tr className={cn("border-b transition-colors", decisionStyle ? decisionStyle.row : "hover:bg-muted/30")}>
        <td className="px-3 py-2.5">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="size-4 cursor-pointer rounded border-muted-foreground/30"
          />
        </td>
        <td className="px-3 py-2.5">
          <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium", TYPE_COLORS[issue.type] ?? "bg-muted text-muted-foreground")}>
            {issue.type.replace("_", " ")}
          </span>
        </td>
        <td className="px-3 py-2.5">
          <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium", SEVERITY_COLORS[issue.severity]?.badge)}>
            {issue.severity}
          </span>
        </td>
        <td className="px-3 py-2.5 text-xs text-muted-foreground">{issue.row ?? "-"}</td>
        <td className="px-3 py-2.5 text-xs text-muted-foreground">{issue.column ?? "-"}</td>
        <td className="max-w-[260px] truncate px-3 py-2.5 text-xs" title={issue.message}>
          {issue.message}
        </td>
        <td className="px-3 py-2.5">
          {decisionStyle ? (
            <Badge className={decisionStyle.badge}>{decisionStyle.label}</Badge>
          ) : (
            <span className="text-[11px] text-muted-foreground">Pending</span>
          )}
        </td>
        <td className="px-3 py-2.5">
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={onAccept}
              title="Accept"
              className={cn(
                "flex size-8 items-center justify-center rounded-lg transition-colors cursor-pointer",
                entry?.decision === "accept"
                  ? "bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-300"
                  : "text-muted-foreground hover:bg-green-100 hover:text-green-700 dark:hover:bg-green-900/50"
              )}
            >
              <Check className="size-4" />
            </button>
            <button
              onClick={onReject}
              title="Reject"
              className={cn(
                "flex size-8 items-center justify-center rounded-lg transition-colors cursor-pointer",
                entry?.decision === "reject"
                  ? "bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-300"
                  : "text-muted-foreground hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-900/50"
              )}
            >
              <X className="size-4" />
            </button>
            <button
              onClick={onDefer}
              title="Defer"
              className={cn(
                "flex size-8 items-center justify-center rounded-lg transition-colors cursor-pointer",
                entry?.decision === "defer"
                  ? "bg-amber-200 text-amber-800 dark:bg-amber-900 dark:text-amber-300"
                  : "text-muted-foreground hover:bg-amber-100 hover:text-amber-700 dark:hover:bg-amber-900/50"
              )}
            >
              <Clock className="size-4" />
            </button>
          </div>
        </td>
      </tr>
      {/* Inline reject justification row */}
      {isRejecting && (
        <tr className="border-b bg-red-50/30 dark:bg-red-950/10">
          <td colSpan={8} className="px-3 py-2.5">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={rejectJustification}
                onChange={(e) => onRejectJustificationChange(e.target.value)}
                placeholder="Reason for rejection (required)"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && rejectJustification.trim()) onRejectConfirm()
                  if (e.key === "Escape") onRejectCancel()
                }}
                className="flex-1 rounded-lg border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                onClick={onRejectConfirm}
                disabled={!rejectJustification.trim()}
                className={cn(
                  "inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer",
                  rejectJustification.trim()
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                )}
              >
                <Check className="size-3" />
                Confirm
              </button>
              <button
                onClick={onRejectCancel}
                className="inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
