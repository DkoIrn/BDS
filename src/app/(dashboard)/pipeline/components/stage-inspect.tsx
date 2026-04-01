"use client"

import { useEffect, useState } from "react"
import Papa from "papaparse"
import * as XLSX from "xlsx"
import {
  Eye,
  Loader2,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  SkipForward,
  FileText,
  Columns3,
  Rows3,
  Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { PipelineState, PipelineAction } from "../lib/pipeline-state"

interface StageInspectProps {
  state: PipelineState
  dispatch: React.Dispatch<PipelineAction>
  fileRef: React.MutableRefObject<File | null>
}

const MAX_PREVIEW_ROWS = 50

export function StageInspect({ state, dispatch, fileRef }: StageInspectProps) {
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)

  // Auto-parse on mount
  useEffect(() => {
    if (state.parsedData) return // Already parsed
    if (parsing) return

    if (state.fileSource === "upload" && fileRef.current) {
      parseUploadedFile(fileRef.current)
    } else if (state.fileSource === "existing" && state.datasetId) {
      // For existing datasets, we would fetch preview from Supabase.
      // For now, show a message that the data needs to be fetched.
      fetchExistingDataset(state.datasetId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function parseUploadedFile(file: File) {
    setParsing(true)
    setParseError(null)

    const minDelay = new Promise((r) => setTimeout(r, 1200))

    try {
      const ext = file.name
        .substring(file.name.lastIndexOf("."))
        .toLowerCase()

      let data: string[][]

      if (ext === ".csv") {
        ;[data] = await Promise.all([parseCsv(file), minDelay]) as [string[][], unknown]
      } else if (ext === ".xlsx" || ext === ".xls") {
        ;[data] = await Promise.all([parseExcel(file), minDelay]) as [string[][], unknown]
      } else {
        // For geospatial formats (geojson, kml, etc.), send to parse endpoint
        ;[data] = await Promise.all([parseViaApi(file), minDelay]) as [string[][], unknown]
      }

      if (data.length < 2) {
        setParseError("File appears to be empty or contains only headers.")
        setParsing(false)
        return
      }

      const columnCount = data[0].length
      const rowCount = data.length - 1 // Subtract header

      dispatch({
        type: "INSPECT_COMPLETE",
        parsedData: data,
        columnCount,
        rowCount,
      })
    } catch (err) {
      await minDelay
      const message =
        err instanceof Error ? err.message : "Failed to parse file"
      setParseError(message)
    } finally {
      setParsing(false)
    }
  }

  async function fetchExistingDataset(datasetId: string) {
    setParsing(true)
    setParseError(null)

    try {
      // Fetch preview via dataset signed URL and re-parse
      const { getDatasetSignedUrl } = await import("@/lib/actions/files")
      const result = await getDatasetSignedUrl(datasetId)

      if ("error" in result) {
        setParseError(result.error)
        setParsing(false)
        return
      }

      const response = await fetch(result.url)
      const blob = await response.blob()
      const file = new File([blob], result.fileName)

      // Store in fileRef for export stage
      fileRef.current = file

      await parseUploadedFile(file)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch dataset"
      setParseError(message)
      setParsing(false)
    }
  }

  // Loading state
  if (parsing) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="flex flex-col items-center justify-center py-16 animate-fade-up">
          <div className="relative flex size-14 items-center justify-center">
            <div className="absolute inset-0 animate-spin rounded-full border-2 border-muted border-t-foreground" />
            <Eye className="size-5 text-foreground" />
          </div>
          <p className="mt-5 text-sm font-semibold text-foreground">
            Analyzing data...
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Detecting columns, rows, and data types
          </p>
        </CardContent>
      </Card>
    )
  }

  // Error state
  if (parseError) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="space-y-4 py-8">
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-red-500 dark:text-red-400" />
            <div>
              <p className="text-sm font-medium text-red-700 dark:text-red-300">
                Failed to parse file
              </p>
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {parseError}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => dispatch({ type: "RESET" })}
          >
            Try Again
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Data preview (parsed data available)
  if (state.parsedData) {
    const headers = state.parsedData[0] || []
    const rows = state.parsedData.slice(1, MAX_PREVIEW_ROWS + 1)

    return (
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="size-5" />
            Data Preview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <Columns3 className="size-4 text-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">Columns</p>
                <p className="text-lg font-semibold">{state.columnCount}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <Rows3 className="size-4 text-emerald-500" />
              <div>
                <p className="text-xs text-muted-foreground">Rows</p>
                <p className="text-lg font-semibold">
                  {state.rowCount?.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <FileText className="size-4 text-amber-500" />
              <div>
                <p className="text-xs text-muted-foreground">File</p>
                <p className="truncate text-sm font-medium">
                  {state.fileName}
                </p>
              </div>
            </div>
          </div>

          {/* Data table */}
          <div className="max-h-96 overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  {headers.map((header, i) => (
                    <TableHead key={i} className="whitespace-nowrap">
                      {header || `Column ${i + 1}`}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, rowIdx) => (
                  <TableRow key={rowIdx}>
                    {row.map((cell, cellIdx) => (
                      <TableCell
                        key={cellIdx}
                        className="max-w-[200px] truncate whitespace-nowrap"
                      >
                        {cell}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {(state.rowCount ?? 0) > MAX_PREVIEW_ROWS && (
            <p className="text-xs text-muted-foreground">
              Showing first {MAX_PREVIEW_ROWS} of{" "}
              {state.rowCount?.toLocaleString()} rows
            </p>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => dispatch({ type: "RESET" })}
            >
              <ArrowLeft className="mr-2 size-4" />
              Back
            </Button>
            <button
              onClick={() =>
                dispatch({ type: "GO_TO_STAGE", stage: "validate" })
              }
              className="group inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-all hover:opacity-90 active:scale-[0.98]"
            >
              Continue to Validate
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

  // Fallback: waiting state (shouldn't normally render)
  return (
    <Card className="rounded-2xl">
      <CardContent className="flex flex-col items-center justify-center py-16">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="mt-4 text-sm font-medium">Preparing inspection...</p>
      </CardContent>
    </Card>
  )
}

// --- Parser utilities ---

function parseCsv(file: File): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        resolve(results.data as string[][])
      },
      error: (err: Error) => {
        reject(new Error(`CSV parse error: ${err.message}`))
      },
    })
  })
}

async function parseExcel(file: File): Promise<string[][]> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { raw: false })
  const firstSheet = workbook.SheetNames[0]
  if (!firstSheet) throw new Error("Excel file has no sheets")
  const sheet = workbook.Sheets[firstSheet]
  const data = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
  })
  return data
}

async function parseViaApi(file: File): Promise<string[][]> {
  const formData = new FormData()
  formData.append("file", file)

  const response = await fetch("/api/parse", {
    method: "POST",
    body: formData,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => null)
    throw new Error(
      errorData?.error || `Parse failed (${response.status})`
    )
  }

  const result = await response.json()
  return result.data as string[][]
}
