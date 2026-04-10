"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ArrowRight, CheckCircle, Loader2 } from "lucide-react"
import type { FixPreview, FixType } from "../lib/fix-types"

const FIX_TYPE_LABELS: Record<FixType, string> = {
  fill_missing: "Fill Missing Values",
  remove_duplicates: "Remove Duplicates",
  smooth_spikes: "Smooth Spikes",
}

interface FixPreviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  preview: FixPreview | null
  onConfirm: () => void
  loading?: boolean
}

const MAX_DISPLAYED_ROWS = 50

export function FixPreviewModal({
  open,
  onOpenChange,
  preview,
  onConfirm,
  loading,
}: FixPreviewModalProps) {
  if (!preview) return null

  const label = FIX_TYPE_LABELS[preview.type]
  const displayRows = preview.affectedRows.slice(0, MAX_DISPLAYED_ROWS)
  const truncatedCount = preview.affectedRows.length - MAX_DISPLAYED_ROWS
  const isDuplicate = preview.type === "remove_duplicates"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{label} Preview</DialogTitle>
          <DialogDescription>
            {preview.totalAffected === 0
              ? `No issues found for this fix type.`
              : `${preview.totalAffected} row${preview.totalAffected !== 1 ? "s" : ""} will be affected.`}
          </DialogDescription>
        </DialogHeader>

        {preview.totalAffected === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30">
            <CheckCircle className="size-5 text-green-600 dark:text-green-400" />
            <p className="text-sm text-green-700 dark:text-green-300">
              No issues found for this fix type.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto min-h-0">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b text-left">
                  <th className="px-2 py-1.5 font-medium text-muted-foreground">Row</th>
                  {!isDuplicate && (
                    <th className="px-2 py-1.5 font-medium text-muted-foreground">Column</th>
                  )}
                  <th className="px-2 py-1.5 font-medium text-muted-foreground">Before</th>
                  <th className="px-2 py-1.5 font-medium text-muted-foreground">After</th>
                  <th className="px-2 py-1.5 font-medium text-muted-foreground">Explanation</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row, idx) => (
                  <tr key={idx} className="border-b last:border-0">
                    <td className="px-2 py-1.5 font-mono text-muted-foreground">{row.rowIndex}</td>
                    {!isDuplicate && (
                      <td className="px-2 py-1.5">{row.column ?? "-"}</td>
                    )}
                    <td className="px-2 py-1.5">
                      <span className="rounded bg-red-100 px-1.5 py-0.5 font-mono text-red-700 line-through dark:bg-red-900/50 dark:text-red-300">
                        {row.before || "(empty)"}
                      </span>
                    </td>
                    <td className="px-2 py-1.5">
                      <span className="rounded bg-green-100 px-1.5 py-0.5 font-mono text-green-700 dark:bg-green-900/50 dark:text-green-300">
                        {row.after}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground max-w-[200px] truncate">
                      {row.explanation}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {truncatedCount > 0 && (
              <p className="mt-2 px-2 text-xs text-muted-foreground">
                {truncatedCount} more change{truncatedCount !== 1 ? "s" : ""} not shown
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          {preview.totalAffected > 0 && (
            <Button onClick={onConfirm} disabled={loading}>
              {loading && <Loader2 className="mr-2 size-3.5 animate-spin" />}
              Apply Fix ({preview.totalAffected} row{preview.totalAffected !== 1 ? "s" : ""})
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
