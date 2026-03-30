"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useDropzone } from "react-dropzone"
import {
  Upload,
  Download,
  AlertCircle,
  Loader2,
  Check,
  X,
  FileText,
  Merge,
  Plus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { OutputPreviewTable } from "@/components/transform/output-preview-table"

const ACCEPTED_EXTENSIONS = [
  ".csv", ".xlsx", ".xls", ".geojson", ".json", ".zip", ".kml", ".kmz", ".xml", ".dxf",
]

const MAX_FILE_SIZE = 50 * 1024 * 1024

const OUTPUT_FORMATS = [
  { id: "csv", label: "CSV", ext: ".csv" },
  { id: "geojson", label: "GeoJSON", ext: ".geojson" },
  { id: "kml", label: "KML", ext: ".kml" },
] as const

type OutputFormat = (typeof OUTPUT_FORMATS)[number]["id"]

type MergeState =
  | { step: "upload"; files: File[] }
  | { step: "preview"; files: File[] }
  | { step: "merging"; files: File[] }
  | {
      step: "done"
      files: File[]
      blobUrl: string
      outputFilename: string
      rowCount: number
      fileCount: number
      previewText: string | null
      warnings: string[]
    }
  | { step: "error"; files: File[]; message: string }

function getFileExtension(name: string): string {
  return name.substring(name.lastIndexOf(".")).toLowerCase()
}

function detectDefaultFormat(files: File[]): OutputFormat {
  if (files.length === 0) return "geojson"
  const ext = getFileExtension(files[0].name).replace(".", "")
  const match = OUTPUT_FORMATS.find((f) => f.id === ext)
  return match ? match.id : "geojson"
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function MergeTool() {
  const [state, setState] = useState<MergeState>({ step: "upload", files: [] })
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("geojson")
  const [formatChanged, setFormatChanged] = useState(false)
  const blobUrlRef = useRef<string | null>(null)

  const revokeBlobUrl = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => revokeBlobUrl()
  }, [revokeBlobUrl])

  const addFiles = useCallback((newFiles: File[]) => {
    setState((prev) => {
      if (prev.step !== "upload") return prev
      const combined = [...prev.files, ...newFiles]
      return { step: "upload", files: combined }
    })
  }, [])

  const removeFile = useCallback((index: number) => {
    setState((prev) => {
      if (prev.step !== "upload") return prev
      const updated = prev.files.filter((_, i) => i !== index)
      return { step: "upload", files: updated }
    })
  }, [])

  const onDrop = useCallback((acceptedFiles: File[]) => {
    addFiles(acceptedFiles)
  }, [addFiles])

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    maxSize: MAX_FILE_SIZE,
    multiple: true,
    noClick: state.step === "upload" && state.files.length > 0,
    validator: (file) => {
      const ext = getFileExtension(file.name)
      if (!ACCEPTED_EXTENSIONS.includes(ext)) {
        return { code: "file-invalid-type", message: `Unsupported file type: ${ext}` }
      }
      return null
    },
  })

  const handleProceedToPreview = () => {
    if (state.step !== "upload" || state.files.length < 2) return
    setState({ step: "preview", files: state.files })
    setOutputFormat(detectDefaultFormat(state.files))
    setFormatChanged(false)
  }

  const handleMerge = async () => {
    if (state.step !== "preview") return

    setState({ step: "merging", files: state.files })
    revokeBlobUrl()

    try {
      const formData = new FormData()
      for (const file of state.files) {
        formData.append("files", file)
      }
      formData.append("target_format", formatChanged ? outputFormat : "")

      const response = await fetch("/api/transform/merge", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        const errorMessage = errorData?.error || `Merge failed (${response.status})`
        setState({ step: "error", files: state.files, message: errorMessage })
        return
      }

      const contentDisposition = response.headers.get("Content-Disposition") || ""
      const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/)
      const outputFilename = filenameMatch?.[1] || `merged.${outputFormat}`

      const warningsHeader = response.headers.get("X-Transform-Warnings") || ""
      const warnings = warningsHeader ? warningsHeader.split("|").filter(Boolean) : []

      const rowCount = parseInt(response.headers.get("X-Row-Count") || "0", 10)
      const fileCount = parseInt(response.headers.get("X-Merge-File-Count") || String(state.files.length), 10)

      // Read as text for preview, then create blob for download
      const responseText = await response.text()
      const blob = new Blob([responseText], { type: response.headers.get("Content-Type") || "application/octet-stream" })
      const blobUrl = URL.createObjectURL(blob)
      blobUrlRef.current = blobUrl

      const contentType = response.headers.get("Content-Type") || ""
      const isTextBased = contentType.includes("text") || contentType.includes("json") || contentType.includes("xml") || contentType.includes("kml") || contentType.includes("csv")
      const previewText = isTextBased ? responseText : null

      setState({
        step: "done",
        files: state.files,
        blobUrl,
        outputFilename,
        rowCount,
        fileCount,
        previewText,
        warnings,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Merge failed"
      setState({ step: "error", files: state.files, message })
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
    setState({ step: "upload", files: [] })
    setFormatChanged(false)
  }

  // Upload step
  if (state.step === "upload") {
    return (
      <div className="space-y-6">
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
            {isDragActive ? "Drop files here" : "Drop files here or click to browse"}
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            CSV, Excel, GeoJSON, Shapefile (ZIP), KML, KMZ, LandXML, DXF -- up to 50 MB each
          </p>
        </div>

        {/* File list */}
        {state.files.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{state.files.length} file{state.files.length !== 1 ? "s" : ""} selected</p>
              <Button variant="outline" size="sm" onClick={open}>
                <Plus className="size-3" />
                Add More
              </Button>
            </div>
            <div className="space-y-1">
              {state.files.map((file, i) => (
                <div key={`${file.name}-${i}`} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => removeFile(i)}>
                    <X className="size-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Proceed button */}
        <Button
          onClick={handleProceedToPreview}
          disabled={state.files.length < 2}
          className="w-full"
          size="lg"
        >
          <Merge className="size-4" />
          {state.files.length < 2
            ? `Add at least ${2 - state.files.length} more file${2 - state.files.length !== 1 ? "s" : ""}`
            : "Continue"}
        </Button>
      </div>
    )
  }

  // Preview step
  if (state.step === "preview") {
    const totalSize = state.files.reduce((acc, f) => acc + f.size, 0)

    return (
      <div className="space-y-6">
        {/* Summary */}
        <div className="rounded-lg border bg-card p-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Files</p>
              <p className="font-medium">{state.files.length}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Size</p>
              <p className="font-medium">{formatFileSize(totalSize)}</p>
            </div>
          </div>
          <div className="mt-3 space-y-1">
            {state.files.map((file, i) => (
              <p key={i} className="text-xs text-muted-foreground truncate">{file.name}</p>
            ))}
          </div>
        </div>

        {/* Output format */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Output Format</label>
          <div className="flex gap-2">
            {OUTPUT_FORMATS.map((fmt) => (
              <button
                key={fmt.id}
                onClick={() => {
                  setOutputFormat(fmt.id)
                  setFormatChanged(true)
                }}
                className={`flex-1 rounded-lg border p-3 text-center text-sm font-medium transition-colors ${
                  outputFormat === fmt.id
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border bg-card hover:border-primary/50"
                }`}
              >
                {fmt.label}
                <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{fmt.ext}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Merge button */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setState({ step: "upload", files: state.files })}
            className="flex-1"
          >
            Back
          </Button>
          <Button onClick={handleMerge} className="flex-1" size="lg">
            <Merge className="size-4" />
            Merge Files
          </Button>
        </div>
      </div>
    )
  }

  // Merging step
  if (state.step === "merging") {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border p-10 text-center">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="mt-4 text-sm font-medium">Merging {state.files.length} files...</p>
        <p className="mt-1.5 text-xs text-muted-foreground">This may take a moment</p>
      </div>
    )
  }

  // Done step
  if (state.step === "done") {
    return (
      <div className="space-y-4">
        {/* Success banner */}
        <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30">
          <div className="flex size-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
            <Check className="size-4 text-green-600 dark:text-green-400" />
          </div>
          <p className="text-sm font-medium text-green-700 dark:text-green-300">
            Merge complete
          </p>
        </div>

        {/* Download */}
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
            <p className="mb-2 text-xs font-medium text-yellow-700 dark:text-yellow-300">Warnings</p>
            <ul className="space-y-1">
              {state.warnings.map((warning, i) => (
                <li key={i} className="text-xs text-yellow-600 dark:text-yellow-400">{warning}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Stats */}
        <div className="rounded-lg border bg-card p-4">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Files Merged</p>
              <p className="font-medium">{state.fileCount}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Rows</p>
              <p className="font-medium">{state.rowCount.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Output</p>
              <p className="font-medium truncate">{state.outputFilename}</p>
            </div>
          </div>
        </div>

        {/* Preview table */}
        {state.previewText && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Output Preview</p>
            <OutputPreviewTable csvText={state.previewText} maxRows={20} />
          </div>
        )}

        {/* Reset */}
        <Button variant="outline" onClick={handleReset} className="w-full">
          Merge More
        </Button>
      </div>
    )
  }

  // Error step
  if (state.step === "error") {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-red-500 dark:text-red-400" />
          <div>
            <p className="text-sm font-medium text-red-700 dark:text-red-300">Merge failed</p>
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{state.message}</p>
          </div>
        </div>
        <Button variant="outline" onClick={handleReset} className="w-full">
          Try Again
        </Button>
      </div>
    )
  }

  return null
}
