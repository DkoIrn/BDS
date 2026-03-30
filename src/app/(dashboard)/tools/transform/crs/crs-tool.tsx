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
  Globe,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { OutputPreviewTable } from "@/components/transform/output-preview-table"

const ACCEPTED_EXTENSIONS = [
  ".csv", ".xlsx", ".xls", ".geojson", ".json", ".zip", ".kml", ".kmz", ".xml", ".dxf",
]

const MAX_FILE_SIZE = 50 * 1024 * 1024

const CRS_LIST = [
  { epsg: 4326, label: "WGS84 (EPSG:4326)" },
  { epsg: 27700, label: "OSGB36 / British National Grid (EPSG:27700)" },
  { epsg: 32629, label: "UTM Zone 29N (EPSG:32629)" },
  { epsg: 32630, label: "UTM Zone 30N (EPSG:32630)" },
  { epsg: 32631, label: "UTM Zone 31N (EPSG:32631)" },
] as const

const OUTPUT_FORMATS = [
  { id: "csv", label: "CSV", ext: ".csv" },
  { id: "geojson", label: "GeoJSON", ext: ".geojson" },
  { id: "kml", label: "KML", ext: ".kml" },
] as const

type OutputFormat = (typeof OUTPUT_FORMATS)[number]["id"]

type CrsState =
  | { step: "upload" }
  | { step: "configure"; file: File }
  | { step: "transforming"; file: File; sourceEpsg: number; targetEpsg: number; outputFormat: OutputFormat }
  | {
      step: "done"
      file: File
      sourceEpsg: number
      targetEpsg: number
      blobUrl: string
      outputFilename: string
      rowCount: number
      previewText: string | null
      warnings: string[]
    }
  | { step: "error"; file: File; message: string }

function getFileExtension(name: string): string {
  return name.substring(name.lastIndexOf(".")).toLowerCase()
}

function detectDefaultFormat(fileName: string): OutputFormat {
  const ext = getFileExtension(fileName).replace(".", "")
  const match = OUTPUT_FORMATS.find((f) => f.id === ext)
  return match ? match.id : "geojson"
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function CrsTool() {
  const [state, setState] = useState<CrsState>({ step: "upload" })
  const [sourceEpsg, setSourceEpsg] = useState<number | "">("")
  const [targetEpsg, setTargetEpsg] = useState<number | "">("")
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

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0]
      setState({ step: "configure", file })
      setSourceEpsg("")
      setTargetEpsg("")
      setOutputFormat(detectDefaultFormat(file.name))
      setFormatChanged(false)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: MAX_FILE_SIZE,
    multiple: false,
    validator: (file) => {
      const ext = getFileExtension(file.name)
      if (!ACCEPTED_EXTENSIONS.includes(ext)) {
        return { code: "file-invalid-type", message: `Unsupported file type: ${ext}` }
      }
      return null
    },
  })

  const handleTransform = async () => {
    if (state.step !== "configure" || sourceEpsg === "" || targetEpsg === "") return

    setState({ step: "transforming", file: state.file, sourceEpsg, targetEpsg, outputFormat })
    revokeBlobUrl()

    try {
      const formData = new FormData()
      formData.append("file", state.file)
      formData.append("source_epsg", String(sourceEpsg))
      formData.append("target_epsg", String(targetEpsg))
      formData.append("target_format", formatChanged ? outputFormat : "")

      const response = await fetch("/api/transform/crs", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        const errorMessage = errorData?.error || `CRS conversion failed (${response.status})`
        setState({ step: "error", file: state.file, message: errorMessage })
        return
      }

      const contentDisposition = response.headers.get("Content-Disposition") || ""
      const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/)
      const outputFilename = filenameMatch?.[1] || `converted.${outputFormat}`

      const warningsHeader = response.headers.get("X-Transform-Warnings") || ""
      const warnings = warningsHeader ? warningsHeader.split("|").filter(Boolean) : []

      const rowCount = parseInt(response.headers.get("X-Row-Count") || "0", 10)

      // Read as text for preview, then create blob for download
      const responseText = await response.text()
      const blob = new Blob([responseText], { type: response.headers.get("Content-Type") || "application/octet-stream" })
      const blobUrl = URL.createObjectURL(blob)
      blobUrlRef.current = blobUrl

      // Only show preview for text-based formats
      const contentType = response.headers.get("Content-Type") || ""
      const isTextBased = contentType.includes("text") || contentType.includes("json") || contentType.includes("xml") || contentType.includes("kml") || contentType.includes("csv")
      const previewText = isTextBased ? responseText : null

      setState({
        step: "done",
        file: state.file,
        sourceEpsg,
        targetEpsg,
        blobUrl,
        outputFilename,
        rowCount,
        previewText,
        warnings,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "CRS conversion failed"
      setState({ step: "error", file: state.file, message })
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
    setSourceEpsg("")
    setTargetEpsg("")
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
            {isDragActive ? "Drop your file here" : "Drop a file here or click to browse"}
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            CSV, Excel, GeoJSON, Shapefile (ZIP), KML, KMZ, LandXML, DXF -- up to 50 MB
          </p>
        </div>
      </div>
    )
  }

  // Configure step
  if (state.step === "configure") {
    const availableTargets = CRS_LIST.filter((c) => c.epsg !== sourceEpsg)

    return (
      <div className="space-y-6">
        {/* Selected file */}
        <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
          <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
            <FileText className="size-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{state.file.name}</p>
            <p className="text-xs text-muted-foreground">{formatFileSize(state.file.size)}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={handleReset}>
            <X className="size-4" />
          </Button>
        </div>

        {/* Source CRS */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Source CRS</label>
          <select
            value={sourceEpsg}
            onChange={(e) => {
              const val = e.target.value ? Number(e.target.value) : ""
              setSourceEpsg(val)
              if (val === targetEpsg) setTargetEpsg("")
            }}
            className="w-full rounded-lg border bg-card px-3 py-2 text-sm"
          >
            <option value="">Select source CRS...</option>
            {CRS_LIST.map((crs) => (
              <option key={crs.epsg} value={crs.epsg}>{crs.label}</option>
            ))}
          </select>
        </div>

        {/* Target CRS */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Target CRS</label>
          <select
            value={targetEpsg}
            onChange={(e) => setTargetEpsg(e.target.value ? Number(e.target.value) : "")}
            className="w-full rounded-lg border bg-card px-3 py-2 text-sm"
          >
            <option value="">Select target CRS...</option>
            {availableTargets.map((crs) => (
              <option key={crs.epsg} value={crs.epsg}>{crs.label}</option>
            ))}
          </select>
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

        {/* Transform button */}
        <Button
          onClick={handleTransform}
          disabled={sourceEpsg === "" || targetEpsg === ""}
          className="w-full"
          size="lg"
        >
          <Globe className="size-4" />
          Convert Coordinates
        </Button>
      </div>
    )
  }

  // Transforming step
  if (state.step === "transforming") {
    const sourceLabel = CRS_LIST.find((c) => c.epsg === state.sourceEpsg)?.label || String(state.sourceEpsg)
    const targetLabel = CRS_LIST.find((c) => c.epsg === state.targetEpsg)?.label || String(state.targetEpsg)

    return (
      <div className="flex flex-col items-center justify-center rounded-lg border p-10 text-center">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="mt-4 text-sm font-medium">Converting coordinates...</p>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {sourceLabel} &rarr; {targetLabel}
        </p>
      </div>
    )
  }

  // Done step
  if (state.step === "done") {
    const sourceLabel = CRS_LIST.find((c) => c.epsg === state.sourceEpsg)?.label || String(state.sourceEpsg)
    const targetLabel = CRS_LIST.find((c) => c.epsg === state.targetEpsg)?.label || String(state.targetEpsg)

    return (
      <div className="space-y-4">
        {/* Success banner */}
        <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30">
          <div className="flex size-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
            <Check className="size-4 text-green-600 dark:text-green-400" />
          </div>
          <p className="text-sm font-medium text-green-700 dark:text-green-300">
            CRS conversion complete
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
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Source CRS</p>
              <p className="font-medium text-xs">{sourceLabel}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Target CRS</p>
              <p className="font-medium text-xs">{targetLabel}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Rows</p>
              <p className="font-medium">{state.rowCount.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Output</p>
              <p className="font-medium">{state.outputFilename}</p>
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
          Transform Another
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
            <p className="text-sm font-medium text-red-700 dark:text-red-300">CRS conversion failed</p>
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
