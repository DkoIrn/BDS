"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Loader2, Check, Pencil, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ParsingWarningBanner } from "@/components/files/parsing-warning-banner"
import { ColumnMappingTable } from "@/components/files/column-mapping-table"
import { DataPreviewTable } from "@/components/files/data-preview-table"
import { ValidationProgress } from "@/components/files/validation-progress"
import { ValidationSummary } from "@/components/files/validation-summary"
import { saveColumnMappings } from "@/lib/actions/files"
import { getValidationRuns } from "@/lib/actions/validation"
import type { Dataset, DatasetStatus } from "@/lib/types/files"
import type { ValidationRun } from "@/lib/types/validation"
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

  // Validation state
  const [validating, setValidating] = useState(false)
  const [validationRun, setValidationRun] = useState<ValidationRun | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [datasetStatus, setDatasetStatus] = useState<DatasetStatus>(dataset.status)

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

  useEffect(() => {
    // If already parsed with mappings stored, we need to fetch preview data from API
    if (
      (dataset.status === "parsed" || dataset.status === "mapped") &&
      dataset.column_mappings &&
      dataset.column_mappings.length > 0
    ) {
      // Fetch parse data to get preview rows and detected columns
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
        body: JSON.stringify({ datasetId: dataset.id }),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(
          (errData as { error?: string }).error ?? "Validation failed"
        )
      }

      const data = (await response.json()) as ValidateApiResponse
      setValidationRun({
        id: data.run_id,
        dataset_id: dataset.id,
        run_at: new Date().toISOString(),
        total_issues: data.total_issues,
        critical_count: data.critical_count,
        warning_count: data.warning_count,
        info_count: data.info_count,
        pass_rate: data.pass_rate,
        completeness_score: null,
        status: data.status,
        created_at: new Date().toISOString(),
      })
      setDatasetStatus("validated")
      toast.success("Validation complete")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Validation failed"
      setValidationError(message)
      setDatasetStatus("validation_error")
      toast.error(message)
    } finally {
      setValidating(false)
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
    <div className="space-y-6">
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

      {/* Validation section */}
      {confirmed && !validating && datasetStatus === "mapped" && (
        <div className="flex items-center gap-3">
          <Button onClick={handleRunValidation}>
            <Play className="mr-1.5 size-3.5" />
            Run QC
          </Button>
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

      {datasetStatus === "validated" && validationRun && (
        <ValidationSummary run={validationRun} onRerun={handleRerun} />
      )}

      {/* Data preview table */}
      {preview.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Data Preview</h2>
          <DataPreviewTable
            preview={preview}
            mappings={mappings}
            totalRows={totalRows}
          />
        </div>
      )}
    </div>
  )
}
