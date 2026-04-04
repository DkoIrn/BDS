"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Loader2, Check, Pencil, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ParsingWarningBanner } from "@/components/files/parsing-warning-banner"
import { ColumnMappingTable } from "@/components/files/column-mapping-table"
import { DataPreviewTable } from "@/components/files/data-preview-table"
import { ValidationProgress } from "@/components/files/validation-progress"
import { ResultsDashboard } from "@/components/files/results-dashboard"
import { AuditTimeline } from "@/components/files/audit-timeline"
import { ProfileSelector } from "@/components/files/profile-selector"
import { createClient } from "@/lib/supabase/client"
import { saveColumnMappings } from "@/lib/actions/files"
import { getValidationRuns } from "@/lib/actions/validation"
import {
  getProfiles,
  createProfile,
  updateProfile,
  deleteProfile,
} from "@/lib/actions/profiles"
import {
  DEFAULT_TEMPLATES,
  suggestProfile,
  getTemplateById,
} from "@/lib/validation/templates"
import type { Dataset, DatasetStatus } from "@/lib/types/files"
import type { ValidationRun, ProfileConfig, ValidationProfile } from "@/lib/types/validation"
import type { SurveyType } from "@/lib/types/projects"
import type {
  DetectedColumn,
  ColumnMapping,
  ParseWarning,
  SurveyColumnType,
} from "@/lib/parsing/types"

interface ParseApiResponse {
  columns: DetectedColumn[]
  preview: string[][]
  headerRow: number
  totalRows: number
  warnings: ParseWarning[]
  missingExpected: SurveyColumnType[]
  sheetNames?: string[]
}

interface ValidateApiResponse {
  run_id: string
  total_issues: number
  critical_count: number
  warning_count: number
  info_count: number
  pass_rate: number
  status: string
}

interface FileDetailViewProps {
  dataset: Dataset
  jobSurveyType: SurveyType
  projectId: string
  jobId: string
}

export function FileDetailView({
  dataset,
  jobSurveyType,
  projectId,
  jobId,
}: FileDetailViewProps) {
  const [columns, setColumns] = useState<DetectedColumn[]>([])
  const [mappings, setMappings] = useState<ColumnMapping[]>(
    dataset.column_mappings ?? []
  )
  const [preview, setPreview] = useState<string[][]>([])
  const [warnings, setWarnings] = useState<ParseWarning[]>([])
  const [missingExpected, setMissingExpected] = useState<SurveyColumnType[]>([])
  const [totalRows, setTotalRows] = useState(dataset.total_rows ?? 0)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmed, setConfirmed] = useState(
    dataset.status === "mapped" ||
    dataset.status === "validated" ||
    dataset.status === "validating" ||
    dataset.status === "validation_error"
  )

  // Tab state
  const [activeTab, setActiveTab] = useState<string>(
    dataset.status === "validated" ? "results" : "mapping"
  )

  // Validation state
  const [validating, setValidating] = useState(false)
  const [validationRun, setValidationRun] = useState<ValidationRun | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [datasetStatus, setDatasetStatus] = useState<DatasetStatus>(dataset.status)

  // Profile state
  const [selectedProfileId, setSelectedProfileId] = useState("")
  const [currentConfig, setCurrentConfig] = useState<ProfileConfig | null>(null)
  const [userProfiles, setUserProfiles] = useState<ValidationProfile[]>([])
  const [configErrors, setConfigErrors] = useState<Record<string, string>>({})

  const fetchParseData = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datasetId: dataset.id }),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(
          (errData as { error?: string }).error ?? "Failed to parse file"
        )
      }

      const data = (await response.json()) as ParseApiResponse
      setColumns(data.columns)
      // Use saved mappings if available, otherwise use auto-detected ones
      if (dataset.column_mappings && dataset.column_mappings.length > 0) {
        setMappings(dataset.column_mappings)
      } else {
        setMappings(
          data.columns.map((col) => ({
            index: col.index,
            originalName: col.originalName,
            mappedType: col.detectedType,
            ignored: false,
          }))
        )
      }
      setPreview(data.preview)
      setTotalRows(data.totalRows)
      setMissingExpected(data.missingExpected)

      // Convert string warnings to ParseWarning objects
      if (data.warnings && Array.isArray(data.warnings)) {
        if (typeof data.warnings[0] === "string") {
          setWarnings(
            (data.warnings as unknown as string[]).map((msg) => ({
              type: "encoding_error" as const,
              message: msg,
            }))
          )
        } else {
          setWarnings(data.warnings)
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Parse failed"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [dataset.id])

  /** Validate a profile config, returning a map of field → error message */
  const validateConfig = useCallback(
    (config: ProfileConfig): Record<string, string> => {
      const errs: Record<string, string> = {}
      for (const [col, range] of Object.entries(config.ranges)) {
        if (typeof range.min === "number" && typeof range.max === "number" && range.min > range.max) {
          errs[`range_${col}`] = "Min must be ≤ Max"
        }
      }
      if (typeof config.zscore_threshold === "number" && config.zscore_threshold <= 0) {
        errs.zscore_threshold = "Must be > 0"
      }
      if (typeof config.iqr_multiplier === "number" && config.iqr_multiplier <= 0) {
        errs.iqr_multiplier = "Must be > 0"
      }
      if (typeof config.duplicate_kp_tolerance === "number" && config.duplicate_kp_tolerance < 0) {
        errs.duplicate_kp_tolerance = "Must be ≥ 0"
      }
      return errs
    },
    []
  )

  /** Handle config changes from the threshold editor */
  const handleConfigChange = useCallback(
    (config: ProfileConfig) => {
      setCurrentConfig(config)
      setConfigErrors(validateConfig(config))
    },
    [validateConfig]
  )

  /** Handle profile selection */
  const handleProfileChange = useCallback(
    (id: string, config: ProfileConfig) => {
      setSelectedProfileId(id)
      setCurrentConfig(config)
      setConfigErrors(validateConfig(config))
    },
    [validateConfig]
  )

  /** Reset to original template/profile config */
  const handleReset = useCallback(() => {
    const template = getTemplateById(selectedProfileId)
    if (template) {
      setCurrentConfig({ ...template.config })
      setConfigErrors({})
      return
    }
    const profile = userProfiles.find((p) => p.id === selectedProfileId)
    if (profile) {
      setCurrentConfig({ ...profile.config })
      setConfigErrors({})
    }
  }, [selectedProfileId, userProfiles])

  const loadUserProfiles = useCallback(async () => {
    const result = await getProfiles()
    if ("data" in result) {
      setUserProfiles(result.data)
    }
  }, [])

  /** Auto-suggest profile when mappings become confirmed */
  useEffect(() => {
    if (confirmed && mappings.length > 0 && !selectedProfileId) {
      const suggestedId = suggestProfile(mappings)
      const template = getTemplateById(suggestedId)
      if (template) {
        setSelectedProfileId(suggestedId)
        setCurrentConfig({ ...template.config })
      }
      loadUserProfiles()
    }
  }, [confirmed, mappings, selectedProfileId, loadUserProfiles])

  /** Derive mapped column types from current mappings */
  const mappedColumnTypes = mappings
    .filter((m) => !m.ignored && m.mappedType)
    .map((m) => m.mappedType!)

  /** Profile CRUD handlers */
  const handleSaveProfile = useCallback(
    async (name: string, config: ProfileConfig) => {
      const suggestedTemplate = getTemplateById(selectedProfileId)
      const surveyType = suggestedTemplate?.survey_type ?? null
      const result = await createProfile(name, surveyType, config)
      if ("error" in result) throw new Error(result.error)
      await loadUserProfiles()
    },
    [selectedProfileId, loadUserProfiles]
  )

  const handleUpdateProfile = useCallback(
    async (id: string, name: string, config: ProfileConfig) => {
      const result = await updateProfile(id, name, config)
      if ("error" in result) throw new Error(result.error)
      await loadUserProfiles()
    },
    [loadUserProfiles]
  )

  const handleDeleteProfile = useCallback(
    async (id: string) => {
      const result = await deleteProfile(id)
      if ("error" in result) throw new Error(result.error)
      // If deleting the selected profile, switch to suggested default
      if (id === selectedProfileId) {
        const suggestedId = suggestProfile(mappings)
        const template = getTemplateById(suggestedId)
        if (template) {
          setSelectedProfileId(suggestedId)
          setCurrentConfig({ ...template.config })
          setConfigErrors({})
        }
      }
      await loadUserProfiles()
    },
    [selectedProfileId, mappings, loadUserProfiles]
  )

  useEffect(() => {
    // If already parsed/mapped/validated with mappings stored, fetch preview data
    if (
      (dataset.status === "parsed" || dataset.status === "mapped" ||
       dataset.status === "validated" || dataset.status === "validating" ||
       dataset.status === "validation_error") &&
      dataset.column_mappings &&
      dataset.column_mappings.length > 0
    ) {
      fetchParseData()
    } else if (dataset.status === "uploaded" || dataset.status === "parsing") {
      // Still parsing, show loading state
      setLoading(true)
    } else if (dataset.status === "parsed" && !dataset.column_mappings) {
      // Edge case: parsed but no mappings saved, re-trigger parse
      fetchParseData()
    }
  }, [dataset.status, dataset.column_mappings, fetchParseData])

  function handleMappingChange(
    index: number,
    type: SurveyColumnType | null,
    ignored: boolean
  ) {
    setMappings((prev) =>
      prev.map((m) =>
        m.index === index
          ? { ...m, mappedType: type, ignored }
          : m
      )
    )
  }

  async function handleConfirmMappings() {
    setSaving(true)
    try {
      const result = await saveColumnMappings(dataset.id, mappings)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      toast.success("Column mappings confirmed")
      setConfirmed(true)
      setDatasetStatus("mapped")
    } catch {
      toast.error("Failed to save mappings")
    } finally {
      setSaving(false)
    }
  }

  function handleEditMappings() {
    setConfirmed(false)
  }

  async function handleRunValidation() {
    setValidating(true)
    setValidationError(null)
    setDatasetStatus("validating")

    try {
      const response = await fetch("/api/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datasetId: dataset.id,
          config: currentConfig ?? undefined,
        }),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        const message =
          (errData as { error?: string }).error ?? "Validation failed"
        setValidationError(message)
        setDatasetStatus("validation_error")
        setValidating(false)
        toast.error(message)
        return
      }

      // 202 Accepted -- validation runs in the background.
      // Realtime subscription will update state when complete.
    } catch (err) {
      const message = err instanceof Error ? err.message : "Validation failed"
      setValidationError(message)
      setDatasetStatus("validation_error")
      setValidating(false)
      toast.error(message)
    }
  }

  function handleRerun() {
    handleRunValidation()
  }

  // Load existing validation run if dataset is already validated
  useEffect(() => {
    if (
      (dataset.status === "validated" || dataset.status === "validation_error") &&
      !validationRun
    ) {
      getValidationRuns(dataset.id).then((result) => {
        if ("data" in result && result.data.length > 0) {
          setValidationRun(result.data[0])
        }
      })
    }
  }, [dataset.status, dataset.id, validationRun])

  // Realtime subscription for this dataset's status changes
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel("file-detail-" + dataset.id)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "datasets",
          filter: `id=eq.${dataset.id}`,
        },
        (payload: { new: { status: DatasetStatus } }) => {
          const newStatus = payload.new.status
          setDatasetStatus(newStatus)

          if (newStatus === "validated") {
            setValidating(false)
            setActiveTab("results")
            // Fetch the latest validation run data
            getValidationRuns(dataset.id).then((result) => {
              if ("data" in result && result.data.length > 0) {
                setValidationRun(result.data[0])
              }
            })
          } else if (newStatus === "validation_error") {
            setValidating(false)
            setValidationError("Validation failed")
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [dataset.id])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (dataset.status === "error") {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-6 dark:border-red-600 dark:bg-red-950/30">
        <p className="text-sm font-medium text-red-800 dark:text-red-200">
          Parsing failed
        </p>
        {dataset.parse_warnings && dataset.parse_warnings.length > 0 && (
          <p className="mt-1 text-sm text-red-700 dark:text-red-300">
            {dataset.parse_warnings[0]}
          </p>
        )}
      </div>
    )
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList>
        <TabsTrigger value="mapping">Mapping</TabsTrigger>
        <TabsTrigger value="results">Results</TabsTrigger>
        <TabsTrigger value="preview">Data Preview</TabsTrigger>
        <TabsTrigger value="audit">Audit Trail</TabsTrigger>
      </TabsList>

      <TabsContent value="mapping">
        <div className="space-y-6 pt-4">
          {/* Warning banner */}
          <ParsingWarningBanner
            warnings={warnings}
            missingExpected={missingExpected}
          />

          {/* Column mapping table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Column Mappings</h2>
              <div className="flex items-center gap-2">
                {confirmed ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleEditMappings}
                  >
                    <Pencil className="mr-1.5 size-3.5" />
                    Edit Mappings
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleConfirmMappings}
                    disabled={saving}
                  >
                    {saving ? (
                      <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                    ) : (
                      <Check className="mr-1.5 size-3.5" />
                    )}
                    Confirm Mappings
                  </Button>
                )}
              </div>
            </div>
            <ColumnMappingTable
              columns={columns}
              mappings={mappings}
              onMappingChange={handleMappingChange}
              disabled={confirmed}
            />
          </div>

          {/* Validation profile selector */}
          {confirmed && currentConfig && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Validation Profile</h2>
              <ProfileSelector
                selectedProfileId={selectedProfileId}
                onProfileChange={handleProfileChange}
                userProfiles={userProfiles}
                onSaveProfile={handleSaveProfile}
                onUpdateProfile={handleUpdateProfile}
                onDeleteProfile={handleDeleteProfile}
                mappedColumnTypes={mappedColumnTypes}
                currentConfig={currentConfig}
                onConfigChange={handleConfigChange}
                onReset={handleReset}
                configErrors={configErrors}
              />
            </div>
          )}

          {/* Validation section */}
          {confirmed && !validating && ["mapped", "validated", "validation_error"].includes(datasetStatus) && (
            <div className="flex items-center gap-3">
              <Button
                onClick={handleRunValidation}
                disabled={Object.keys(configErrors).length > 0}
              >
                <Play className="mr-1.5 size-3.5" />
                Run QC
              </Button>
              {Object.keys(configErrors).length > 0 && (
                <span className="text-xs text-red-500">
                  Fix configuration errors before running
                </span>
              )}
            </div>
          )}

          {validating && (
            <ValidationProgress statusText="Running validation..." />
          )}

          {datasetStatus === "validation_error" && validationError && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-600 dark:bg-red-950/30">
              <p className="text-sm font-medium text-red-800 dark:text-red-200">
                Validation failed
              </p>
              <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                {validationError}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={handleRerun}
              >
                Retry Validation
              </Button>
            </div>
          )}
        </div>
      </TabsContent>

      <TabsContent value="results">
        <div className="space-y-6 pt-4">
          {datasetStatus === "validated" || validationRun ? (
            <>
              <ResultsDashboard datasetId={dataset.id} />
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={handleRerun}>
                  <Play className="mr-1.5 size-3.5" />
                  Re-run QC
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground">
                No validation results yet. Run QC from the Mapping tab to see results.
              </p>
            </div>
          )}
        </div>
      </TabsContent>

      <TabsContent value="preview">
        <div className="space-y-3 pt-4">
          {preview.length > 0 ? (
            <>
              <h2 className="text-lg font-semibold">Data Preview</h2>
              <DataPreviewTable
                preview={preview}
                mappings={mappings}
                totalRows={totalRows}
              />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground">
                Data preview will be available after file parsing.
              </p>
            </div>
          )}
        </div>
      </TabsContent>

      <TabsContent value="audit">
        <div className="rounded-2xl border bg-card p-5">
          <AuditTimeline datasetId={dataset.id} />
        </div>
      </TabsContent>
    </Tabs>
  )
}
