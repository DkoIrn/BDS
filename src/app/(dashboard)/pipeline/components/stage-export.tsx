"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Download,
  Loader2,
  Check,
  FileText,
  RefreshCw,
  AlertCircle,
  ArrowLeft,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { clearPipelineState } from "../lib/pipeline-store"
import type { PipelineState, PipelineAction } from "../lib/pipeline-state"

interface StageExportProps {
  state: PipelineState
  dispatch: React.Dispatch<PipelineAction>
  fileRef: React.MutableRefObject<File | null>
}

const EXPORT_FORMATS = [
  { id: "csv", label: "CSV", ext: ".csv", description: "Comma-separated values" },
  { id: "geojson", label: "GeoJSON", ext: ".geojson", description: "Geographic JSON" },
  { id: "kml", label: "KML", ext: ".kml", description: "Keyhole Markup Language" },
] as const

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getDefaultFormat(fileName: string | null): string {
  if (!fileName) return "csv"
  const ext = fileName.substring(fileName.lastIndexOf(".")).toLowerCase()
  const match = EXPORT_FORMATS.find((f) => f.ext === ext)
  return match?.id || "csv"
}

export function StageExport({ state, dispatch, fileRef }: StageExportProps) {
  const [downloading, setDownloading] = useState(false)
  const [downloaded, setDownloaded] = useState(false)
  const [downloadedFilename, setDownloadedFilename] = useState<string | null>(null)
  const [downloadedSize, setDownloadedSize] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const blobUrlRef = useRef<string | null>(null)

  // Set default format if not set
  useEffect(() => {
    if (!state.exportFormat) {
      dispatch({
        type: "SET_EXPORT_FORMAT",
        format: getDefaultFormat(state.fileName),
      })
    }
  }, [state.exportFormat, state.fileName, dispatch])

  const revokeBlobUrl = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => revokeBlobUrl()
  }, [revokeBlobUrl])

  function triggerDownload(url: string, filename: string) {
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  async function handleDownload() {
    if (!state.exportFormat) return

    setDownloading(true)
    setError(null)
    revokeBlobUrl()

    try {
      const formData = new FormData()

      if (fileRef.current) {
        formData.append("file", fileRef.current)
      } else if (state.datasetId) {
        // For existing datasets without a file ref, fetch the file first
        const { getDatasetSignedUrl } = await import("@/lib/actions/files")
        const result = await getDatasetSignedUrl(state.datasetId)
        if ("error" in result) throw new Error(result.error)

        const response = await fetch(result.url)
        const blob = await response.blob()
        const file = new File([blob], result.fileName)
        formData.append("file", file)
      } else if (state.parsedData && state.parsedData.length > 0) {
        // Reconstruct CSV from parsed data (e.g. after session restore when fileRef is lost)
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
        const file = new File([blob], state.fileName || "export.csv")
        formData.append("file", file)
      } else {
        throw new Error("No file available for export")
      }

      formData.append("target_format", state.exportFormat)

      const response = await fetch("/api/convert", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(
          errorData?.error || `Export failed (${response.status})`
        )
      }

      const contentDisposition =
        response.headers.get("Content-Disposition") || ""
      const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/)
      const outputFilename =
        filenameMatch?.[1] ||
        `${(state.fileName || "export").replace(/\.[^.]+$/, "")}.${state.exportFormat}`

      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)
      blobUrlRef.current = blobUrl

      triggerDownload(blobUrl, outputFilename)

      setDownloadedFilename(outputFilename)
      setDownloadedSize(blob.size)
      setDownloaded(true)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Export failed"
      setError(message)
    } finally {
      setDownloading(false)
    }
  }

  function handleReset() {
    clearPipelineState()
    dispatch({ type: "RESET" })
  }

  // Pipeline complete state
  if (downloaded) {
    return (
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Check className="size-5 text-green-600" />
            Pipeline Complete
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Download success */}
          <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30">
            <Check className="size-5 text-green-600 dark:text-green-400" />
            <div>
              <p className="text-sm font-medium text-green-700 dark:text-green-300">
                Downloaded: {downloadedFilename}
              </p>
              {downloadedSize && (
                <p className="text-xs text-green-600 dark:text-green-400">
                  {formatFileSize(downloadedSize)}
                </p>
              )}
            </div>
          </div>

          {/* Re-download */}
          {blobUrlRef.current && downloadedFilename && (
            <Button
              variant="outline"
              onClick={() =>
                triggerDownload(blobUrlRef.current!, downloadedFilename!)
              }
              className="w-full"
            >
              <Download className="mr-2 size-4" />
              Download Again
            </Button>
          )}

          {/* QC Report download */}
          {state.validationRunId && state.datasetId && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                window.open(
                  `/api/reports/pdf?dataset_id=${state.datasetId}`,
                  "_blank"
                )
              }}
            >
              <FileText className="mr-2 size-4" />
              Download QC Report (PDF)
            </Button>
          )}

          {/* Stage summary */}
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Pipeline Summary
            </p>
            <div className="space-y-2 text-sm">
              <SummaryRow label="Import" value={state.stages.import.summary} />
              <SummaryRow label="Inspect" value={state.stages.inspect.summary} />
              <SummaryRow
                label="Validate"
                value={state.stages.validate.summary}
                warning={state.stages.validate.skipped}
              />
              <SummaryRow
                label="Clean"
                value={state.stages.clean.summary}
                warning={state.stages.clean.skipped}
              />
              <SummaryRow label="Export" value={downloadedFilename} />
            </div>
          </div>

          <button
            onClick={handleReset}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-all hover:opacity-90 active:scale-[0.98]"
          >
            <RefreshCw className="size-3.5" />
            Start New Pipeline
          </button>
        </CardContent>
      </Card>
    )
  }

  // Export form
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="size-5" />
          Export Data
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Format selection */}
        <div className="space-y-3">
          <p className="text-sm font-medium">Output Format</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {EXPORT_FORMATS.map((fmt) => (
              <button
                key={fmt.id}
                onClick={() =>
                  dispatch({ type: "SET_EXPORT_FORMAT", format: fmt.id })
                }
                className={`rounded-xl border p-4 text-left transition-all ${
                  state.exportFormat === fmt.id
                    ? "border-foreground bg-foreground/5 ring-1 ring-foreground"
                    : "border-border bg-card hover:border-foreground/40"
                }`}
              >
                <p className="text-sm font-medium">{fmt.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {fmt.description}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-500" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() =>
              dispatch({ type: "GO_TO_STAGE", stage: "clean" })
            }
          >
            <ArrowLeft className="mr-2 size-4" />
            Back
          </Button>
          <button
            onClick={handleDownload}
            disabled={!state.exportFormat || downloading}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-all hover:opacity-90 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
          >
            {downloading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="size-4" />
                Download Dataset
              </>
            )}
          </button>
        </div>
      </CardContent>
    </Card>
  )
}

function SummaryRow({
  label,
  value,
  warning,
}: {
  label: string
  value: string | null
  warning?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={warning ? "text-amber-600 dark:text-amber-400" : ""}>
        {value || "--"}
      </span>
    </div>
  )
}
