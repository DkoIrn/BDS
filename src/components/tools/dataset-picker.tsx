"use client"

import { useCallback, useEffect, useState } from "react"
import { Database, Loader2, FileText, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getAllUserDatasets, getDatasetSignedUrl } from "@/lib/actions/files"

interface DatasetInfo {
  id: string
  file_name: string
  file_size: number
  job_name: string
  project_name: string
}

interface DatasetPickerProps {
  onSelect: (file: File) => void
  label?: string
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function DatasetPicker({ onSelect, label = "Or select from your projects" }: DatasetPickerProps) {
  const [open, setOpen] = useState(false)
  const [datasets, setDatasets] = useState<DatasetInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)

  const fetchDatasets = useCallback(async () => {
    if (datasets.length > 0) return
    setLoading(true)
    const result = await getAllUserDatasets()
    if ("data" in result) {
      setDatasets(result.data)
    }
    setLoading(false)
  }, [datasets.length])

  useEffect(() => {
    if (open) fetchDatasets()
  }, [open, fetchDatasets])

  const handleSelect = async (dataset: DatasetInfo) => {
    setDownloading(dataset.id)
    try {
      const result = await getDatasetSignedUrl(dataset.id)
      if ("error" in result) return

      const response = await fetch(result.url)
      const blob = await response.blob()
      const file = new File([blob], result.fileName, { type: blob.type })
      onSelect(file)
      setOpen(false)
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-lg border bg-card px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
      >
        <span className="flex items-center gap-2">
          <Database className="size-3.5" />
          {label}
        </span>
        <ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="max-h-60 overflow-auto rounded-lg border bg-card">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-4">
              <Loader2 className="size-3.5 animate-spin" />
              <span className="text-xs text-muted-foreground">Loading datasets...</span>
            </div>
          ) : datasets.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              No datasets found in your projects
            </div>
          ) : (
            <div className="divide-y">
              {datasets.map((dataset) => (
                <button
                  key={dataset.id}
                  onClick={() => handleSelect(dataset)}
                  disabled={downloading !== null}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50 disabled:opacity-50"
                >
                  {downloading === dataset.id ? (
                    <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />
                  ) : (
                    <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{dataset.file_name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {dataset.project_name} / {dataset.job_name} · {formatFileSize(dataset.file_size)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
