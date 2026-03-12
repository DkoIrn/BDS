"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { FileSpreadsheet, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { FileRowActions } from "@/components/files/file-row-actions"
import type { Dataset, DatasetStatus } from "@/lib/types/files"

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function StatusBadge({ status }: { status: DatasetStatus }) {
  const label = status.charAt(0).toUpperCase() + status.slice(1)

  switch (status) {
    case "uploaded":
      return <Badge variant="secondary">{label}</Badge>
    case "parsing":
      return (
        <Badge variant="default" className="gap-1">
          <Loader2 className="size-3 animate-spin" />
          {label}
        </Badge>
      )
    case "parsed":
      return (
        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
          {label}
        </Badge>
      )
    case "mapped":
      return (
        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
          {label}
        </Badge>
      )
    case "validating":
      return (
        <Badge variant="default" className="gap-1 animate-pulse">
          <Loader2 className="size-3 animate-spin" />
          Processing...
        </Badge>
      )
    case "validated":
      return (
        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
          Validated
        </Badge>
      )
    case "validation_error":
      return <Badge variant="destructive">Error</Badge>
    case "error":
      return <Badge variant="destructive">{label}</Badge>
    default:
      return <Badge variant="secondary">{label}</Badge>
  }
}

export function FileList({
  files,
  jobId,
  projectId,
}: {
  files: Dataset[]
  jobId: string
  projectId: string
}) {
  const [localFiles, setLocalFiles] = useState(files)

  // Sync with prop changes
  useEffect(() => {
    setLocalFiles(files)
  }, [files])

  // Realtime subscription for job-scoped dataset status changes
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel("file-list-" + jobId)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "datasets",
          filter: `job_id=eq.${jobId}`,
        },
        (payload: { new: { id: string; status: DatasetStatus } }) => {
          setLocalFiles((prev) =>
            prev.map((f) =>
              f.id === payload.new.id
                ? { ...f, status: payload.new.status }
                : f
            )
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [jobId])

  if (localFiles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
        <FileSpreadsheet className="size-8 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">
          No files uploaded yet
        </p>
      </div>
    )
  }

  const fileDetailUrl = (fileId: string) =>
    `/projects/${projectId}/jobs/${jobId}/files/${fileId}`

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>File Name</TableHead>
          <TableHead>Size</TableHead>
          <TableHead>Uploaded</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-[50px]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {localFiles.map((file) => (
          <TableRow key={file.id}>
            <TableCell>
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="size-4 shrink-0 text-muted-foreground" />
                <Link
                  href={fileDetailUrl(file.id)}
                  className={`font-medium hover:underline ${
                    file.status === "parsed"
                      ? "font-semibold text-primary"
                      : ""
                  }`}
                >
                  {file.file_name}
                </Link>
                {file.status === "parsed" && (
                  <Link
                    href={fileDetailUrl(file.id)}
                    className="text-xs text-primary hover:underline"
                  >
                    Map Columns
                  </Link>
                )}
              </div>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {formatFileSize(file.file_size)}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {formatDate(file.created_at)}
            </TableCell>
            <TableCell>
              <StatusBadge status={file.status} />
            </TableCell>
            <TableCell>
              <FileRowActions fileId={file.id} fileName={file.file_name} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
