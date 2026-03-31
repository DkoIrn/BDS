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
  Scissors,
  Plus,
  Trash2,
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

type SplitMode = "kp" | "column"

interface KpRange {
  start: string
  end: string
}

interface SplitFileInfo {
  name: string
  label: string
}

type SplitState =
  | { step: "upload" }
  | { step: "configure"; file: File }
  | {
      step: "splitting"
      file: File
      mode: SplitMode
    }
  | {
      step: "done"
      file: File
      mode: SplitMode
      zipBlobUrl: string
      zipFilename: string
      splitFiles: SplitFileInfo[]
      warnings: string[]
      previewText: string | null
      previewFileName: string | null
      ranges: KpRange[]
      columnName: string
      outputFormat: OutputFormat
      formatChanged: boolean
    }
  | { step: "error"; file: File; message: string }

function getFileExtension(name: string): string {
  if (!name) return ""
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

async function extractCsvHeaders(file: File): Promise<string[]> {
  const text = await file.slice(0, 4096).text()
  const firstLine = text.split("\n")[0]
  return firstLine.split(",").map((h) => h.trim().replace(/^"|"$/g, ""))
}

function extractValueFromFilename(filename: string, mode: SplitMode): string {
  // For column mode: filename is like "column_value.csv" -> extract "value"
  // For kp mode: filename is like "kp_0.0_100.0.csv" -> extract the range
  const nameWithoutExt = filename.replace(/\.[^.]+$/, "")

  if (mode === "column") {
    // Backend names files as "{column}_{value}.ext"
    const underscoreIdx = nameWithoutExt.indexOf("_")
    if (underscoreIdx !== -1) {
      return nameWithoutExt.substring(underscoreIdx + 1)
    }
    return nameWithoutExt
  }

  return nameWithoutExt
}

export function SplitTool() {
  const [state, setState] = useState<SplitState>({ step: "upload" })
  const [mode, setMode] = useState<SplitMode>("column")
  const [ranges, setRanges] = useState<KpRange[]>([{ start: "", end: "" }])
  const [columnName, setColumnName] = useState("")
  const [csvHeaders, setCsvHeaders] = useState<string[] | null>(null)
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("geojson")
  const [formatChanged, setFormatChanged] = useState(false)
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null)
  const zipBlobUrlRef = useRef<string | null>(null)

  const revokeZipBlobUrl = useCallback(() => {
    if (zipBlobUrlRef.current) {
      URL.revokeObjectURL(zipBlobUrlRef.current)
      zipBlobUrlRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => revokeZipBlobUrl()
  }, [revokeZipBlobUrl])

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0]
      setState({ step: "configure", file })
      setRanges([{ start: "", end: "" }])
      setColumnName("")
      setOutputFormat(detectDefaultFormat(file.name))
      setFormatChanged(false)

      // Try to extract CSV headers
      const ext = getFileExtension(file.name)
      if (ext === ".csv") {
        try {
          const headers = await extractCsvHeaders(file)
          setCsvHeaders(headers)
        } catch {
          setCsvHeaders(null)
        }
      } else {
        setCsvHeaders(null)
      }
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: MAX_FILE_SIZE,
    multiple: false,
    validator: (file) => {
      const ext = getFileExtension(file.name || "")
      if (ext && !ACCEPTED_EXTENSIONS.includes(ext)) {
        return { code: "file-invalid-type", message: `Unsupported file type: ${ext}` }
      }
      return null
    },
  })

  const addRange = () => {
    setRanges((prev) => [...prev, { start: "", end: "" }])
  }

  const removeRange = (index: number) => {
    setRanges((prev) => prev.filter((_, i) => i !== index))
  }

  const updateRange = (index: number, field: "start" | "end", value: string) => {
    setRanges((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    )
  }

  const canSplit = () => {
    if (mode === "kp") {
      return ranges.every((r) => r.start !== "" && r.end !== "" && Number(r.start) < Number(r.end))
    }
    return columnName.trim() !== ""
  }

  const handleSplit = async () => {
    if (state.step !== "configure") return

    setState({ step: "splitting", file: state.file, mode })
    revokeZipBlobUrl()

    try {
      const formData = new FormData()
      formData.append("file", state.file)
      formData.append("mode", mode)
      formData.append("target_format", formatChanged ? outputFormat : "")

      if (mode === "kp") {
        const rangeValues = ranges.map((r) => [Number(r.start), Number(r.end)])
        formData.append("ranges", JSON.stringify(rangeValues))
      } else {
        formData.append("column_name", columnName)
      }

      const response = await fetch("/api/transform/split", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        const errorMessage = errorData?.error || `Split failed (${response.status})`
        setState({ step: "error", file: state.file, message: errorMessage })
        return
      }

      const splitFilesHeader = response.headers.get("X-Split-Files") || ""
      const fileNames = splitFilesHeader.split(",").map((n) => n.trim()).filter(Boolean)
      const splitFiles: SplitFileInfo[] = fileNames.map((name) => ({
        name,
        label: extractValueFromFilename(name, mode),
      }))

      const warningsHeader = response.headers.get("X-Transform-Warnings") || ""
      const warnings = warningsHeader ? warningsHeader.split("|").filter(Boolean) : []

      // Store the ZIP blob for Download All
      const blob = await response.blob()
      const zipBlobUrl = URL.createObjectURL(blob)
      zipBlobUrlRef.current = zipBlobUrl

      const contentDisposition = response.headers.get("Content-Disposition") || ""
      const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/)
      const zipFilename = filenameMatch?.[1] || "split_output.zip"

      // Fetch preview for the first file
      let previewText: string | null = null
      let previewFileName: string | null = null
      if (splitFiles.length > 0) {
        try {
          const preview = await fetchSingleFile(state.file, splitFiles[0], mode, ranges, columnName, outputFormat, formatChanged)
          previewText = preview
          previewFileName = splitFiles[0].name
        } catch {
          // Preview failed, not critical
        }
      }

      setState({
        step: "done",
        file: state.file,
        mode,
        zipBlobUrl,
        zipFilename,
        splitFiles,
        warnings,
        previewText,
        previewFileName,
        ranges,
        columnName,
        outputFormat,
        formatChanged,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Split failed"
      setState({ step: "error", file: state.file, message })
    }
  }

  const fetchSingleFile = async (
    file: File,
    splitFile: SplitFileInfo,
    splitMode: SplitMode,
    kpRanges: KpRange[],
    colName: string,
    format: OutputFormat,
    fmtChanged: boolean
  ): Promise<string> => {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("mode", splitMode)
    formData.append("target_format", fmtChanged ? format : "")

    if (splitMode === "column") {
      formData.append("column_name", colName)
      formData.append("single_value", splitFile.label)
    } else {
      // For KP mode, find the matching range from filename
      const nameWithoutExt = splitFile.name.replace(/\.[^.]+$/, "")
      // Backend names KP files like "kp_0.0_100.0"
      const parts = nameWithoutExt.split("_")
      if (parts.length >= 3) {
        const start = parseFloat(parts[parts.length - 2])
        const end = parseFloat(parts[parts.length - 1])
        formData.append("single_range", JSON.stringify([start, end]))
      } else if (kpRanges.length > 0) {
        // Fallback: use the first range
        formData.append("single_range", JSON.stringify([Number(kpRanges[0].start), Number(kpRanges[0].end)]))
      }
    }

    const response = await fetch("/api/transform/split", {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      throw new Error("Failed to fetch individual file")
    }

    return await response.text()
  }

  const handleDownloadSingle = async (splitFile: SplitFileInfo) => {
    if (state.step !== "done") return

    setDownloadingFile(splitFile.name)
    try {
      const text = await fetchSingleFile(
        state.file,
        splitFile,
        state.mode,
        state.ranges,
        state.columnName,
        state.outputFormat,
        state.formatChanged
      )

      const blob = new Blob([text], { type: "application/octet-stream" })
      const url = URL.createObjectURL(blob)
      triggerDownload(url, splitFile.name)
      URL.revokeObjectURL(url)

      // Update preview to show this file
      setState((prev) => {
        if (prev.step !== "done") return prev
        return { ...prev, previewText: text, previewFileName: splitFile.name }
      })
    } catch {
      // Download failed silently
    } finally {
      setDownloadingFile(null)
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
    revokeZipBlobUrl()
    setState({ step: "upload" })
    setRanges([{ start: "", end: "" }])
    setColumnName("")
    setCsvHeaders(null)
    setFormatChanged(false)
    setDownloadingFile(null)
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

        {/* Mode selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Split Mode</label>
          <div className="flex gap-2">
            <button
              onClick={() => setMode("column")}
              className={`flex-1 rounded-lg border p-3 text-center text-sm font-medium transition-colors ${
                mode === "column"
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border bg-card hover:border-primary/50"
              }`}
            >
              By Column Value
              <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                One file per unique value
              </span>
            </button>
            <button
              onClick={() => setMode("kp")}
              className={`flex-1 rounded-lg border p-3 text-center text-sm font-medium transition-colors ${
                mode === "kp"
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border bg-card hover:border-primary/50"
              }`}
            >
              By KP Range
              <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                One file per KP range
              </span>
            </button>
          </div>
        </div>

        {/* Column Value mode config */}
        {mode === "column" && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Column Name</label>
            {csvHeaders ? (
              <select
                value={columnName}
                onChange={(e) => setColumnName(e.target.value)}
                className="w-full rounded-lg border bg-card px-3 py-2 text-sm"
              >
                <option value="">Select a column...</option>
                {csvHeaders.map((header) => (
                  <option key={header} value={header}>
                    {header}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={columnName}
                onChange={(e) => setColumnName(e.target.value)}
                placeholder="Enter column name"
                className="w-full rounded-lg border bg-card px-3 py-2 text-sm"
              />
            )}
          </div>
        )}

        {/* KP Range mode config */}
        {mode === "kp" && (
          <div className="space-y-3">
            <label className="text-sm font-medium">KP Ranges</label>
            {ranges.map((range, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="flex flex-1 items-center gap-2">
                  <input
                    type="number"
                    value={range.start}
                    onChange={(e) => updateRange(index, "start", e.target.value)}
                    placeholder="Start KP"
                    className="w-full rounded-lg border bg-card px-3 py-2 text-sm"
                    step="any"
                  />
                  <span className="text-xs text-muted-foreground">to</span>
                  <input
                    type="number"
                    value={range.end}
                    onChange={(e) => updateRange(index, "end", e.target.value)}
                    placeholder="End KP"
                    className="w-full rounded-lg border bg-card px-3 py-2 text-sm"
                    step="any"
                  />
                </div>
                {ranges.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRange(index)}
                    className="shrink-0"
                  >
                    <Trash2 className="size-4 text-muted-foreground" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={addRange}
              className="w-full"
            >
              <Plus className="size-3" />
              Add Range
            </Button>
          </div>
        )}

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

        {/* Split button */}
        <Button
          onClick={handleSplit}
          disabled={!canSplit()}
          className="w-full"
          size="lg"
        >
          <Scissors className="size-4" />
          Split Dataset
        </Button>
      </div>
    )
  }

  // Splitting step
  if (state.step === "splitting") {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border p-10 text-center">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="mt-4 text-sm font-medium">Splitting dataset...</p>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {state.mode === "kp" ? "Splitting by KP range" : "Splitting by column value"}
        </p>
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
            Split complete -- {state.splitFiles.length} file{state.splitFiles.length !== 1 ? "s" : ""} created
          </p>
        </div>

        {/* Download All as ZIP */}
        <Button
          onClick={() => triggerDownload(state.zipBlobUrl, state.zipFilename)}
          className="w-full"
          size="lg"
        >
          <Download className="size-4" />
          Download All as ZIP
        </Button>

        {/* Individual file list */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Individual Files</p>
          <div className="divide-y rounded-lg border bg-card">
            {state.splitFiles.map((splitFile) => (
              <div
                key={splitFile.name}
                className="flex items-center justify-between px-4 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{splitFile.name}</p>
                  <p className="text-xs text-muted-foreground">{splitFile.label}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDownloadSingle(splitFile)}
                  disabled={downloadingFile === splitFile.name}
                  className="shrink-0"
                >
                  {downloadingFile === splitFile.name ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Download className="size-3" />
                  )}
                  <span className="ml-1.5">Download</span>
                </Button>
              </div>
            ))}
          </div>
        </div>

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
              <p className="text-xs text-muted-foreground">Split Mode</p>
              <p className="font-medium">{state.mode === "kp" ? "By KP Range" : "By Column Value"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Output Files</p>
              <p className="font-medium">{state.splitFiles.length}</p>
            </div>
          </div>
        </div>

        {/* Preview table */}
        {state.previewText && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Preview: {state.previewFileName || "Output"}
            </p>
            <OutputPreviewTable csvText={state.previewText} maxRows={20} />
          </div>
        )}

        {/* Reset */}
        <Button variant="outline" onClick={handleReset} className="w-full">
          Split Another
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
            <p className="text-sm font-medium text-red-700 dark:text-red-300">Split failed</p>
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
