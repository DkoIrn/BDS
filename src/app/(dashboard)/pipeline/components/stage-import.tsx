"use client"

import { useCallback, useEffect, useState } from "react"
import { useDropzone } from "react-dropzone"
import {
  Upload,
  Database,
  FileText,
  Loader2,
  ChevronDown,
  RefreshCw,
  Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { PipelineState, PipelineAction } from "../lib/pipeline-state"
import { getAllUserDatasets, getDatasetSignedUrl } from "@/lib/actions/files"

export interface StagePanelProps {
  state: PipelineState
  dispatch: React.Dispatch<PipelineAction>
}

interface StageImportProps extends StagePanelProps {
  fileRef: React.MutableRefObject<File | null>
}

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

interface DatasetInfo {
  id: string
  file_name: string
  file_size: number
  job_name: string
  project_name: string
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function StageImport({ state, dispatch, fileRef }: StageImportProps) {
  const [mode, setMode] = useState<"upload" | "existing">("upload")

  // If revisiting completed import, show summary
  if (state.stages.import.completed) {
    return (
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Check className="size-5 text-green-600" />
            Import Complete
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
            <FileText className="size-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Imported: {state.fileName}</p>
              <p className="text-xs text-muted-foreground">
                Source: {state.fileSource === "upload" ? "File upload" : "Existing dataset"}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => dispatch({ type: "RESET" })}
          >
            <RefreshCw className="mr-2 size-4" />
            Re-import
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="size-5" />
          Import Data
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Mode toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setMode("upload")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all active:scale-[0.98] ${
              mode === "upload"
                ? "bg-foreground text-background"
                : "border border-border bg-background text-foreground hover:bg-muted/60"
            }`}
          >
            <Upload className="size-3.5" />
            Upload New File
          </button>
          <button
            onClick={() => setMode("existing")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all active:scale-[0.98] ${
              mode === "existing"
                ? "bg-foreground text-background"
                : "border border-border bg-background text-foreground hover:bg-muted/60"
            }`}
          >
            <Database className="size-3.5" />
            Select Existing Dataset
          </button>
        </div>

        {mode === "upload" ? (
          <UploadTab dispatch={dispatch} fileRef={fileRef} />
        ) : (
          <ExistingTab dispatch={dispatch} />
        )}
      </CardContent>
    </Card>
  )
}

function UploadTab({
  dispatch,
  fileRef,
}: {
  dispatch: React.Dispatch<PipelineAction>
  fileRef: React.MutableRefObject<File | null>
}) {
  const [uploading, setUploading] = useState<{ name: string; size: number } | null>(null)

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0]
        fileRef.current = file
        setUploading({ name: file.name, size: file.size })

        // Minimum animation duration so users see the transition
        setTimeout(() => {
          dispatch({ type: "IMPORT_FILE", fileName: file.name })
        }, 1400)
      }
    },
    [dispatch, fileRef]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: MAX_FILE_SIZE,
    multiple: false,
    disabled: !!uploading,
    accept: ACCEPTED_EXTENSIONS.reduce(
      (acc, ext) => {
        acc["application/octet-stream"] = [
          ...(acc["application/octet-stream"] || []),
          ext,
        ]
        return acc
      },
      {} as Record<string, string[]>
    ),
    validator: (file) => {
      if (!file?.name) return null
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

  // Upload animation state
  if (uploading) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border bg-card py-14 animate-fade-up">
        <div className="relative flex size-14 items-center justify-center">
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-muted border-t-foreground" />
          <FileText className="size-5 text-foreground" />
        </div>
        <p className="mt-5 text-sm font-semibold text-foreground">
          Importing file...
        </p>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {uploading.name}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground/60">
          {formatFileSize(uploading.size)}
        </p>
      </div>
    )
  }

  return (
    <div
      {...getRootProps()}
      className={`cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
        isDragActive
          ? "border-foreground bg-foreground/5"
          : "border-border hover:border-foreground/40 hover:bg-muted/50"
      }`}
    >
      <input {...getInputProps()} />
      <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-muted">
        <Upload className="size-5 text-muted-foreground" />
      </div>
      <p className="mt-4 text-sm font-medium">
        {isDragActive ? "Drop your file here" : "Drag & drop a file here"}
      </p>
      <p className="mt-1.5 text-xs text-muted-foreground">
        {isDragActive
          ? "Release to upload"
          : "or click to browse"}
      </p>
      <p className="mt-3 text-xs text-muted-foreground">
        CSV, Excel, GeoJSON, Shapefile (ZIP), KML, KMZ, LandXML, DXF -- up to 50 MB
      </p>
    </div>
  )
}

function ExistingTab({
  dispatch,
}: {
  dispatch: React.Dispatch<PipelineAction>
}) {
  const [datasets, setDatasets] = useState<DatasetInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (loaded) return
    setLoading(true)
    getAllUserDatasets().then((result) => {
      if ("data" in result) {
        setDatasets(
          result.data.map((d) => ({
            id: d.id,
            file_name: d.file_name,
            file_size: d.file_size,
            job_name: d.job_name,
            project_name: d.project_name,
          }))
        )
      }
      setLoading(false)
      setLoaded(true)
    })
  }, [loaded])

  const handleSelect = (dataset: DatasetInfo) => {
    dispatch({
      type: "IMPORT_EXISTING",
      datasetId: dataset.id,
      fileName: dataset.file_name,
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border p-8">
        <Loader2 className="size-4 animate-spin" />
        <span className="text-sm text-muted-foreground">
          Loading datasets...
        </span>
      </div>
    )
  }

  if (datasets.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <Database className="mx-auto size-8 text-muted-foreground/50" />
        <p className="mt-3 text-sm font-medium">No datasets found</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Upload a file to get started.
        </p>
      </div>
    )
  }

  return (
    <div className="max-h-80 overflow-auto rounded-lg border">
      <div className="divide-y">
        {datasets.map((dataset) => (
          <button
            key={dataset.id}
            onClick={() => handleSelect(dataset)}
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
          >
            <FileText className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {dataset.file_name}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {dataset.project_name} / {dataset.job_name} --{" "}
                {formatFileSize(dataset.file_size)}
              </p>
            </div>
            <ChevronDown className="size-3.5 -rotate-90 text-muted-foreground" />
          </button>
        ))}
      </div>
    </div>
  )
}
