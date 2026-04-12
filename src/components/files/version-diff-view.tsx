"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import {
  ArrowLeft,
  Plus,
  Minus,
  Pencil,
  ChevronDown,
  ChevronRight,
  Loader2,
  CheckCircle2,
  RotateCcw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchVersionDiff } from "@/lib/actions/versions"
import type { VersionDiff, DiffRow, ModifiedRow } from "@/lib/types/versions"

interface VersionDiffViewProps {
  datasetId: string
  versionA: number
  versionB: number
  onBack: () => void
}

export function VersionDiffView({
  datasetId,
  versionA,
  versionB,
  onBack,
}: VersionDiffViewProps) {
  const [diff, setDiff] = useState<VersionDiff | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)

  // Expandable section state
  const [showAdded, setShowAdded] = useState(false)
  const [showRemoved, setShowRemoved] = useState(false)
  const [showModified, setShowModified] = useState(true)

  const loadDiff = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const data = await fetchVersionDiff(datasetId, versionA, versionB, 1)
      setDiff(data)
      setPage(1)
    } catch (err) {
      setError(true)
      toast.error("Failed to compute version differences")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [datasetId, versionA, versionB])

  useEffect(() => {
    loadDiff()
  }, [loadDiff])

  const loadMore = async () => {
    if (!diff || !diff.pagination.has_more) return
    setLoadingMore(true)
    try {
      const nextPage = page + 1
      const moreData = await fetchVersionDiff(
        datasetId,
        versionA,
        versionB,
        nextPage
      )
      setDiff({
        ...moreData,
        added: [...diff.added, ...moreData.added],
        removed: [...diff.removed, ...moreData.removed],
        modified: [...diff.modified, ...moreData.modified],
      })
      setPage(nextPage)
    } catch (err) {
      toast.error("Failed to load more rows")
      console.error(err)
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <div className="space-y-4 p-5">
      {/* Back button */}
      <Button
        variant="ghost"
        onClick={onBack}
        aria-label="Back to version history"
        className="cursor-pointer gap-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to version history
      </Button>

      {/* Loading state */}
      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Computing differences...
          </div>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="flex flex-col items-center gap-3 py-12">
          <p className="text-sm text-muted-foreground">
            Failed to load comparison data.
          </p>
          <Button
            variant="outline"
            onClick={loadDiff}
            className="cursor-pointer gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Retry
          </Button>
        </div>
      )}

      {/* Empty diff state */}
      {diff &&
        !loading &&
        diff.summary.added_count === 0 &&
        diff.summary.removed_count === 0 &&
        diff.summary.modified_count === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            <p className="text-sm text-muted-foreground">
              No differences found between v{versionA} and v{versionB}
            </p>
          </div>
        )}

      {/* Summary Card */}
      {diff && !loading && (
        <>
          <div className="rounded-2xl border bg-card p-5">
            <h3 className="mb-4 font-semibold">
              Comparing v{versionA} and v{versionB}
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Rows Before</p>
                <p className="font-semibold">
                  {diff.summary.rows_before.toLocaleString()}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Rows After</p>
                <p className="font-semibold">
                  {diff.summary.rows_after.toLocaleString()}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Added</p>
                <p className="font-semibold text-emerald-600">
                  +{diff.summary.added_count}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Removed</p>
                <p className="font-semibold text-red-600">
                  -{diff.summary.removed_count}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Modified</p>
                <p className="font-semibold text-amber-600">
                  {diff.summary.modified_count}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Columns</p>
                <p className="font-semibold">
                  {diff.summary.columns_before} &rarr;{" "}
                  {diff.summary.columns_after}
                </p>
              </div>
            </div>
          </div>

          {/* Expandable Sections */}
          {diff.summary.added_count > 0 && (
            <DiffSection
              title={`Added Rows (${diff.pagination.total_added})`}
              icon={<Plus className="h-4 w-4 text-emerald-600" />}
              accentClass="border-l-emerald-500"
              open={showAdded}
              onToggle={() => setShowAdded(!showAdded)}
            >
              {diff.added.map((row) => (
                <DiffRowCard key={`add-${row.row}`} row={row} type="added" />
              ))}
            </DiffSection>
          )}

          {diff.summary.removed_count > 0 && (
            <DiffSection
              title={`Removed Rows (${diff.pagination.total_removed})`}
              icon={<Minus className="h-4 w-4 text-red-600" />}
              accentClass="border-l-red-500"
              open={showRemoved}
              onToggle={() => setShowRemoved(!showRemoved)}
            >
              {diff.removed.map((row) => (
                <DiffRowCard
                  key={`rem-${row.row}`}
                  row={row}
                  type="removed"
                />
              ))}
            </DiffSection>
          )}

          {diff.summary.modified_count > 0 && (
            <DiffSection
              title={`Modified Rows (${diff.pagination.total_modified})`}
              icon={<Pencil className="h-4 w-4 text-amber-600" />}
              accentClass="border-l-amber-500"
              open={showModified}
              onToggle={() => setShowModified(!showModified)}
            >
              {diff.modified.map((row) => (
                <ModifiedRowCard key={`mod-${row.row}`} row={row} />
              ))}
            </DiffSection>
          )}

          {/* Load More */}
          {diff.pagination.has_more && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                onClick={loadMore}
                disabled={loadingMore}
                className="cursor-pointer gap-2"
              >
                {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                Load more rows
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* --- Sub-components --- */

function DiffSection({
  title,
  icon,
  accentClass,
  open,
  onToggle,
  children,
}: {
  title: string
  icon: React.ReactNode
  accentClass: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className={`rounded-2xl border border-l-4 ${accentClass} bg-card`}>
      <button
        onClick={onToggle}
        className="flex w-full cursor-pointer items-center gap-2 p-4 text-left font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-2xl"
        aria-expanded={open}
        aria-label={`Toggle ${title}`}
      >
        {icon}
        <span className="flex-1">{title}</span>
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {open && <div className="space-y-2 px-4 pb-4">{children}</div>}
    </div>
  )
}

function DiffRowCard({ row, type }: { row: DiffRow; type: "added" | "removed" }) {
  const bgClass =
    type === "added" ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-red-50 dark:bg-red-950/30"
  return (
    <div className={`rounded-lg p-3 text-xs ${bgClass}`}>
      <span className="font-medium text-muted-foreground">Row {row.row}</span>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
        {Object.entries(row.values).map(([col, val]) => (
          <span key={col}>
            <span className="text-muted-foreground">{col}:</span> {val}
          </span>
        ))}
      </div>
    </div>
  )
}

function ModifiedRowCard({ row }: { row: ModifiedRow }) {
  return (
    <div className="rounded-lg bg-amber-50 p-3 text-xs dark:bg-amber-950/30">
      <span className="font-medium text-muted-foreground">Row {row.row}</span>
      <div className="mt-1 space-y-1">
        {Object.entries(row.changes).map(([col, change]) => (
          <div key={col} className="flex flex-wrap items-center gap-1">
            <span className="font-medium text-muted-foreground">{col}:</span>
            <span className="line-through text-red-600">{change.old}</span>
            <span className="text-muted-foreground">&rarr;</span>
            <span className="text-emerald-600">{change.new}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
