"use client"

import { useState, useEffect, useMemo } from "react"
import dynamic from "next/dynamic"
import {
  ShieldCheck,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  SkipForward,
  CheckCircle,
  Info,
  X,
  MapPin,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import type { StagePanelProps } from "./stage-import"
import { PRESET_NAMES } from "../lib/pipeline-state"
import { CROSS_VALIDATION_PRESETS } from "../lib/cross-validation-presets"
import {
  validateClientSide,
  validateCrossDataset,
  type ValidationIssue,
  type ValidationResult,
} from "../lib/client-validate"
import { suggestProfileFromHeaders, getTemplateById } from "@/lib/validation/templates"
import { clusterIssues, adaptPipelineIssues } from "@/lib/ai/cluster-issues"
import { AISummaryPanel } from "@/components/files/ai-summary-panel"
import { IssueClusterRow } from "@/components/files/issue-cluster"
import { extractSpatialIssues } from "@/components/spatial-qc/lib/coordinate-extractor"
import { SEVERITY_HEAT_INTENSITY } from "@/components/spatial-qc/lib/severity-colors"
import type { IssueCluster } from "@/lib/ai/types"
import type { SpatialIssue } from "@/components/spatial-qc/lib/types"
import type { ColumnMapping, SurveyColumnType } from "@/lib/parsing/types"
import type { ValidationIssue as ServerValidationIssue } from "@/lib/types/validation"

const SpatialQCMap = dynamic(
  () => import("@/components/spatial-qc/spatial-qc-map").then((m) => ({ default: m.SpatialQCMap })),
  { ssr: false, loading: () => <Skeleton className="h-[500px] w-full rounded-2xl" /> }
)

/** Known spatial header patterns for auto-detecting coordinate columns */
const SPATIAL_HEADER_MAP: Record<string, SurveyColumnType> = {
  latitude: "latitude",
  lat: "latitude",
  longitude: "longitude",
  lon: "longitude",
  lng: "longitude",
  easting: "easting",
  east: "easting",
  northing: "northing",
  north: "northing",
}

/** Build ColumnMapping[] from headers using known spatial patterns */
function buildColumnMappingsFromHeaders(headers: string[]): ColumnMapping[] {
  return headers.map((h, idx) => {
    const lower = h.toLowerCase().trim()
    const mappedType = SPATIAL_HEADER_MAP[lower] ?? null
    return { index: idx, originalName: h, mappedType, ignored: false }
  })
}

/** Adapt pipeline client-side ValidationIssue to server-compatible shape */
function adaptToServerIssue(issue: ValidationIssue): ServerValidationIssue {
  return {
    id: "",
    run_id: "",
    dataset_id: "",
    row_number: issue.row ?? 0,
    column_name: issue.column ?? "",
    rule_type: issue.type,
    severity: issue.severity,
    message: issue.message,
    expected: null,
    actual: null,
    kp_value: issue.kpValue ?? null,
    created_at: "",
  }
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

interface StageValidateProps extends StagePanelProps {
  onIssuesFound?: (issues: ValidationIssue[]) => void
  validationIssues?: ValidationIssue[]
}

export function StageValidate({ state, dispatch, onIssuesFound, validationIssues }: StageValidateProps) {
  const [validating, setValidating] = useState(false)
  const [result, setResult] = useState<ValidationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [suggestedPackId, setSuggestedPackId] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [showMap, setShowMap] = useState(false)

  // Build column mappings from parsed data headers for spatial detection
  const pipelineMappings = useMemo(() => {
    if (!state.parsedData || state.parsedData.length === 0) return []
    return buildColumnMappingsFromHeaders(state.parsedData[0])
  }, [state.parsedData])

  const hasSpatial = useMemo(
    () => pipelineMappings.some((m) => m.mappedType === "latitude" || m.mappedType === "easting"),
    [pipelineMappings]
  )

  // Compute spatial issues for the map
  const { spatialIssues, heatmapPoints } = useMemo(() => {
    const issuesSource = result?.issues ?? validationIssues ?? []
    if (!hasSpatial || !state.parsedData || issuesSource.length === 0) {
      return { spatialIssues: [] as SpatialIssue[], heatmapPoints: [] as [number, number, number][] }
    }
    const serverIssues = issuesSource.map(adaptToServerIssue)
    const spatial = extractSpatialIssues(serverIssues, state.parsedData, pipelineMappings)
    const heat = spatial.map(
      (si) => [si.lat, si.lng, SEVERITY_HEAT_INTENSITY[si.issue.severity]] as [number, number, number]
    )
    return { spatialIssues: spatial, heatmapPoints: heat }
  }, [result?.issues, validationIssues, hasSpatial, state.parsedData, pipelineMappings])

  // Auto-suggest pack based on parsed data headers
  useEffect(() => {
    if (state.parsedData && state.parsedData.length > 0) {
      const headers = state.parsedData[0]
      const suggestion = suggestProfileFromHeaders(headers)
      if (suggestion !== "general-survey") {
        setSuggestedPackId(suggestion)
      } else {
        setSuggestedPackId(null)
      }
    }
  }, [state.parsedData])

  async function handleRunQC() {
    setValidating(true)
    setError(null)
    dispatch({ type: "VALIDATE_START" })

    // Minimum animation time
    const minDelay = new Promise((r) => setTimeout(r, 1500))

    try {
      if (state.datasetId) {
        // Existing dataset — use backend
        const requestBody: Record<string, unknown> = { datasetId: state.datasetId }
        // Include cross-dataset config if in cross-dataset mode
        if (state.crossDatasetMode && state.secondDatasetId) {
          requestBody.secondaryDatasetId = state.secondDatasetId
          requestBody.crossDatasetConfig = {
            preset_id: state.crossValidationPreset,
            dataset_type_a: state.datasetTypeA,
            dataset_type_b: state.datasetTypeB,
            tolerances: Object.keys(state.crossValidationTolerances).length > 0
              ? state.crossValidationTolerances
              : undefined,
          }
        }
        const [response] = await Promise.all([
          fetch("/api/validate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
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

        let allIssues = validationResult.issues

        // Cross-dataset validation: run if both datasets are parsed
        if (
          state.crossDatasetMode &&
          state.secondParsedData &&
          state.secondParsedData.length > 1 &&
          state.crossValidationPreset
        ) {
          const preset = CROSS_VALIDATION_PRESETS[state.crossValidationPreset]
          if (preset) {
            const crossIssues = validateCrossDataset(
              state.parsedData,
              state.secondParsedData,
              {
                preset,
                tolerances: state.crossValidationTolerances,
                datasetTypeA: state.datasetTypeA ?? "Dataset A",
                datasetTypeB: state.datasetTypeB ?? "Dataset B",
              }
            )
            allIssues = [...allIssues, ...crossIssues]
          }
        }

        const summary = {
          total: allIssues.length,
          critical: allIssues.filter((i) => i.severity === "critical").length,
          warning: allIssues.filter((i) => i.severity === "warning").length,
          info: allIssues.filter((i) => i.severity === "info").length,
        }
        const combinedResult = { issues: allIssues, summary }

        setResult(combinedResult)
        onIssuesFound?.(combinedResult.issues)
        dispatch({
          type: "VALIDATE_COMPLETE",
          runId: "client",
          issueCount: combinedResult.summary.total,
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
    const issuesSource = result?.issues ?? validationIssues ?? []
    const issueClusters: IssueCluster[] = issuesSource.length > 0
      ? clusterIssues(adaptPipelineIssues(issuesSource))
      : []
    const rowCount = state.parsedData?.length ? state.parsedData.length - 1 : 0
    const criticalCount = result?.summary?.critical ?? 0
    const computedPassRate = rowCount > 0
      ? ((rowCount - criticalCount) / rowCount) * 100
      : 100

    return (
      <Card className="rounded-2xl" data-onboarding="run-qc">
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
              {issueClusters.length > 0 && (
                <AISummaryPanel
                  clusters={issueClusters}
                  passRate={computedPassRate}
                  totalIssues={result?.summary.total ?? 0}
                  rowCount={rowCount}
                  fileName={state.fileName ?? "Pipeline dataset"}
                />
              )}
              {issueClusters.length > 0 ? (
                <ClusteredIssuesList clusters={issueClusters} />
              ) : result ? (
                <IssuesList issues={result.issues} summary={result.summary} />
              ) : null}

              {/* View on Map button + collapsible map */}
              {hasSpatial && spatialIssues.length > 0 && (
                <div className="space-y-3">
                  <button
                    onClick={() => setShowMap((v) => !v)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                      showMap
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <MapPin className="size-3" />
                    {showMap ? "Hide Map" : "View on Map"}
                  </button>
                  {showMap && (
                    <SpatialQCMap
                      issues={spatialIssues}
                      heatmapPoints={heatmapPoints}
                    />
                  )}
                </div>
              )}
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
            {state.crossDatasetMode
              ? `Scanning both datasets and running cross-validation checks`
              : `Scanning ${state.rowCount?.toLocaleString()} rows across ${state.columnCount} columns`}
          </p>
        </CardContent>
      </Card>
    )
  }

  const suggestedPack = suggestedPackId ? getTemplateById(suggestedPackId) : null

  function handleApplyPack() {
    if (suggestedPack) {
      toast.success(`Recommended: ${suggestedPack.name}`, {
        description: suggestedPack.description,
      })
    }
    setDismissed(true)
  }

  // Initial state -- not yet validated
  return (
    <div className="space-y-3">
      {suggestedPack && !dismissed && (
        <div className="flex items-center gap-3 rounded-lg border border-teal-200 bg-teal-50 p-3 dark:border-teal-800 dark:bg-teal-950/30">
          <Info className="size-4 shrink-0 text-teal-600" />
          <span className="flex-1 text-sm">
            This looks like a <strong>{suggestedPack.name}</strong> dataset. Use recommended QC settings?
          </span>
          <Button size="sm" onClick={handleApplyPack}>Apply</Button>
          <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>
            <X className="size-4" />
          </Button>
        </div>
      )}
    <Card className="rounded-2xl" data-onboarding="run-qc">
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

        {/* Cross-validation settings */}
        {state.crossDatasetMode && state.crossValidationPreset && (
          <CrossValidationSettings state={state} dispatch={dispatch} />
        )}

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
    </div>
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

/** Cross-validation tolerance settings card */
function CrossValidationSettings({
  state,
  dispatch,
}: {
  state: StagePanelProps["state"]
  dispatch: StagePanelProps["dispatch"]
}) {
  const presetId = state.crossValidationPreset
  if (!presetId) return null

  const preset = CROSS_VALIDATION_PRESETS[presetId]
  if (!preset) return null

  const presetName = PRESET_NAMES[presetId] ?? preset.name

  // Build tolerance values: user overrides take precedence over preset defaults
  const getToleranceValue = (key: string, defaultVal: number): number => {
    return state.crossValidationTolerances[key] ?? defaultVal
  }

  return (
    <Card className="rounded-2xl border-indigo-200 dark:border-indigo-900">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="size-4 text-indigo-600" />
          Cross-Validation Settings
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Preset: {presetName} -- {preset.datasetAType} vs {preset.datasetBType}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* KP alignment tolerance */}
        <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-2.5">
          <div>
            <p className="text-sm font-medium">KP Alignment Tolerance</p>
            <p className="text-xs text-muted-foreground">Maximum KP distance for row matching</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="0.001"
              min="0"
              className="w-20 rounded-md border bg-background px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={getToleranceValue("kp_alignment", preset.kpAlignmentTolerance)}
              onChange={(e) =>
                dispatch({
                  type: "SET_CROSS_TOLERANCE",
                  key: "kp_alignment",
                  value: parseFloat(e.target.value) || 0,
                })
              }
            />
            <span className="text-xs text-muted-foreground">km</span>
          </div>
        </div>

        {/* Column pair tolerances */}
        {preset.columnPairs
          .filter((pair) => pair.tolerance !== undefined)
          .map((pair) => {
            const key = `${pair.a}_vs_${pair.b}_${pair.check}`
            return (
              <div
                key={key}
                className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-2.5"
              >
                <div>
                  <p className="text-sm font-medium">{pair.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {pair.a} vs {pair.b} ({pair.check === "delta" ? "max difference" : pair.check === "a_gte_b" ? "A >= B" : pair.check})
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-20 rounded-md border bg-background px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={getToleranceValue(key, pair.tolerance!)}
                    onChange={(e) =>
                      dispatch({
                        type: "SET_CROSS_TOLERANCE",
                        key,
                        value: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>
            )
          })}
      </CardContent>
    </Card>
  )
}

function ClusteredIssuesList({ clusters }: { clusters: IssueCluster[] }) {
  const [expanded, setExpanded] = useState(false)
  const displayClusters = expanded ? clusters : clusters.slice(0, 5)

  return (
    <div className="space-y-2">
      {displayClusters.map((cluster) => (
        <IssueClusterRow key={cluster.id} cluster={cluster} />
      ))}

      {clusters.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? "Show fewer clusters" : `Show all ${clusters.length} clusters`}
        </button>
      )}
    </div>
  )
}
