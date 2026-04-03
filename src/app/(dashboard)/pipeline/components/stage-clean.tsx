"use client"

import { useState } from "react"
import {
  Sparkles,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  SkipForward,
  Wrench,
  ExternalLink,
  Zap,
  Brain,
  Loader2,
  Check,
  X,
  ChevronDown,
  Info,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { setPipelineHandoff } from "@/lib/pipeline-handoff"
import { autoClean, type CleanAction, type CleanResult } from "../lib/auto-clean"
import type { ValidationIssue } from "../lib/client-validate"
import type { PipelineState, PipelineAction } from "../lib/pipeline-state"
import { logAuditClient } from "@/lib/audit-client"

interface StageCleanProps {
  state: PipelineState
  dispatch: React.Dispatch<PipelineAction>
  validationIssues: ValidationIssue[]
}

const TRANSFORM_TOOLS = [
  {
    title: "CRS Conversion",
    description: "Convert coordinate reference systems",
    href: "/tools/transform/crs",
  },
  {
    title: "Merge Files",
    description: "Combine multiple datasets into one",
    href: "/tools/transform/merge",
  },
  {
    title: "Split Dataset",
    description: "Split dataset by column values or ranges",
    href: "/tools/transform/split",
  },
]

interface AiSuggestion {
  row: number
  column: string
  currentValue: string
  suggestedValue: string
  confidence: number
  explanation: string
  accepted?: boolean
}

export function StageClean({ state, dispatch, validationIssues }: StageCleanProps) {
  const [cleanResult, setCleanResult] = useState<CleanResult | null>(null)
  const [cleaning, setCleaning] = useState(false)
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestion[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiRanWithNoResults, setAiRanWithNoResults] = useState(false)
  const [showAllActions, setShowAllActions] = useState(false)

  const hasIssues = validationIssues.length > 0 || (state.issueCount !== null && state.issueCount > 0)
  const validationSkipped = state.stages.validate.skipped

  // --- Auto-clean ---
  async function handleAutoClean() {
    if (!state.parsedData || state.parsedData.length < 2) return

    setCleaning(true)
    const minDelay = new Promise((r) => setTimeout(r, 1200))

    const [result] = await Promise.all([
      Promise.resolve(autoClean(state.parsedData, validationIssues)),
      minDelay,
    ])

    setCleanResult(result)
    setCleaning(false)

    if (result.summary.totalActions > 0) {
      logAuditClient({
        action: "clean.auto",
        entityType: "dataset",
        entityId: state.datasetId ?? undefined,
        metadata: {
          fileName: state.fileName,
          duplicatesRemoved: result.summary.duplicatesRemoved,
          rowsReordered: result.summary.rowsReordered,
          valuesInterpolated: result.summary.valuesInterpolated,
          spikesRemoved: result.summary.spikesRemoved,
          totalActions: result.summary.totalActions,
          unresolvedCount: result.unresolved.length,
        },
      })
    }
  }

  // --- AI assist ---
  async function handleAiAssist() {
    if (!cleanResult || cleanResult.unresolved.length === 0) return

    setAiLoading(true)
    setAiError(null)

    try {
      // Build context: header + rows around unresolved issues
      const data = cleanResult.data
      const headers = data[0]
      const issueRows = new Set(
        cleanResult.unresolved.filter((i) => i.row).map((i) => i.row! - 1) // convert to 0-indexed data row
      )

      // Collect context rows (issue rows + neighbors)
      const contextRowIndices = new Set<number>()
      contextRowIndices.add(0) // header
      for (const rowIdx of issueRows) {
        for (let j = Math.max(1, rowIdx - 2); j <= Math.min(data.length - 1, rowIdx + 2); j++) {
          contextRowIndices.add(j)
        }
      }
      const contextRows = [...contextRowIndices].sort((a, b) => a - b).map((i) => data[i])

      const response = await fetch("/api/ai-clean", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issues: cleanResult.unresolved.map((i) => ({
            type: i.type,
            severity: i.severity,
            row: i.row,
            column: i.column,
            message: i.detail || i.message,
          })),
          contextRows,
          headers,
          fileName: state.fileName || "dataset",
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error || `AI request failed (${response.status})`)
      }

      const result = await response.json()
      const suggestions = result.suggestions || []
      setAiSuggestions(suggestions)
      if (suggestions.length === 0) {
        setAiRanWithNoResults(true)
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "AI cleaning failed")
    } finally {
      setAiLoading(false)
    }
  }

  // --- Apply AI suggestion ---
  function handleAcceptSuggestion(idx: number) {
    const suggestion = aiSuggestions[idx]
    if (!cleanResult) return

    const data = cleanResult.data.map((r) => [...r])
    const headers = data[0]
    const colIdx = headers.findIndex(
      (h) => h.toLowerCase() === suggestion.column.toLowerCase()
    )
    if (colIdx === -1) return

    // Row numbers are 1-indexed with header, so row 2 = data[1]
    const dataRowIdx = suggestion.row - 1
    if (dataRowIdx >= 0 && dataRowIdx < data.length) {
      data[dataRowIdx][colIdx] = suggestion.suggestedValue
    }

    setCleanResult({ ...cleanResult, data })
    setAiSuggestions((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, accepted: true } : s))
    )

    // Update pipeline state with new data
    dispatch({ type: "AI_FIX_APPLIED", updatedData: data })

    logAuditClient({
      action: "clean.ai_fix",
      entityType: "dataset",
      entityId: state.datasetId ?? undefined,
      metadata: {
        row: suggestion.row,
        column: suggestion.column,
        before: suggestion.currentValue,
        after: suggestion.suggestedValue,
        confidence: suggestion.confidence,
        explanation: suggestion.explanation,
      },
    })
  }

  function handleRejectSuggestion(idx: number) {
    const suggestion = aiSuggestions[idx]
    setAiSuggestions((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, accepted: false } : s))
    )

    logAuditClient({
      action: "clean.ai_reject",
      entityType: "dataset",
      entityId: state.datasetId ?? undefined,
      metadata: {
        row: suggestion.row,
        column: suggestion.column,
        suggestedValue: suggestion.suggestedValue,
        confidence: suggestion.confidence,
      },
    })
  }

  // --- Finalize and continue ---
  function handleFinalize() {
    const finalData = cleanResult?.data || state.parsedData
    if (!finalData) return

    dispatch({
      type: "CLEAN_COMPLETE",
      cleanedData: finalData,
      actionCount: (cleanResult?.summary.totalActions ?? 0) +
        aiSuggestions.filter((s) => s.accepted === true).length,
    })
  }

  // --- Completed state (revisiting) ---
  if (state.stages.clean.completed) {
    return (
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="size-5 text-green-600" />
            Clean Complete
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            {state.stages.clean.summary}
          </p>
          <TransformToolLinks fileName={state.fileName} parsedData={state.parsedData} />
          <button
            onClick={() =>
              dispatch({ type: "GO_TO_STAGE", stage: "export" })
            }
            className="group inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-all hover:opacity-90 active:scale-[0.98]"
          >
            Continue to Export
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        </CardContent>
      </Card>
    )
  }

  // --- Skipped state (revisiting) ---
  if (state.stages.clean.skipped) {
    return (
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-amber-500" />
            Clean Skipped
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            No cleaning was applied to this dataset.
          </p>
          <TransformToolLinks fileName={state.fileName} parsedData={state.parsedData} />
          <button
            onClick={() =>
              dispatch({ type: "GO_TO_STAGE", stage: "export" })
            }
            className="group inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-all hover:opacity-90 active:scale-[0.98]"
          >
            Continue to Export
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        </CardContent>
      </Card>
    )
  }

  // --- Loading state ---
  if (cleaning) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="flex flex-col items-center justify-center py-16 animate-fade-up">
          <div className="relative flex size-14 items-center justify-center">
            <div className="absolute inset-0 animate-spin rounded-full border-2 border-muted border-t-foreground" />
            <Zap className="size-5 text-foreground" />
          </div>
          <p className="mt-5 text-sm font-semibold text-foreground">
            Auto-cleaning data...
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Removing duplicates, reordering, interpolating gaps, fixing spikes
          </p>
        </CardContent>
      </Card>
    )
  }

  // --- Auto-clean results ---
  if (cleanResult) {
    const { summary, actions, unresolved } = cleanResult
    const displayActions = showAllActions ? actions : actions.slice(0, 6)

    return (
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-5" />
            Clean Data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Auto-clean summary */}
          {summary.totalActions > 0 ? (
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30">
              <div className="flex items-center gap-2">
                <Zap className="size-4 text-green-600 dark:text-green-400" />
                <p className="text-sm font-semibold text-green-700 dark:text-green-300">
                  Auto-Clean: {summary.totalActions} fix{summary.totalActions !== 1 ? "es" : ""} applied
                </p>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {summary.duplicatesRemoved > 0 && (
                  <Badge>{summary.duplicatesRemoved} duplicates removed</Badge>
                )}
                {summary.rowsReordered && <Badge>KP rows reordered</Badge>}
                {summary.valuesInterpolated > 0 && (
                  <Badge>{summary.valuesInterpolated} gaps interpolated</Badge>
                )}
                {summary.spikesRemoved > 0 && (
                  <Badge>{summary.spikesRemoved} spikes fixed</Badge>
                )}
                {summary.missingFilled > 0 && (
                  <Badge>{summary.missingFilled} values filled</Badge>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30">
              <CheckCircle className="size-5 text-green-600 dark:text-green-400" />
              <div>
                <p className="text-sm font-medium text-green-700 dark:text-green-300">
                  No automatic fixes needed
                </p>
                <p className="text-xs text-green-600 dark:text-green-400">
                  Data passed all deterministic checks.
                </p>
              </div>
            </div>
          )}

          {/* Action changelog */}
          {actions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Changes Made
              </p>
              <div className="max-h-52 space-y-1 overflow-auto">
                {displayActions.map((action, idx) => (
                  <ActionRow key={idx} action={action} />
                ))}
              </div>
              {actions.length > 6 && (
                <button
                  onClick={() => setShowAllActions(!showAllActions)}
                  className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronDown className={`size-3 transition-transform ${showAllActions ? "rotate-180" : ""}`} />
                  {showAllActions ? "Show less" : `Show all ${actions.length} changes`}
                </button>
              )}
            </div>
          )}

          {/* Unresolved issues — offer AI assist */}
          {unresolved.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
                <AlertTriangle className="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
                <div>
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                    {unresolved.length} issue{unresolved.length !== 1 ? "s" : ""} need attention
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    These require human judgment or AI assistance to resolve.
                  </p>
                </div>
              </div>

              {!aiLoading && aiSuggestions.length === 0 && !aiError && !aiRanWithNoResults && (
                <button
                  onClick={handleAiAssist}
                  className="group inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-5 py-2.5 text-sm font-semibold text-violet-700 transition-all hover:bg-violet-100 active:scale-[0.98] dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-300 dark:hover:bg-violet-900/50"
                >
                  <Brain className="size-4" />
                  AI Assist — Analyze Remaining Issues
                </button>
              )}

              {aiRanWithNoResults && aiSuggestions.length === 0 && (
                <div className="flex items-start gap-3 rounded-xl border border-muted bg-muted/30 p-4">
                  <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      AI could not suggest automatic fixes
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      The remaining issue requires manual review. You can safely continue — it will be noted in the export.
                    </p>
                  </div>
                </div>
              )}

              {aiError && (
                <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/30">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-500" />
                  <p className="text-xs text-red-700 dark:text-red-300">{aiError}</p>
                </div>
              )}

              {/* AI loading */}
              {aiLoading && (
                <div className="flex items-center gap-3 rounded-xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-800 dark:bg-violet-950/30">
                  <div className="relative flex size-8 items-center justify-center">
                    <div className="absolute inset-0 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600 dark:border-violet-800 dark:border-t-violet-400" />
                    <Brain className="size-3.5 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-violet-700 dark:text-violet-300">
                      AI analyzing issues...
                    </p>
                    <p className="text-xs text-violet-600 dark:text-violet-400">
                      Reviewing data context and suggesting fixes
                    </p>
                  </div>
                </div>
              )}

              {/* AI suggestions */}
              {aiSuggestions.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Brain className="size-3.5 text-violet-600" />
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      AI Suggestions
                    </p>
                  </div>
                  <div className="max-h-64 space-y-2 overflow-auto">
                    {aiSuggestions.map((suggestion, idx) => (
                      <SuggestionCard
                        key={idx}
                        suggestion={suggestion}
                        onAccept={() => handleAcceptSuggestion(idx)}
                        onReject={() => handleRejectSuggestion(idx)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Transform tools */}
          <TransformToolLinks fileName={state.fileName} parsedData={cleanResult.data} />

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() =>
                dispatch({ type: "GO_TO_STAGE", stage: "validate" })
              }
            >
              <ArrowLeft className="mr-2 size-4" />
              Back
            </Button>
            <button
              onClick={handleFinalize}
              className="group inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-all hover:opacity-90 active:scale-[0.98]"
            >
              Accept & Continue to Export
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </button>
            <Button
              variant="outline"
              onClick={() => dispatch({ type: "SKIP_CLEAN" })}
            >
              <SkipForward className="mr-2 size-4" />
              Skip
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // --- Initial state ---
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-5" />
          Clean Data
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {hasIssues ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
              <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                  {state.issueCount ?? validationIssues.length} issue{(state.issueCount ?? validationIssues.length) !== 1 ? "s" : ""} detected
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Run auto-clean to fix common issues automatically, then use AI for complex cases.
                </p>
              </div>
            </div>

            {/* Two-tier explanation */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border p-4">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-foreground/5">
                    <Zap className="size-4 text-foreground" />
                  </div>
                  <p className="text-sm font-semibold">Auto-Clean</p>
                </div>
                <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                  <li>Remove duplicate rows</li>
                  <li>Reorder KP sequence</li>
                  <li>Interpolate small gaps</li>
                  <li>Fix obvious spikes</li>
                  <li>Standardize formats</li>
                </ul>
              </div>
              <div className="rounded-xl border border-violet-200 p-4 dark:border-violet-800">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-950/50">
                    <Brain className="size-4 text-violet-600 dark:text-violet-400" />
                  </div>
                  <p className="text-sm font-semibold">AI Assist</p>
                </div>
                <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                  <li>Wide gap interpolation</li>
                  <li>Suspicious outlier analysis</li>
                  <li>Cross-column consistency</li>
                  <li>Context-aware suggestions</li>
                  <li>Approve/reject each fix</li>
                </ul>
              </div>
            </div>
          </div>
        ) : validationSkipped ? (
          <div className="flex items-center gap-3 rounded-xl border bg-muted/30 p-4">
            <AlertTriangle className="size-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Validation was skipped</p>
              <p className="text-xs text-muted-foreground">
                Run auto-clean anyway to check for duplicates, ordering, and formatting issues.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30">
            <CheckCircle className="size-5 text-green-600 dark:text-green-400" />
            <div>
              <p className="text-sm font-medium text-green-700 dark:text-green-300">
                No issues detected
              </p>
              <p className="text-xs text-green-600 dark:text-green-400">
                You can still run auto-clean for formatting and standardization.
              </p>
            </div>
          </div>
        )}

        {/* Transform tools */}
        <TransformToolLinks fileName={state.fileName} parsedData={state.parsedData} />

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() =>
              dispatch({ type: "GO_TO_STAGE", stage: "validate" })
            }
          >
            <ArrowLeft className="mr-2 size-4" />
            Back
          </Button>
          <button
            onClick={handleAutoClean}
            className="group inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-all hover:opacity-90 active:scale-[0.98]"
          >
            <Zap className="size-3.5" />
            Run Auto-Clean
          </button>
          <Button
            variant="outline"
            onClick={() =>
              dispatch({ type: "GO_TO_STAGE", stage: "export" })
            }
          >
            <SkipForward className="mr-2 size-4" />
            Skip to Export
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// --- Sub-components ---

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-lg bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/50 dark:text-green-300">
      {children}
    </span>
  )
}

const ACTION_ICONS: Record<CleanAction["type"], typeof Zap> = {
  remove_duplicate: X,
  reorder_kp: ArrowRight,
  interpolate: Sparkles,
  remove_spike: AlertTriangle,
  fill_missing: Check,
  standardize: Wrench,
}

function ActionRow({ action }: { action: CleanAction }) {
  const Icon = ACTION_ICONS[action.type] || Info
  const isHigh = action.confidence === "high"

  return (
    <div className="flex items-start gap-2.5 rounded-lg border bg-card px-3 py-2">
      <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-foreground">{action.explanation}</p>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
          {action.column && <span>Column: {action.column}</span>}
          {action.row > 0 && <span>Row {action.row}</span>}
          <span
            className={`rounded px-1 py-0.5 ${
              isHigh
                ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
                : "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
            }`}
          >
            {isHigh ? "High" : "Medium"} confidence
          </span>
        </div>
      </div>
    </div>
  )
}

function SuggestionCard({
  suggestion,
  onAccept,
  onReject,
}: {
  suggestion: AiSuggestion
  onAccept: () => void
  onReject: () => void
}) {
  const accepted = suggestion.accepted
  const rejected = suggestion.accepted === false
  const resolved = accepted !== undefined

  return (
    <div
      className={`rounded-xl border p-3 transition-colors ${
        accepted
          ? "border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20"
          : rejected
          ? "border-muted bg-muted/30 opacity-60"
          : "border-violet-200 bg-violet-50/50 dark:border-violet-800 dark:bg-violet-950/20"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-foreground">
            Row {suggestion.row} · {suggestion.column}
          </p>
          <div className="mt-1 flex items-center gap-2 text-xs">
            <span className="rounded bg-red-100 px-1.5 py-0.5 font-mono text-red-700 line-through dark:bg-red-900/50 dark:text-red-300">
              {suggestion.currentValue || "(empty)"}
            </span>
            <ArrowRight className="size-3 text-muted-foreground" />
            <span className="rounded bg-green-100 px-1.5 py-0.5 font-mono text-green-700 dark:bg-green-900/50 dark:text-green-300">
              {suggestion.suggestedValue}
            </span>
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {suggestion.explanation}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <ConfidenceBar confidence={suggestion.confidence} />
            <span className="text-[10px] text-muted-foreground">
              {Math.round(suggestion.confidence * 100)}% confidence
            </span>
          </div>
        </div>

        {!resolved && (
          <div className="flex shrink-0 gap-1">
            <button
              onClick={onAccept}
              className="flex size-7 items-center justify-center rounded-lg bg-green-100 text-green-700 transition-colors hover:bg-green-200 dark:bg-green-900/50 dark:text-green-300 dark:hover:bg-green-900"
            >
              <Check className="size-3.5" />
            </button>
            <button
              onClick={onReject}
              className="flex size-7 items-center justify-center rounded-lg bg-red-100 text-red-600 transition-colors hover:bg-red-200 dark:bg-red-900/50 dark:text-red-300 dark:hover:bg-red-900"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}

        {accepted && (
          <span className="shrink-0 rounded-lg bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-900/50 dark:text-green-300">
            Applied
          </span>
        )}
        {rejected && (
          <span className="shrink-0 rounded-lg bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
            Rejected
          </span>
        )}
      </div>
    </div>
  )
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100)
  const color =
    pct >= 70
      ? "bg-green-500"
      : pct >= 40
      ? "bg-amber-500"
      : "bg-red-500"

  return (
    <div className="h-1.5 w-16 rounded-full bg-muted">
      <div
        className={`h-1.5 rounded-full transition-all ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function TransformToolLinks({
  fileName,
  parsedData,
}: {
  fileName: string | null
  parsedData: string[][] | null
}) {
  function handleToolClick(href: string) {
    if (parsedData && parsedData.length > 1 && fileName) {
      setPipelineHandoff(fileName, parsedData)
    }
    window.open(href, "_blank")
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Transform Tools
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        {TRANSFORM_TOOLS.map((tool) => (
          <button
            key={tool.href}
            onClick={() => handleToolClick(tool.href)}
            className="group flex items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
          >
            <Wrench className="mt-0.5 size-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium group-hover:text-foreground">
                {tool.title}
              </p>
              <p className="text-xs text-muted-foreground">
                {tool.description}
              </p>
            </div>
            <ExternalLink className="size-3 shrink-0 text-muted-foreground/50" />
          </button>
        ))}
      </div>
    </div>
  )
}
