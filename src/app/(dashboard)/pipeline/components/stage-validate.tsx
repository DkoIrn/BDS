"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
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
  Wand2,
  Plus,
  Trash2,
  Pencil,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
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
import type {
  CustomRule,
  CustomRuleDefinition,
  ConditionGroup,
  RuleType,
  RuleTestResult,
} from "@/lib/types/custom-rules"
import {
  getRulesForProfile,
  createRule,
  updateRule,
  deleteRule,
  testRule,
} from "@/lib/actions/custom-rules"
import { RuleBuilder } from "./rule-builder/rule-builder"
import { RuleTestPreview } from "./rule-builder/rule-test-preview"

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

/** Map backend rule_type to client-side ValidationIssue type for auto-clean compatibility */
function mapBackendRuleType(ruleType: string): ValidationIssue["type"] {
  const mapping: Record<string, ValidationIssue["type"]> = {
    // Direct matches
    missing_data: "missing",
    duplicate_row: "duplicate",
    near_duplicate_kp: "duplicate",
    outlier_zscore: "outlier",
    outlier_iqr: "outlier",
    kp_gap: "kp_gap",
    monotonicity: "kp_monotonicity",
    // Spike-related → outlier (auto-clean handles spikes)
    spike_gradient: "outlier",
    spike_detection: "outlier",
    // Range/consistency → outlier (closest auto-clean category)
    range_check: "outlier",
    cross_column_consistency: "outlier",
    // Spatial → outlier
    coordinate_bounds: "outlier",
    coordinate_jump: "outlier",
    // Position → outlier
    kp_distance_mismatch: "kp_gap",
    bearing_discontinuity: "outlier",
    lateral_deviation: "outlier",
    // Event → missing (closest)
    missing_event_code: "missing",
    missing_event_description: "missing",
    duplicate_event: "duplicate",
    event_kp_order: "kp_monotonicity",
    // Cross-dataset
    cross_dataset: "cross_dataset",
    cross_dataset_coverage: "cross_dataset_coverage",
    // KP/segment
    kp_drift: "kp_gap",
    segment_continuity: "kp_gap",
    // Custom rules
    custom_rule: "outlier",
  }
  return mapping[ruleType] ?? "outlier"
}

/** Convert backend snake_case rule definition to frontend camelCase */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toFrontendGroup(group: any): ConditionGroup {
  const conditions = ((group.conditions as Record<string, unknown>[]) || []).map((c) => ({
    id: (c.id as string) || crypto.randomUUID(),
    column: (c.column as string) || "",
    ruleType: ((c.rule_type || c.ruleType) as RuleType) || "threshold",
    operator: (c.operator as string) || ">",
    value: c.value as number | string | undefined,
    compareColumn: (c.compare_column || c.compareColumn) as string | undefined,
  }))
  const groups = ((group.groups as Record<string, unknown>[]) || []).map(toFrontendGroup)
  return {
    id: (group.id as string) || crypto.randomUUID(),
    logic: (group.logic as "AND" | "OR") || "AND",
    conditions,
    groups,
  }
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

  // Custom rules state
  const [customRules, setCustomRules] = useState<CustomRule[]>([])
  const [showRuleBuilder, setShowRuleBuilder] = useState(false)
  const [editingRule, setEditingRule] = useState<CustomRule | null>(null)
  const [testResult, setTestResult] = useState<RuleTestResult | null>(null)
  const [isTesting, setIsTesting] = useState(false)
  const [loadingRules, setLoadingRules] = useState(false)

  // Build column mappings from parsed data headers for spatial detection
  const pipelineMappings = useMemo(() => {
    if (!state.parsedData || state.parsedData.length === 0) return []
    return buildColumnMappingsFromHeaders(state.parsedData[0])
  }, [state.parsedData])

  const hasSpatial = useMemo(() => {
    const types = new Set(pipelineMappings.map((m) => m.mappedType).filter(Boolean))
    // Only show map for lat/lng data — easting/northing requires CRS conversion
    return types.has("latitude") && types.has("longitude")
  }, [pipelineMappings])

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

  // Derive column options for RuleBuilder from parsed data headers
  const ruleBuilderColumns = useMemo(() => {
    if (!state.parsedData || state.parsedData.length === 0) return []
    const headers = state.parsedData[0]
    return headers.map((h) => ({ value: h, label: h }))
  }, [state.parsedData])

  // Custom rules handlers
  const handleLoadRules = useCallback(async (profileId: string) => {
    setLoadingRules(true)
    const result = await getRulesForProfile(profileId)
    if ("data" in result) {
      setCustomRules(result.data)
    } else {
      toast.error(result.error)
    }
    setLoadingRules(false)
  }, [])

  const handleTestRule = useCallback(
    async (rule: CustomRuleDefinition) => {
      setIsTesting(true)
      setTestResult(null)

      if (state.datasetId) {
        // Existing dataset — test via backend
        const res = await testRule(rule.rootGroup, state.datasetId, rule.severity)
        if ("data" in res) {
          setTestResult(res.data)
        } else {
          toast.error(res.error)
        }
      } else if (state.parsedData && state.parsedData.length > 1) {
        // Fresh upload — test client-side
        const { executeCustomRuleClientSide } = await import("@/lib/types/custom-rules")
        const issues = executeCustomRuleClientSide(rule, state.parsedData)
        setTestResult({
          matching_rows: issues.length,
          total_rows: state.parsedData.length - 1,
          sample_matches: issues.slice(0, 10).map((iss) => ({
            row_number: iss.row ?? 0,
            values: {},
          })),
        })
      } else {
        toast.error("No data available to test against")
      }

      setIsTesting(false)
    },
    [state.datasetId, state.parsedData]
  )

  const handleSaveRule = useCallback(
    async (profileId: string, rule: CustomRuleDefinition) => {
      if (editingRule) {
        if (editingRule.id.startsWith("local-")) {
          // Update local rule
          setCustomRules((prev) =>
            prev.map((r) => r.id === editingRule.id ? {
              ...r,
              name: rule.name,
              description: rule.description,
              severity: rule.severity,
              rule_definition: rule.rootGroup,
            } : r)
          )
          toast.success("Rule updated")
        } else {
          const res = await updateRule(editingRule.id, rule)
          if ("data" in res) {
            setCustomRules((prev) =>
              prev.map((r) => (r.id === editingRule.id ? res.data : r))
            )
            toast.success("Rule updated")
          } else {
            toast.error(res.error)
            return
          }
        }
      } else if (profileId && state.datasetId) {
        // Save to backend if we have a profile and dataset
        const res = await createRule(profileId, rule)
        if ("data" in res) {
          setCustomRules((prev) => [...prev, res.data])
          toast.success("Rule saved")
        } else {
          toast.error(res.error)
          return
        }
      } else {
        // Save locally for fresh uploads
        const localRule: CustomRule = {
          id: `local-${crypto.randomUUID()}`,
          profile_id: "",
          user_id: "",
          org_id: "",
          name: rule.name,
          description: rule.description,
          severity: rule.severity,
          rule_definition: rule.rootGroup,
          enabled: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        setCustomRules((prev) => [...prev, localRule])
        toast.success("Rule added")
      }
      setShowRuleBuilder(false)
      setEditingRule(null)
      setTestResult(null)
    },
    [editingRule, state.datasetId]
  )

  const handleToggleRule = useCallback(async (rule: CustomRule) => {
    const res = await updateRule(rule.id, { enabled: !rule.enabled })
    if ("data" in res) {
      setCustomRules((prev) =>
        prev.map((r) => (r.id === rule.id ? res.data : r))
      )
    } else {
      toast.error(res.error)
    }
  }, [])

  const handleDeleteRule = useCallback(async (ruleId: string) => {
    const res = await deleteRule(ruleId)
    if ("success" in res) {
      setCustomRules((prev) => prev.filter((r) => r.id !== ruleId))
      toast.success("Rule deleted")
    } else {
      toast.error(res.error)
    }
  }, [])

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
        // Include enabled custom rule IDs
        const enabledRuleIds = customRules.filter((r) => r.enabled).map((r) => r.id)
        if (enabledRuleIds.length > 0) {
          requestBody.customRuleIds = enabledRuleIds
        }
        // Include cross-dataset config if in cross-dataset mode with types selected
        if (state.crossDatasetMode && state.secondDatasetId && state.datasetTypeA && state.datasetTypeB) {
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

        // Backend processes async — poll for completion
        const datasetId = state.datasetId!
        let attempts = 0
        const maxAttempts = 60 // 60 seconds max
        let finalRunId = data.datasetId || datasetId
        let finalIssueCount = 0

        while (attempts < maxAttempts) {
          await new Promise((r) => setTimeout(r, 1000))
          attempts++

          const { getValidationRuns, getValidationIssues } = await import("@/lib/actions/validation")
          const runsResult = await getValidationRuns(datasetId)
          if ("data" in runsResult && runsResult.data.length > 0) {
            const latestRun = runsResult.data[0]
            if (latestRun.status === "completed") {
              finalRunId = latestRun.id
              finalIssueCount = latestRun.total_issues

              // Fetch actual issues to display in pipeline
              const issuesResult = await getValidationIssues(latestRun.id)
              if ("data" in issuesResult) {
                const clientIssues: ValidationIssue[] = issuesResult.data.map((si) => ({
                  type: mapBackendRuleType(si.rule_type),
                  severity: si.severity as ValidationIssue["severity"],
                  row: si.row_number,
                  column: si.column_name,
                  message: si.message,
                  detail: si.expected ?? undefined,
                  kpValue: si.kp_value ?? undefined,
                }))
                const summary = {
                  total: clientIssues.length,
                  critical: clientIssues.filter((i) => i.severity === "critical").length,
                  warning: clientIssues.filter((i) => i.severity === "warning").length,
                  info: clientIssues.filter((i) => i.severity === "info").length,
                }
                setResult({ issues: clientIssues, summary })
                onIssuesFound?.(clientIssues)
              }
              break
            }
          }
        }

        if (attempts >= maxAttempts && finalIssueCount === 0) {
          toast.error("Validation is still processing. Results will appear in the project page shortly.")
        }

        dispatch({
          type: "VALIDATE_COMPLETE",
          runId: finalRunId,
          issueCount: finalIssueCount,
        })
      } else if (state.parsedData && state.parsedData.length > 1) {
        // Uploaded file — send to backend for consistent validation
        const csvContent = state.parsedData
          .map((row) =>
            row.map((cell) => {
              if (cell.includes(",") || cell.includes('"') || cell.includes("\n")) {
                return `"${cell.replace(/"/g, '""')}"`
              }
              return cell
            }).join(",")
          )
          .join("\n")
        const blob = new Blob([csvContent], { type: "text/csv" })
        const file = new File([blob], state.fileName || "upload.csv", { type: "text/csv" })

        const formData = new FormData()
        formData.append("file", file)

        let backendSuccess = false

        try {
          const [response] = await Promise.all([
            fetch("/api/validate-file", { method: "POST", body: formData }),
            minDelay,
          ]) as [Response, unknown]

          if (response.ok) {
            const data = await response.json()
            console.log("Backend validation returned", data.issues?.length, "issues")
            const backendIssues: ValidationIssue[] = (data.issues || []).map((si: { rule_type: string; severity: string; row_number: number; column_name: string; message: string; expected?: string; kp_value?: number }) => ({
              type: mapBackendRuleType(si.rule_type),
              severity: si.severity as ValidationIssue["severity"],
              row: si.row_number,
              column: si.column_name,
              message: si.message,
              detail: si.expected ?? undefined,
              kpValue: si.kp_value ?? undefined,
            }))

            let allIssues = backendIssues

            // Cross-dataset validation (client-side, not available in backend for uploaded files)
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

            // Run enabled custom rules client-side
            if (state.parsedData && customRules.length > 0) {
              const { executeCustomRuleClientSide } = await import("@/lib/types/custom-rules")
              for (const rule of customRules.filter((r) => r.enabled)) {
                const def: CustomRuleDefinition = {
                  name: rule.name,
                  description: rule.description,
                  severity: rule.severity,
                  rootGroup: toFrontendGroup(rule.rule_definition),
                }
                const ruleIssues = executeCustomRuleClientSide(def, state.parsedData)
                allIssues = [...allIssues, ...ruleIssues]
              }
            }

            const summary = {
              total: allIssues.length,
              critical: allIssues.filter((i) => i.severity === "critical").length,
              warning: allIssues.filter((i) => i.severity === "warning").length,
              info: allIssues.filter((i) => i.severity === "info").length,
            }

            setResult({ issues: allIssues, summary })
            onIssuesFound?.(allIssues)
            dispatch({
              type: "VALIDATE_COMPLETE",
              runId: "backend-direct",
              issueCount: summary.total,
            })
            backendSuccess = true
          } else {
            const errText = await response.text().catch(() => "")
            console.error("Backend validation returned", response.status, errText)
          }
        } catch (backendErr) {
          console.error("Backend validation failed, falling back to client-side:", backendErr)
        }

        // Fallback to client-side validation if backend unavailable
        if (!backendSuccess) {
          const [validationResult] = await Promise.all([
            Promise.resolve(validateClientSide(state.parsedData)),
            minDelay,
          ])

          let allFallbackIssues = validationResult.issues

          // Run enabled custom rules client-side
          if (customRules.length > 0) {
            const { executeCustomRuleClientSide } = await import("@/lib/types/custom-rules")
            for (const rule of customRules.filter((r) => r.enabled)) {
              const def: CustomRuleDefinition = {
                name: rule.name,
                description: rule.description,
                severity: rule.severity,
                rootGroup: toFrontendGroup(rule.rule_definition),
              }
              const ruleIssues = executeCustomRuleClientSide(def, state.parsedData)
              allFallbackIssues = [...allFallbackIssues, ...ruleIssues]
            }
          }

          const summary = {
            total: allFallbackIssues.length,
            critical: allFallbackIssues.filter((i) => i.severity === "critical").length,
            warning: allFallbackIssues.filter((i) => i.severity === "warning").length,
            info: allFallbackIssues.filter((i) => i.severity === "info").length,
          }
          setResult({ issues: allFallbackIssues, summary })
          onIssuesFound?.(allFallbackIssues)
          dispatch({
            type: "VALIDATE_COMPLETE",
            runId: "client",
            issueCount: summary.total,
          })
        }
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
                dispatch({ type: "GO_TO_STAGE", stage: "review" })
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
                dispatch({ type: "GO_TO_STAGE", stage: "review" })
              }
              className="group inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-all hover:opacity-90 active:scale-[0.98]"
            >
              {(state.issueCount ?? 0) > 0 ? "Review Issues" : "Continue to Clean"}
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
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

        {/* Custom Rules section — available for all datasets */}
        {(state.datasetId || state.parsedData) && (
          <CustomRulesSection
            rules={customRules}
            loading={loadingRules}
            columns={ruleBuilderColumns}
            showBuilder={showRuleBuilder}
            editingRule={editingRule}
            testResult={testResult}
            isTesting={isTesting}
            datasetId={state.datasetId}
            onLoadRules={handleLoadRules}
            onToggleBuilder={() => {
              setShowRuleBuilder((v) => !v)
              setEditingRule(null)
              setTestResult(null)
            }}
            onEditRule={(rule) => {
              setEditingRule(rule)
              setShowRuleBuilder(true)
              setTestResult(null)
            }}
            onToggleRule={handleToggleRule}
            onDeleteRule={handleDeleteRule}
            onTestRule={handleTestRule}
            onSaveRule={handleSaveRule}
            onCancelBuilder={() => {
              setShowRuleBuilder(false)
              setEditingRule(null)
              setTestResult(null)
            }}
          />
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

/** Custom rules section within the validate stage */
function CustomRulesSection({
  rules,
  loading,
  columns,
  showBuilder,
  editingRule,
  testResult,
  isTesting,
  datasetId,
  onLoadRules,
  onToggleBuilder,
  onEditRule,
  onToggleRule,
  onDeleteRule,
  onTestRule,
  onSaveRule,
  onCancelBuilder,
}: {
  rules: CustomRule[]
  loading: boolean
  columns: Array<{ value: string; label: string }>
  showBuilder: boolean
  editingRule: CustomRule | null
  testResult: RuleTestResult | null
  isTesting: boolean
  datasetId: string | null
  onLoadRules: (profileId: string) => void
  onToggleBuilder: () => void
  onEditRule: (rule: CustomRule) => void
  onToggleRule: (rule: CustomRule) => void
  onDeleteRule: (ruleId: string) => void
  onTestRule: (rule: CustomRuleDefinition) => void
  onSaveRule: (profileId: string, rule: CustomRuleDefinition) => void
  onCancelBuilder: () => void
}) {
  const [profileId, setProfileId] = useState<string | null>(null)
  const [profiles, setProfiles] = useState<Array<{ id: string; name: string }>>([])
  const [loadedProfiles, setLoadedProfiles] = useState(false)

  // Load profiles on mount
  useEffect(() => {
    if (loadedProfiles) return
    setLoadedProfiles(true)
    import("@/lib/actions/profiles").then(({ getProfiles }) => {
      getProfiles().then((res) => {
        if ("data" in res) {
          setProfiles(res.data.map((p) => ({ id: p.id, name: p.name })))
          // Auto-select first profile
          if (res.data.length > 0 && !profileId) {
            setProfileId(res.data[0].id)
            onLoadRules(res.data[0].id)
          }
        }
      })
    })
  }, [loadedProfiles, profileId, onLoadRules])

  const severityBadge = (severity: string) => {
    const config =
      severity === "critical"
        ? "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
        : severity === "warning"
          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
          : "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
    return (
      <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${config}`}>
        {severity}
      </span>
    )
  }

  return (
    <Card className="rounded-2xl border-violet-200 dark:border-violet-900">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Wand2 className="size-4 text-violet-500" />
          Custom Rules
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Define custom validation rules to check alongside built-in validators
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Profile selector */}
        {profiles.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground shrink-0">
              Profile:
            </label>
            <select
              className="rounded-md border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              value={profileId ?? ""}
              onChange={(e) => {
                setProfileId(e.target.value)
                onLoadRules(e.target.value)
              }}
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {profiles.length === 0 && !loading && (
          <p className="text-xs text-muted-foreground">
            No validation profiles found. Create a profile to save custom rules.
          </p>
        )}

        {/* Rules list */}
        {loading ? (
          <Skeleton className="h-8 w-full" />
        ) : rules.length > 0 ? (
          <div className="space-y-1.5">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2"
              >
                <Switch
                  checked={rule.enabled}
                  onCheckedChange={() => onToggleRule(rule)}
                  className="shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{rule.name}</p>
                </div>
                {severityBadge(rule.severity)}
                <button
                  onClick={() => onEditRule(rule)}
                  className="p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  title="Edit rule"
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  onClick={() => onDeleteRule(rule.id)}
                  className="p-1 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                  title="Delete rule"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : profileId ? (
          <p className="text-xs text-muted-foreground">
            No custom rules yet. Click below to create one.
          </p>
        ) : null}

        {/* Add rule button */}
        {profileId && !showBuilder && (
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleBuilder}
            className="border-violet-200 text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-300 dark:hover:bg-violet-950/30"
          >
            <Plus className="mr-1 size-3.5" />
            Add Custom Rule
          </Button>
        )}

        {/* Rule builder */}
        {showBuilder && profileId && (
          <div className="space-y-3">
            <RuleBuilder
              columns={columns}
              initialRule={
                editingRule
                  ? {
                      name: editingRule.name,
                      description: editingRule.description,
                      severity: editingRule.severity,
                      rootGroup: toFrontendGroup(editingRule.rule_definition),
                    }
                  : undefined
              }
              onSave={(rule) => onSaveRule(profileId, rule)}
              onTest={datasetId ? onTestRule : undefined}
              onCancel={onCancelBuilder}
              testResult={testResult}
              isTesting={isTesting}
            />
            {testResult && <RuleTestPreview result={testResult} />}
          </div>
        )}
      </CardContent>
    </Card>
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
