"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Loader2, Check, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ParsingWarningBanner } from "@/components/files/parsing-warning-banner"
import { ColumnMappingTable } from "@/components/files/column-mapping-table"
import { DataPreviewTable } from "@/components/files/data-preview-table"
import { saveColumnMappings } from "@/lib/actions/files"
import type { Dataset } from "@/lib/types/files"
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
  const [confirmed, setConfirmed] = useState(dataset.status === "mapped")

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
      setMappings(
        data.columns.map((col) => ({
          index: col.index,
          originalName: col.originalName,
          mappedType: col.detectedType,
          ignored: false,
        }))
      )
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
    } catch {
      toast.error("Failed to save mappings")
    } finally {
      setSaving(false)
    }
  }

  function handleEditMappings() {
    setConfirmed(false)
  }

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
