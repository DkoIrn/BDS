"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { FileSpreadsheet, FileText, Loader2, ChevronRight, Clock, LayoutList, LayoutGrid } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { HealthBadge } from "@/components/files/health-badge"
import { getJobValidationSummary } from "@/lib/actions/validation"
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

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase()
  if (ext === "csv") return FileText
  return FileSpreadsheet
}

const statusConfig: Record<string, { label: string; className: string; dot: string }> = {
  uploaded: { label: "Uploaded", className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400", dot: "bg-slate-400" },
  parsing: { label: "Parsing", className: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400", dot: "bg-blue-500 animate-pulse" },
  parsed: { label: "Ready to Map", className: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400", dot: "bg-amber-500" },
  mapped: { label: "Mapped", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400", dot: "bg-emerald-500" },
  validating: { label: "Processing", className: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400", dot: "bg-blue-500 animate-pulse" },
  validated: { label: "Validated", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400", dot: "bg-emerald-500" },
  validation_error: { label: "Error", className: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400", dot: "bg-red-500" },
  error: { label: "Error", className: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400", dot: "bg-red-500" },
}

function StatusBadge({ status }: { status: DatasetStatus }) {
  const config = statusConfig[status] || statusConfig.uploaded
  const isLoading = status === "parsing" || status === "validating"

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${config.className}`}>
      {isLoading ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <span className={`size-1.5 rounded-full ${config.dot}`} />
      )}
      {config.label}
    </span>
  )
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
  const router = useRouter()
  const [localFiles, setLocalFiles] = useState(files)
  const [healthData, setHealthData] = useState<Map<string, { passRate: number | null; issueCount: number; criticalCount: number }>>(new Map())

  // Sync with prop changes
  useEffect(() => {
    setLocalFiles(files)
  }, [files])

  // Fetch health scores
  useEffect(() => {
    getJobValidationSummary(jobId).then((result) => {
      if ("data" in result) {
        const map = new Map<string, { passRate: number | null; issueCount: number; criticalCount: number }>()
        for (const summary of result.data) {
          map.set(summary.id, {
            passRate: summary.passRate,
            issueCount: summary.issueCount,
            criticalCount: summary.verdict === "FAIL" ? 1 : 0,
          })
        }
        setHealthData(map)
      }
    })
  }, [jobId])

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

  const [view, setView] = useState<"cards" | "table">("cards")

  if (localFiles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-14">
        <div className="rounded-lg bg-muted p-3">
          <FileSpreadsheet className="size-6 text-muted-foreground/40" />
        </div>
        <p className="mt-3 text-sm font-medium text-muted-foreground">
          No files uploaded yet
        </p>
        <p className="mt-1 text-xs text-muted-foreground/60">
          Drop files above to get started
        </p>
      </div>
    )
  }

  const fileDetailUrl = (fileId: string) =>
    `/projects/${projectId}/jobs/${jobId}/files/${fileId}`

  return (
    <div className="space-y-3">
      {/* View toggle */}
      <div className="flex justify-end">
        <div className="flex rounded-md border bg-muted/50 p-0.5">
          <Button
            variant="ghost"
            size="icon"
            className={`size-7 rounded-sm ${view === "cards" ? "bg-background shadow-sm" : "hover:bg-transparent"}`}
            onClick={() => setView("cards")}
          >
            <LayoutGrid className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={`size-7 rounded-sm ${view === "table" ? "bg-background shadow-sm" : "hover:bg-transparent"}`}
            onClick={() => setView("table")}
          >
            <LayoutList className="size-3.5" />
          </Button>
        </div>
      </div>

      {view === "cards" ? (
        <div className="space-y-1.5">
          {localFiles.map((file) => {
            const FileIcon = getFileIcon(file.file_name)
            const needsAction = file.status === "parsed"
            return (
              <div
                key={file.id}
                className="group flex items-center gap-3.5 rounded-lg border bg-card px-3.5 py-3 transition-all cursor-pointer hover:shadow-sm hover:border-border"
                onClick={() => router.push(fileDetailUrl(file.id))}
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
                  <FileIcon className="size-4 text-muted-foreground" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={fileDetailUrl(file.id)}
                      className="truncate text-sm font-medium text-foreground group-hover:text-primary transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {file.file_name}
                    </Link>
                    {needsAction && (
                      <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        Map columns
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2.5 text-xs text-muted-foreground">
                    <span>{formatFileSize(file.file_size)}</span>
                    <span className="size-0.5 rounded-full bg-muted-foreground/30" />
                    <span>{formatDate(file.created_at)}</span>
                  </div>
                </div>

                <StatusBadge status={file.status} />

                {healthData.has(file.id) && (
                  <HealthBadge
                    passRate={healthData.get(file.id)!.passRate}
                    totalIssues={healthData.get(file.id)!.issueCount}
                    criticalCount={healthData.get(file.id)!.criticalCount}
                  />
                )}

                <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                  <FileRowActions fileId={file.id} fileName={file.file_name} />
                </div>

                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/20 transition-colors group-hover:text-muted-foreground" />
              </div>
            )
          })}
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="w-24">Size</TableHead>
                <TableHead className="w-28">Uploaded</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead className="w-20">Health</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {localFiles.map((file) => {
                const FileIcon = getFileIcon(file.file_name)
                return (
                  <TableRow
                    key={file.id}
                    className="cursor-pointer"
                    onClick={() => router.push(fileDetailUrl(file.id))}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <FileIcon className="size-4 shrink-0 text-muted-foreground" />
                        <Link
                          href={fileDetailUrl(file.id)}
                          className="text-sm font-medium hover:text-primary transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {file.file_name}
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatFileSize(file.file_size)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(file.created_at)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={file.status} />
                    </TableCell>
                    <TableCell>
                      {healthData.has(file.id) && (
                        <HealthBadge
                          passRate={healthData.get(file.id)!.passRate}
                          totalIssues={healthData.get(file.id)!.issueCount}
                          criticalCount={healthData.get(file.id)!.criticalCount}
                          compact
                        />
                      )}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <FileRowActions fileId={file.id} fileName={file.file_name} />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
