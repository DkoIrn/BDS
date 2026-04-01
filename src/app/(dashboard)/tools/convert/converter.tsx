"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useDropzone } from "react-dropzone"
import {
  Upload,
  Download,
  ArrowRightLeft,
  FileText,
  AlertCircle,
  Loader2,
  Check,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { DatasetPicker } from "@/components/tools/dataset-picker"

// Accepted file extensions for conversion
const ACCEPTED_EXTENSIONS = [
  ".csv",
  ".xlsx",
  ".xls",
  ".geojson",
  ".json",
  ".zip",
  ".kml",
  ".kmz",
  ".xml",
  ".dxf",
]

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

// Target formats available
const TARGET_FORMATS = [
  { id: "csv", label: "CSV", ext: ".csv" },
  { id: "geojson", label: "GeoJSON", ext: ".geojson" },
  { id: "kml", label: "KML", ext: ".kml" },
] as const

type TargetFormat = (typeof TARGET_FORMATS)[number]["id"]

// State machine
type ConvertState =
  | { step: "upload" }
  | { step: "format"; file: File }
  | { step: "converting"; file: File; targetFormat: TargetFormat }
  | {
      step: "done"
      file: File
      targetFormat: TargetFormat
      blobUrl: string
      outputFilename: string
      rowCount: number
      fileSize: number
      warnings: string[]
    }
  | { step: "error"; file: File; message: string }

// Geospatial extensions that show all 3 target formats
const GEOSPATIAL_EXTENSIONS = [".geojson", ".json", ".zip", ".kml", ".kmz", ".xml", ".dxf"]

function getAvailableTargets(fileName: string): typeof TARGET_FORMATS[number][] {
  const ext = fileName.substring(fileName.lastIndexOf(".")).toLowerCase()
  const isGeospatial = GEOSPATIAL_EXTENSIONS.includes(ext)

  return TARGET_FORMATS.filter((fmt) => {
    // Hide same-format targets
    if (ext === fmt.ext) return false
    // For .json files, also hide geojson (they're equivalent)
    if (ext === ".json" && fmt.id === "geojson") return false
    // Tabular inputs: CSV hides CSV target; Excel always shows all 3
    if (!isGeospatial && ext === ".csv" && fmt.id === "csv") return false
    return true
  })
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function Converter() {
  const [state, setState] = useState<ConvertState>({ step: "upload" })
  const [selectedFormat, setSelectedFormat] = useState<TargetFormat | null>(null)
  const blobUrlRef = useRef<string | null>(null)

  // Cleanup blob URL on unmount or new conversion
  const revokeBlobUrl = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => revokeBlobUrl()
  }, [revokeBlobUrl])

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0]
      setState({ step: "format", file })
      setSelectedFormat(null)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: MAX_FILE_SIZE,
    multiple: false,
    accept: ACCEPTED_EXTENSIONS.reduce(
      (acc, ext) => {
        // Map extensions to MIME types for react-dropzone
        acc[`application/octet-stream`] = [...(acc[`application/octet-stream`] || []), ext]
        return acc
      },
      {} as Record<string, string[]>
    ),
    // Use validator to check extension since MIME types can be unreliable
    validator: (file) => {
      const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase()
      if (!ACCEPTED_EXTENSIONS.includes(ext)) {
        return {
          code: "file-invalid-type",
          message: `Unsupported file type: ${ext}`,
        }
      }
      return null
    },
  })

  const handleConvert = async () => {
    if (state.step !== "format" || !selectedFormat) return

    const { file } = state
    setState({ step: "converting", file, targetFormat: selectedFormat })
    revokeBlobUrl()

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("target_format", selectedFormat)

      const response = await fetch("/api/convert", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        const errorMessage =
          errorData?.error || `Conversion failed (${response.status})`
        setState({ step: "error", file, message: errorMessage })
        return
      }

      // Extract metadata from headers
      const contentDisposition = response.headers.get("Content-Disposition") || ""
      const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/)
      const outputFilename = filenameMatch?.[1] || `converted.${selectedFormat}`

      const warningsHeader = response.headers.get("X-Conversion-Warnings") || ""
      const warnings = warningsHeader ? warningsHeader.split("|").filter(Boolean) : []

      const rowCount = parseInt(response.headers.get("X-Row-Count") || "0", 10)

      // Create blob and trigger download
      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)
      blobUrlRef.current = blobUrl

      // Auto-trigger download
      triggerDownload(blobUrl, outputFilename)

      setState({
        step: "done",
        file,
        targetFormat: selectedFormat,
        blobUrl,
        outputFilename,
        rowCount,
        fileSize: blob.size,
        warnings,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Conversion failed"
      setState({ step: "error", file, message })
    }
  }

  const triggerDownload = (url: string, filename: string) => {
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const handleReset = () => {
    revokeBlobUrl()
    setState({ step: "upload" })
    setSelectedFormat(null)
  }

  const handleRemoveFile = () => {
    setState({ step: "upload" })
    setSelectedFormat(null)
  }

  // Upload step
  if (state.step === "upload") {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div
          {...getRootProps()}
          className={`cursor-pointer rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
            isDragActive
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-muted/50"
          }`}
        >
          <input {...getInputProps()} />
          <div className="mx-auto flex size-12 items-center justify-center rounded-lg bg-muted">
            <Upload className="size-5 text-muted-foreground" />
          </div>
          <p className="mt-4 text-sm font-medium">
            {isDragActive ? "Drop your file here" : "Drop a file here or click to browse"}
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            CSV, Excel, GeoJSON, Shapefile (ZIP), KML, KMZ, LandXML, DXF -- up to 50 MB
          </p>
        </div>
        <DatasetPicker onSelect={(file) => onDrop([file])} />
      </div>
    )
  }

  // Format selection step
  if (state.step === "format") {
    const availableTargets = getAvailableTargets(state.file.name)

    return (
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Selected file */}
        <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
          <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
            <FileText className="size-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{state.file.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(state.file.size)}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={handleRemoveFile}>
            <X className="size-4" />
          </Button>
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <ArrowRightLeft className="size-4 text-muted-foreground/40" />
        </div>

        {/* Target format selection */}
        <div className="space-y-3">
          <p className="text-sm font-medium">Convert to</p>
          <div className="flex gap-2">
            {availableTargets.map((fmt) => (
              <button
                key={fmt.id}
                onClick={() => setSelectedFormat(fmt.id)}
                className={`flex-1 rounded-lg border p-3 text-center text-sm font-medium transition-colors ${
                  selectedFormat === fmt.id
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border bg-card hover:border-primary/50"
                }`}
              >
                {fmt.label}
                <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                  {fmt.ext}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Convert button */}
        <Button
          onClick={handleConvert}
          disabled={!selectedFormat}
          className="w-full"
          size="lg"
        >
          <ArrowRightLeft className="size-4" />
          Convert
        </Button>
      </div>
    )
  }

  // Converting step (spinner)
  if (state.step === "converting") {
    const ext = state.file.name.substring(state.file.name.lastIndexOf(".")).toUpperCase().slice(1)
    const targetLabel = TARGET_FORMATS.find((f) => f.id === state.targetFormat)?.label || state.targetFormat

    return (
      <div className="mx-auto max-w-2xl">
        <div className="flex flex-col items-center justify-center rounded-lg border p-10 text-center">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="mt-4 text-sm font-medium">
            Converting {ext} to {targetLabel}...
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">This may take a moment</p>
        </div>
      </div>
    )
  }

  // Success step
  if (state.step === "done") {
    const sourceExt = state.file.name.substring(state.file.name.lastIndexOf(".")).toUpperCase().slice(1)
    const targetLabel = TARGET_FORMATS.find((f) => f.id === state.targetFormat)?.label || state.targetFormat

    return (
      <div className="mx-auto max-w-2xl space-y-4">
        {/* Success banner */}
        <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30">
          <div className="flex size-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
            <Check className="size-4 text-green-600 dark:text-green-400" />
          </div>
          <p className="text-sm font-medium text-green-700 dark:text-green-300">
            Conversion complete
          </p>
        </div>

        {/* Download button */}
        <Button
          onClick={() => triggerDownload(state.blobUrl, state.outputFilename)}
          className="w-full"
          size="lg"
        >
          <Download className="size-4" />
          Download {state.outputFilename}
        </Button>

        {/* Warnings */}
        {state.warnings.length > 0 && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-950/30">
            <p className="mb-2 text-xs font-medium text-yellow-700 dark:text-yellow-300">
              Conversion Warnings
            </p>
            <ul className="space-y-1">
              {state.warnings.map((warning, i) => (
                <li
                  key={i}
                  className="text-xs text-yellow-600 dark:text-yellow-400"
                >
                  {warning}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Summary card */}
        <div className="rounded-lg border bg-card p-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Output File</p>
              <p className="font-medium">{state.outputFilename}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Conversion</p>
              <p className="font-medium">
                {sourceExt} &rarr; {targetLabel}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Rows</p>
              <p className="font-medium">{state.rowCount.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">File Size</p>
              <p className="font-medium">{formatFileSize(state.fileSize)}</p>
            </div>
          </div>
        </div>

        {/* Convert another */}
        <Button variant="outline" onClick={handleReset} className="w-full">
          Convert Another
        </Button>
      </div>
    )
  }

  // Error step
  if (state.step === "error") {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-red-500 dark:text-red-400" />
          <div>
            <p className="text-sm font-medium text-red-700 dark:text-red-300">
              Conversion failed
            </p>
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              {state.message}
            </p>
          </div>
        </div>

        <Button variant="outline" onClick={handleReset} className="w-full">
          Convert Another
        </Button>
      </div>
    )
  }

  return null
}
