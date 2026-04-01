"use client"

import { useCallback, useState } from "react"
import { useDropzone } from "react-dropzone"
import {
  Upload,
  Download,
  AlertCircle,
  Loader2,
  Check,
  X,
  FileText,
  GitCompareArrows,
  Equal,
  AlertTriangle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { DatasetPicker } from "@/components/tools/dataset-picker"

const ACCEPTED_EXTENSIONS = [
  ".csv", ".xlsx", ".xls", ".geojson", ".json", ".zip", ".kml", ".kmz", ".xml", ".dxf",
]

const MAX_FILE_SIZE = 50 * 1024 * 1024

interface ColumnDiff {
  base: string
  compare: string
  diff: number | null
  match: boolean
}

interface RowResult {
  key: Record<string, string>
  columns: Record<string, ColumnDiff>
}

interface CompareResponse {
  summary: {
    base_rows: number
    compare_rows: number
    matched: number
    mismatched: number
    only_in_base: number
    only_in_compare: number
    match_percentage: number
    tolerance: number
    key_columns: string[]
    compared_columns: string[]
  }
  matched_rows: RowResult[]
  mismatched_rows: RowResult[]
  only_in_base: string[][]
  only_in_compare: string[][]
  headers: string[]
  warnings: string[]
}

type CompareState =
  | { step: "upload" }
  | { step: "configure"; baseFile: File; compareFile: File }
  | { step: "comparing"; baseFile: File; compareFile: File }
  | { step: "done"; baseFile: File; compareFile: File; result: CompareResponse }
  | { step: "error"; baseFile: File; compareFile: File; message: string }

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

function exportDiffCsv(result: CompareResponse): string {
  const keyCols = result.summary.key_columns
  const compareCols = result.summary.compared_columns

  const headerRow = [
    "status",
    ...keyCols,
    ...compareCols.flatMap((c) => [`${c}_base`, `${c}_compare`, `${c}_diff`]),
  ]

  const rows: string[][] = []

  for (const row of result.mismatched_rows) {
    const r: string[] = ["MISMATCH"]
    for (const k of keyCols) r.push(row.key[k] || "")
    for (const c of compareCols) {
      const d = row.columns[c]
      r.push(d?.base || "", d?.compare || "", d?.diff != null ? String(d.diff) : "")
    }
    rows.push(r)
  }

  for (const row of result.matched_rows) {
    const r: string[] = ["MATCH"]
    for (const k of keyCols) r.push(row.key[k] || "")
    for (const c of compareCols) {
      const d = row.columns[c]
      r.push(d?.base || "", d?.compare || "", d?.diff != null ? String(d.diff) : "")
    }
    rows.push(r)
  }

  const csvContent = [headerRow, ...rows].map((r) => r.join(",")).join("\n")
  return csvContent
}

export function CompareTool() {
  const [state, setState] = useState<CompareState>({ step: "upload" })
  const [baseFile, setBaseFile] = useState<File | null>(null)
  const [compareFile, setCompareFile] = useState<File | null>(null)
  const [baseHeaders, setBaseHeaders] = useState<string[] | null>(null)
  const [keyColumns, setKeyColumns] = useState<string[]>([])
  const [tolerance, setTolerance] = useState("0")
  const [activeTab, setActiveTab] = useState<"mismatched" | "matched" | "missing">("mismatched")

  const handleFileDrop = useCallback(async (files: File[], target: "base" | "compare") => {
    if (files.length === 0) return
    const file = files[0]

    if (target === "base") {
      setBaseFile(file)
      const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase()
      if (ext === ".csv") {
        try {
          const headers = await extractCsvHeaders(file)
          setBaseHeaders(headers)
        } catch {
          setBaseHeaders(null)
        }
      } else {
        setBaseHeaders(null)
      }
    } else {
      setCompareFile(file)
    }
  }, [])

  const baseDropzone = useDropzone({
    onDrop: (files) => handleFileDrop(files, "base"),
    maxSize: MAX_FILE_SIZE,
    multiple: false,
    validator: (file) => {
      const ext = (file.name || "").substring((file.name || "").lastIndexOf(".")).toLowerCase()
      if (ext && !ACCEPTED_EXTENSIONS.includes(ext))
        return { code: "file-invalid-type", message: `Unsupported: ${ext}` }
      return null
    },
  })

  const compareDropzone = useDropzone({
    onDrop: (files) => handleFileDrop(files, "compare"),
    maxSize: MAX_FILE_SIZE,
    multiple: false,
    validator: (file) => {
      const ext = (file.name || "").substring((file.name || "").lastIndexOf(".")).toLowerCase()
      if (ext && !ACCEPTED_EXTENSIONS.includes(ext))
        return { code: "file-invalid-type", message: `Unsupported: ${ext}` }
      return null
    },
  })

  const handleConfigure = () => {
    if (baseFile && compareFile) {
      setState({ step: "configure", baseFile, compareFile })
    }
  }

  const toggleKeyColumn = (col: string) => {
    setKeyColumns((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    )
  }

  const handleCompare = async () => {
    if (state.step !== "configure") return
    if (keyColumns.length === 0) return

    setState({ step: "comparing", baseFile: state.baseFile, compareFile: state.compareFile })

    try {
      const formData = new FormData()
      formData.append("base_file", state.baseFile)
      formData.append("compare_file", state.compareFile)
      formData.append("key_columns", JSON.stringify(keyColumns))
      formData.append("tolerance", tolerance || "0")

      const response = await fetch("/api/compare", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        const errorMessage = errorData?.error || `Compare failed (${response.status})`
        setState({ step: "error", baseFile: state.baseFile, compareFile: state.compareFile, message: errorMessage })
        return
      }

      const result: CompareResponse = await response.json()

      setState({
        step: "done",
        baseFile: state.baseFile,
        compareFile: state.compareFile,
        result,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Compare failed"
      setState({ step: "error", baseFile: state.baseFile, compareFile: state.compareFile, message })
    }
  }

  const handleExport = () => {
    if (state.step !== "done") return
    const csv = exportDiffCsv(state.result)
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "comparison_report.csv"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleReset = () => {
    setState({ step: "upload" })
    setBaseFile(null)
    setCompareFile(null)
    setBaseHeaders(null)
    setKeyColumns([])
    setTolerance("0")
    setActiveTab("mismatched")
  }

  // Upload step
  if (state.step === "upload") {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          {/* Base file */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-blue-600">As-Designed (Base)</label>
            {baseFile ? (
              <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900 dark:bg-blue-950/20">
                <FileText className="size-4 text-blue-500" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{baseFile.name}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(baseFile.size)}</p>
                </div>
                <Button variant="ghost" size="icon" className="size-7" onClick={() => { setBaseFile(null); setBaseHeaders(null); setKeyColumns([]) }}>
                  <X className="size-3" />
                </Button>
              </div>
            ) : (
              <>
                <div
                  {...baseDropzone.getRootProps()}
                  className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                    baseDropzone.isDragActive
                      ? "border-blue-400 bg-blue-50/50"
                      : "border-border hover:border-blue-300 hover:bg-blue-50/30"
                  }`}
                >
                  <input {...baseDropzone.getInputProps()} />
                  <div className="mx-auto flex size-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/30">
                    <Upload className="size-4 text-blue-400" />
                  </div>
                  <p className="mt-3 text-xs font-medium">Drop base file</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">CSV, Excel, GeoJSON...</p>
                </div>
                <DatasetPicker onSelect={(file) => handleFileDrop([file], "base")} label="Select from projects" />
              </>
            )}
          </div>

          {/* Compare file */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-amber-600">As-Built (Compare)</label>
            {compareFile ? (
              <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
                <FileText className="size-4 text-amber-500" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{compareFile.name}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(compareFile.size)}</p>
                </div>
                <Button variant="ghost" size="icon" className="size-7" onClick={() => setCompareFile(null)}>
                  <X className="size-3" />
                </Button>
              </div>
            ) : (
              <>
                <div
                  {...compareDropzone.getRootProps()}
                  className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                    compareDropzone.isDragActive
                      ? "border-amber-400 bg-amber-50/50"
                      : "border-border hover:border-amber-300 hover:bg-amber-50/30"
                  }`}
                >
                  <input {...compareDropzone.getInputProps()} />
                  <div className="mx-auto flex size-10 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/30">
                    <Upload className="size-4 text-amber-400" />
                  </div>
                  <p className="mt-3 text-xs font-medium">Drop compare file</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">CSV, Excel, GeoJSON...</p>
                </div>
                <DatasetPicker onSelect={(file) => handleFileDrop([file], "compare")} label="Select from projects" />
              </>
            )}
          </div>
        </div>

        <Button
          onClick={handleConfigure}
          disabled={!baseFile || !compareFile}
          className="w-full"
          size="lg"
        >
          <GitCompareArrows className="size-4" />
          {!baseFile || !compareFile ? "Upload both files to continue" : "Configure Comparison"}
        </Button>
      </div>
    )
  }

  // Configure step
  if (state.step === "configure") {
    return (
      <div className="space-y-6">
        {/* File summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900 dark:bg-blue-950/20">
            <p className="text-[11px] font-medium text-blue-600">Base</p>
            <p className="truncate text-sm font-medium">{state.baseFile.name}</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900 dark:bg-amber-950/20">
            <p className="text-[11px] font-medium text-amber-600">Compare</p>
            <p className="truncate text-sm font-medium">{state.compareFile.name}</p>
          </div>
        </div>

        {/* Key columns */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Key Columns (for row matching)</label>
          <p className="text-xs text-muted-foreground">Select which columns uniquely identify each row</p>
          {baseHeaders ? (
            <div className="flex flex-wrap gap-2">
              {baseHeaders.map((header) => (
                <button
                  key={header}
                  onClick={() => toggleKeyColumn(header)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    keyColumns.includes(header)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card hover:border-primary/50"
                  }`}
                >
                  {header}
                </button>
              ))}
            </div>
          ) : (
            <input
              type="text"
              placeholder="Enter column names separated by commas"
              className="w-full rounded-lg border bg-card px-3 py-2 text-sm"
              onChange={(e) =>
                setKeyColumns(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))
              }
            />
          )}
          {keyColumns.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Selected: {keyColumns.join(", ")}
            </p>
          )}
        </div>

        {/* Tolerance */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Numeric Tolerance</label>
          <p className="text-xs text-muted-foreground">Absolute difference threshold for numeric values (0 = exact match)</p>
          <input
            type="number"
            value={tolerance}
            onChange={(e) => setTolerance(e.target.value)}
            placeholder="0"
            step="any"
            min="0"
            className="w-full rounded-lg border bg-card px-3 py-2 text-sm"
          />
        </div>

        {/* Compare button */}
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset} className="flex-1">
            Back
          </Button>
          <Button
            onClick={handleCompare}
            disabled={keyColumns.length === 0}
            className="flex-1"
            size="lg"
          >
            <GitCompareArrows className="size-4" />
            Compare Datasets
          </Button>
        </div>
      </div>
    )
  }

  // Comparing step
  if (state.step === "comparing") {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border p-10 text-center">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="mt-4 text-sm font-medium">Comparing datasets...</p>
        <p className="mt-1.5 text-xs text-muted-foreground">Matching rows and checking differences</p>
      </div>
    )
  }

  // Done step
  if (state.step === "done") {
    const { result } = state
    const { summary } = result

    return (
      <div className="space-y-4">
        {/* Summary banner */}
        <div className={`flex items-center gap-3 rounded-lg border p-4 ${
          summary.mismatched > 0 || summary.only_in_base > 0 || summary.only_in_compare > 0
            ? "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30"
            : "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30"
        }`}>
          <div className={`flex size-8 items-center justify-center rounded-full ${
            summary.mismatched > 0
              ? "bg-amber-100 dark:bg-amber-900"
              : "bg-green-100 dark:bg-green-900"
          }`}>
            {summary.mismatched > 0 ? (
              <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
            ) : (
              <Check className="size-4 text-green-600 dark:text-green-400" />
            )}
          </div>
          <div>
            <p className={`text-sm font-medium ${
              summary.mismatched > 0
                ? "text-amber-700 dark:text-amber-300"
                : "text-green-700 dark:text-green-300"
            }`}>
              {summary.match_percentage}% match rate
            </p>
            <p className="text-xs text-muted-foreground">
              {summary.matched} matched, {summary.mismatched} mismatched, {summary.only_in_base + summary.only_in_compare} missing
            </p>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-lg border bg-card p-3 text-center">
            <p className="text-lg font-semibold">{summary.base_rows}</p>
            <p className="text-[11px] text-muted-foreground">Base Rows</p>
          </div>
          <div className="rounded-lg border bg-card p-3 text-center">
            <p className="text-lg font-semibold">{summary.compare_rows}</p>
            <p className="text-[11px] text-muted-foreground">Compare Rows</p>
          </div>
          <div className="rounded-lg border bg-card p-3 text-center">
            <p className="text-lg font-semibold text-green-600">{summary.matched}</p>
            <p className="text-[11px] text-muted-foreground">Matched</p>
          </div>
          <div className="rounded-lg border bg-card p-3 text-center">
            <p className="text-lg font-semibold text-red-500">{summary.mismatched}</p>
            <p className="text-[11px] text-muted-foreground">Mismatched</p>
          </div>
        </div>

        {/* Export */}
        <Button onClick={handleExport} className="w-full" size="lg">
          <Download className="size-4" />
          Export Diff Report (CSV)
        </Button>

        {/* Tabs */}
        <div className="flex gap-1 rounded-lg border bg-muted/50 p-1">
          <button
            onClick={() => setActiveTab("mismatched")}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === "mismatched" ? "bg-background shadow-sm" : "hover:bg-background/50"
            }`}
          >
            Mismatched ({summary.mismatched})
          </button>
          <button
            onClick={() => setActiveTab("matched")}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === "matched" ? "bg-background shadow-sm" : "hover:bg-background/50"
            }`}
          >
            Matched ({summary.matched})
          </button>
          <button
            onClick={() => setActiveTab("missing")}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === "missing" ? "bg-background shadow-sm" : "hover:bg-background/50"
            }`}
          >
            Missing ({summary.only_in_base + summary.only_in_compare})
          </button>
        </div>

        {/* Results table */}
        <div className="overflow-auto rounded-lg border">
          {activeTab === "mismatched" && (
            result.mismatched_rows.length > 0 ? (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/50">
                    {summary.key_columns.map((col) => (
                      <th key={col} className="whitespace-nowrap px-3 py-2 text-left font-medium">{col}</th>
                    ))}
                    {summary.compared_columns.map((col) => (
                      <th key={col} className="whitespace-nowrap px-3 py-2 text-left font-medium" colSpan={3}>
                        {col}
                      </th>
                    ))}
                  </tr>
                  <tr className="border-b bg-muted/30">
                    {summary.key_columns.map((col) => (
                      <th key={col} className="px-3 py-1 text-left text-[10px] text-muted-foreground">key</th>
                    ))}
                    {summary.compared_columns.map((col) => (
                      <>
                        <th key={`${col}-base`} className="px-3 py-1 text-left text-[10px] text-blue-500">base</th>
                        <th key={`${col}-comp`} className="px-3 py-1 text-left text-[10px] text-amber-500">compare</th>
                        <th key={`${col}-diff`} className="px-3 py-1 text-left text-[10px] text-red-400">diff</th>
                      </>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.mismatched_rows.slice(0, 100).map((row, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                      {summary.key_columns.map((col) => (
                        <td key={col} className="whitespace-nowrap px-3 py-2 font-medium">{row.key[col]}</td>
                      ))}
                      {summary.compared_columns.map((col) => {
                        const d = row.columns[col]
                        return (
                          <>
                            <td key={`${col}-b`} className="whitespace-nowrap px-3 py-2">{d?.base}</td>
                            <td key={`${col}-c`} className="whitespace-nowrap px-3 py-2">{d?.compare}</td>
                            <td key={`${col}-d`} className={`whitespace-nowrap px-3 py-2 ${
                              d?.match ? "text-green-600" : "text-red-500 font-medium"
                            }`}>
                              {d?.diff != null ? d.diff : (d?.match ? "=" : "≠")}
                            </td>
                          </>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex flex-col items-center gap-2 p-8 text-center">
                <Equal className="size-6 text-green-500" />
                <p className="text-sm text-muted-foreground">No mismatches found</p>
              </div>
            )
          )}

          {activeTab === "matched" && (
            result.matched_rows.length > 0 ? (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/50">
                    {summary.key_columns.map((col) => (
                      <th key={col} className="whitespace-nowrap px-3 py-2 text-left font-medium">{col}</th>
                    ))}
                    {summary.compared_columns.map((col) => (
                      <th key={col} className="whitespace-nowrap px-3 py-2 text-left font-medium">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.matched_rows.slice(0, 100).map((row, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                      {summary.key_columns.map((col) => (
                        <td key={col} className="whitespace-nowrap px-3 py-2 font-medium">{row.key[col]}</td>
                      ))}
                      {summary.compared_columns.map((col) => (
                        <td key={col} className="whitespace-nowrap px-3 py-2">{row.columns[col]?.base}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex flex-col items-center gap-2 p-8 text-center">
                <AlertTriangle className="size-6 text-amber-500" />
                <p className="text-sm text-muted-foreground">No matched rows</p>
              </div>
            )
          )}

          {activeTab === "missing" && (
            (result.only_in_base.length > 0 || result.only_in_compare.length > 0) ? (
              <div className="divide-y">
                {result.only_in_base.length > 0 && (
                  <div className="p-4">
                    <p className="mb-2 text-xs font-medium text-blue-600">Only in base ({result.only_in_base.length} rows)</p>
                    <div className="overflow-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b bg-blue-50/50 dark:bg-blue-950/20">
                            {result.headers.map((h) => (
                              <th key={h} className="whitespace-nowrap px-2 py-1.5 text-left font-medium">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {result.only_in_base.slice(0, 50).map((row, i) => (
                            <tr key={i} className="border-b last:border-0">
                              {row.slice(0, result.headers.length).map((cell, j) => (
                                <td key={j} className="whitespace-nowrap px-2 py-1.5">{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {result.only_in_compare.length > 0 && (
                  <div className="p-4">
                    <p className="mb-2 text-xs font-medium text-amber-600">Only in compare ({result.only_in_compare.length} rows)</p>
                    <div className="overflow-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b bg-amber-50/50 dark:bg-amber-950/20">
                            {result.headers.map((h) => (
                              <th key={h} className="whitespace-nowrap px-2 py-1.5 text-left font-medium">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {result.only_in_compare.slice(0, 50).map((row, i) => (
                            <tr key={i} className="border-b last:border-0">
                              {row.slice(0, result.headers.length).map((cell, j) => (
                                <td key={j} className="whitespace-nowrap px-2 py-1.5">{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 p-8 text-center">
                <Check className="size-6 text-green-500" />
                <p className="text-sm text-muted-foreground">All rows present in both datasets</p>
              </div>
            )
          )}
        </div>

        {/* Warnings */}
        {result.warnings.length > 0 && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-950/30">
            <p className="mb-2 text-xs font-medium text-yellow-700 dark:text-yellow-300">Warnings</p>
            <ul className="space-y-1">
              {result.warnings.map((warning, i) => (
                <li key={i} className="text-xs text-yellow-600 dark:text-yellow-400">{warning}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Reset */}
        <Button variant="outline" onClick={handleReset} className="w-full">
          Compare Another
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
            <p className="text-sm font-medium text-red-700 dark:text-red-300">Compare failed</p>
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
