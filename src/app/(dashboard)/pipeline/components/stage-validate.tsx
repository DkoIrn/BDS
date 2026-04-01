"use client"

import { useState } from "react"
import {
  ShieldCheck,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  SkipForward,
  CheckCircle,
  Info,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { StagePanelProps } from "./stage-import"
import {
  validateClientSide,
  type ValidationIssue,
  type ValidationResult,
} from "../lib/client-validate"

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

export function StageValidate({ state, dispatch }: StagePanelProps) {
  const [validating, setValidating] = useState(false)
  const [result, setResult] = useState<ValidationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleRunQC() {
    setValidating(true)
    setError(null)
    dispatch({ type: "VALIDATE_START" })

    // Minimum animation time
    const minDelay = new Promise((r) => setTimeout(r, 1500))

    try {
      if (state.datasetId) {
        // Existing dataset — use backend
        const [response] = await Promise.all([
          fetch("/api/validate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ datasetId: state.datasetId }),
          }),
          minDelay,
        ]) as [Response, unknown]

        if (!response.ok) {
          const data = await response.json().catch(() => null)
          throw new Error(data?.error || `Validation failed (${response.status})`)
        }

        const data = await response.json()
        dispatch({
          type: "VALIDATE_COMPLETE",
          runId: data.datasetId || state.datasetId || "run",
          issueCount: 0,
        })
      } else if (state.parsedData && state.parsedData.length > 1) {
        // Uploaded file — run client-side validation
        const [validationResult] = await Promise.all([
          Promise.resolve(validateClientSide(state.parsedData)),
          minDelay,
        ])

        setResult(validationResult)
        dispatch({
          type: "VALIDATE_COMPLETE",
          runId: "client",
          issueCount: validationResult.summary.total,
        })
      } else {
        await minDelay
        throw new Error("No data available to validate.")
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Validation failed"
      setError(message)
    } finally {
      setValidating(false)
    }
  }

  // Skipped state (revisiting)
  if (state.stages.validate.skipped) {
    return (
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-amber-500" />
            Validation Skipped
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Quality checks were not run on this dataset.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleRunQC}
              className="group inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-all hover:opacity-90 active:scale-[0.98]"
            >
              <ShieldCheck className="size-3.5" />
              Run Validation Now
            </button>
            <Button
              variant="outline"
              onClick={() =>
                dispatch({ type: "GO_TO_STAGE", stage: "clean" })
              }
            >
              <ArrowRight className="mr-2 size-4" />
              Continue
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Completed state
  if (state.stages.validate.completed) {
    const passed = state.issueCount === 0

    return (
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {passed ? (
              <ShieldCheck className="size-5 text-green-600" />
            ) : (
              <AlertTriangle className="size-5 text-amber-500" />
            )}
            Validation Complete
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {passed ? (
            <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30">
              <CheckCircle className="size-5 text-green-600 dark:text-green-400" />
              <div>
                <p className="text-sm font-medium text-green-700 dark:text-green-300">
                  All checks passed
                </p>
                <p className="text-xs text-green-600 dark:text-green-400">
                  No quality issues detected in your dataset.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
                <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400" />
                <div>
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                    {state.issueCount} issue{state.issueCount !== 1 ? "s" : ""}{" "}
                    found
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Review issues below, then continue to the Clean stage.
                  </p>
                </div>
              </div>
              {result && <IssuesList issues={result.issues} summary={result.summary} />}
            </>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() =>
                dispatch({ type: "GO_TO_STAGE", stage: "clean" })
              }
              className="group inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-all hover:opacity-90 active:scale-[0.98]"
            >
              Continue to Clean
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </button>
            <Button
              variant="outline"
              onClick={() =>
                dispatch({ type: "GO_TO_STAGE", stage: "export" })
              }
            >
              <SkipForward className="mr-2 size-4" />
              Skip Clean, Go to Export
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Loading state
  if (validating) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="flex flex-col items-center justify-center py-16 animate-fade-up">
          <div className="relative flex size-14 items-center justify-center">
            <div className="absolute inset-0 animate-spin rounded-full border-2 border-muted border-t-foreground" />
            <ShieldCheck className="size-5 text-foreground" />
          </div>
          <p className="mt-5 text-sm font-semibold text-foreground">
            Running quality checks...
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Scanning {state.rowCount?.toLocaleString()} rows across{" "}
            {state.columnCount} columns
          </p>
        </CardContent>
      </Card>
    )
  }

  // Initial state -- not yet validated
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-5" />
          Validate Data
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-lg border bg-muted/30 p-4">
          <p className="text-sm">
            Ready to validate{" "}
            <span className="font-medium">
              {state.rowCount?.toLocaleString()} rows
            </span>{" "}
            across{" "}
            <span className="font-medium">{state.columnCount} columns</span>.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            QC checks: missing data, duplicates, outliers (z-score), and KP consistency.
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-500" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() =>
              dispatch({ type: "GO_TO_STAGE", stage: "inspect" })
            }
          >
            <ArrowLeft className="mr-2 size-4" />
            Back
          </Button>
          <button
            onClick={handleRunQC}
            className="group inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-all hover:opacity-90 active:scale-[0.98]"
          >
            <ShieldCheck className="size-3.5" />
            Run QC Validation
          </button>
          <Button
            variant="outline"
            onClick={() => dispatch({ type: "SKIP_VALIDATE" })}
          >
            <SkipForward className="mr-2 size-4" />
            Skip Validation
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Dataset will not be checked for quality issues if skipped.
        </p>
      </CardContent>
    </Card>
  )
}

function IssuesList({
  issues,
  summary,
}: {
  issues: ValidationIssue[]
  summary: ValidationResult["summary"]
}) {
  const [expanded, setExpanded] = useState(false)
  const displayIssues = expanded ? issues : issues.slice(0, 8)

  return (
    <div className="space-y-3">
      {/* Summary badges */}
      <div className="flex flex-wrap gap-2">
        {summary.critical > 0 && (
          <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ${SEVERITY_CONFIG.critical.badge}`}>
            {summary.critical} critical
          </span>
        )}
        {summary.warning > 0 && (
          <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ${SEVERITY_CONFIG.warning.badge}`}>
            {summary.warning} warning{summary.warning !== 1 ? "s" : ""}
          </span>
        )}
        {summary.info > 0 && (
          <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ${SEVERITY_CONFIG.info.badge}`}>
            {summary.info} info
          </span>
        )}
      </div>

      {/* Issue list */}
      <div className="max-h-64 space-y-1.5 overflow-auto">
        {displayIssues.map((issue, idx) => {
          const config = SEVERITY_CONFIG[issue.severity]
          return (
            <div
              key={idx}
              className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 ${config.border} ${config.bg}`}
            >
              {issue.severity === "critical" ? (
                <AlertTriangle className={`mt-0.5 size-3.5 shrink-0 ${config.text}`} />
              ) : issue.severity === "warning" ? (
                <AlertTriangle className={`mt-0.5 size-3.5 shrink-0 ${config.text}`} />
              ) : (
                <Info className={`mt-0.5 size-3.5 shrink-0 ${config.text}`} />
              )}
              <div className="min-w-0">
                <p className={`text-xs font-medium ${config.text}`}>
                  {issue.message}
                </p>
                {issue.column && issue.row && (
                  <p className={`text-[11px] ${config.sub}`}>
                    Column: {issue.column} · Row: {issue.row}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {issues.length > 8 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? "Show less" : `Show all ${issues.length} issues`}
        </button>
      )}
    </div>
  )
}
