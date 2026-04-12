"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import {
  GitBranch,
  AlertTriangle,
  FileText,
  TrendingDown,
  TrendingUp,
  Minus,
  Layers,
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { fetchVersions } from "@/lib/actions/versions"
import { VersionDiffView } from "./version-diff-view"
import type { DatasetVersion } from "@/lib/types/versions"

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDays = Math.floor(diffHr / 24)

  if (diffSec < 60) return "just now"
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface VersionTimelineProps {
  datasetId: string
}

export function VersionTimeline({ datasetId }: VersionTimelineProps) {
  const [versions, setVersions] = useState<DatasetVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<number[]>([])
  const [comparing, setComparing] = useState<{
    versionA: number
    versionB: number
  } | null>(null)

  const loadVersions = useCallback(async () => {
    try {
      const data = await fetchVersions(datasetId)
      setVersions(data)
    } catch (err) {
      toast.error("Failed to load version history")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [datasetId])

  useEffect(() => {
    loadVersions()
  }, [loadVersions])

  // Listen for realtime version inserts
  useEffect(() => {
    const handler = () => {
      loadVersions()
    }
    window.addEventListener("truqc:version-created", handler)
    return () => window.removeEventListener("truqc:version-created", handler)
  }, [loadVersions])

  const handleSelect = (versionNumber: number, checked: boolean) => {
    if (checked) {
      if (selected.length >= 2) {
        // Replace oldest selection
        setSelected([selected[1], versionNumber])
      } else {
        setSelected([...selected, versionNumber])
      }
    } else {
      setSelected(selected.filter((v) => v !== versionNumber))
    }
  }

  const handleCompare = () => {
    if (selected.length === 2) {
      const sorted = [...selected].sort((a, b) => a - b)
      setComparing({ versionA: sorted[0], versionB: sorted[1] })
    }
  }

  const handleBackFromDiff = () => {
    setComparing(null)
    setSelected([])
  }

  if (comparing) {
    return (
      <VersionDiffView
        datasetId={datasetId}
        versionA={comparing.versionA}
        versionB={comparing.versionB}
        onBack={handleBackFromDiff}
      />
    )
  }

  if (loading) {
    return (
      <div className="space-y-4 p-5">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    )
  }

  if (versions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <GitBranch className="mb-3 h-10 w-10 text-muted-foreground/50" />
        <p className="text-muted-foreground">
          No versions yet. Versions are created automatically when you run
          validation.
        </p>
      </div>
    )
  }

  // Compute trend summary
  const latestVersion = versions[0]
  const oldestVersion = versions[versions.length - 1]
  const issueTrendPct =
    oldestVersion.issue_count > 0
      ? Math.round(
          ((latestVersion.issue_count - oldestVersion.issue_count) /
            oldestVersion.issue_count) *
            100
        )
      : 0
  const rowCountChange = latestVersion.row_count - oldestVersion.row_count

  return (
    <div className="space-y-4 p-5">
      {/* Trend Summary Header */}
      <div className="grid grid-cols-1 gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-3">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-teal-500" />
          <span className="text-sm text-muted-foreground">Versions</span>
          <span className="font-semibold">{versions.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <span className="text-sm text-muted-foreground">Issues</span>
          <span className="font-semibold">
            {oldestVersion.issue_count} &rarr; {latestVersion.issue_count}
          </span>
          {issueTrendPct !== 0 && (
            <span
              className={`flex items-center text-xs font-medium ${
                issueTrendPct < 0 ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {issueTrendPct < 0 ? (
                <TrendingDown className="mr-0.5 h-3 w-3" />
              ) : (
                <TrendingUp className="mr-0.5 h-3 w-3" />
              )}
              {Math.abs(issueTrendPct)}%
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-blue-500" />
          <span className="text-sm text-muted-foreground">Rows</span>
          <span className="font-semibold">
            {latestVersion.row_count.toLocaleString()}
          </span>
          {rowCountChange !== 0 && (
            <span
              className={`text-xs font-medium ${
                rowCountChange > 0 ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {rowCountChange > 0 ? "+" : ""}
              {rowCountChange}
            </span>
          )}
          {rowCountChange === 0 && (
            <Minus className="h-3 w-3 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Vertical Timeline */}
      <div className="relative space-y-0">
        {/* Timeline line */}
        <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-border sm:block hidden" />

        {versions.map((version, index) => (
          <div key={version.id} className="relative flex gap-4 pb-4">
            {/* Timeline dot */}
            <div className="relative z-10 mt-5 hidden sm:flex">
              <div
                className={`h-3 w-3 rounded-full border-2 ${
                  index === 0
                    ? "border-teal-500 bg-teal-500"
                    : "border-muted-foreground/30 bg-background"
                }`}
              />
            </div>

            {/* Version Card */}
            <div className="flex-1 rounded-2xl border bg-card p-4 transition-colors hover:bg-accent/50">
              <div className="flex items-start gap-3">
                {/* Checkbox */}
                <Checkbox
                  checked={selected.includes(version.version_number)}
                  onCheckedChange={(checked) =>
                    handleSelect(version.version_number, checked === true)
                  }
                  aria-label={`Select version ${version.version_number} for comparison`}
                  className="mt-1"
                />

                <div className="flex-1 space-y-2">
                  {/* Header row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-teal-600">
                        v{version.version_number}
                      </span>
                      <span
                        className="text-xs text-muted-foreground"
                        title={new Date(version.created_at).toLocaleString()}
                      >
                        {formatRelativeTime(version.created_at)}
                      </span>
                    </div>
                    {index === 0 && (
                      <Badge variant="secondary" className="text-xs">
                        Latest
                      </Badge>
                    )}
                  </div>

                  {/* Metadata row */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span>{version.row_count.toLocaleString()} rows</span>
                    <span>{version.column_count} cols</span>
                    <span>{formatFileSize(version.file_size)}</span>
                  </div>

                  {/* Issues row */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {version.issue_count} issues
                    </span>
                    {version.severity_breakdown.critical > 0 && (
                      <Badge
                        variant="destructive"
                        className="h-5 px-1.5 text-[10px]"
                      >
                        {version.severity_breakdown.critical} critical
                      </Badge>
                    )}
                    {version.severity_breakdown.warning > 0 && (
                      <Badge
                        variant="outline"
                        className="h-5 border-amber-300 px-1.5 text-[10px] text-amber-600"
                      >
                        {version.severity_breakdown.warning} warning
                      </Badge>
                    )}
                    {version.severity_breakdown.info > 0 && (
                      <Badge
                        variant="outline"
                        className="h-5 border-blue-300 px-1.5 text-[10px] text-blue-600"
                      >
                        {version.severity_breakdown.info} info
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Sticky Compare Footer */}
      {selected.length === 2 && (
        <div className="sticky bottom-4 z-20 flex items-center justify-center">
          <Button
            onClick={handleCompare}
            className="cursor-pointer rounded-full shadow-lg"
          >
            Compare v{Math.min(...selected)} &harr; v{Math.max(...selected)}
          </Button>
        </div>
      )}
    </div>
  )
}
