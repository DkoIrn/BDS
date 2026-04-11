"use client"

import { useState } from "react"
import { AlertTriangle, ChevronDown, ChevronRight, RotateCcw } from "lucide-react"
import type { JobRun } from "@/lib/types/jobs"

interface JobErrorDisplayProps {
  jobRun: JobRun
  onRetry: () => void
  retrying?: boolean
}

export function JobErrorDisplay({ jobRun, onRetry, retrying }: JobErrorDisplayProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50/50 p-5">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-red-100">
          <AlertTriangle className="size-4 text-red-600" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-red-900">
            Validation Failed
          </h3>
          <p className="mt-1 text-sm text-red-700">
            {jobRun.errorSummary || "An unexpected error occurred during validation."}
          </p>
          <p className="mt-1 text-xs text-red-500">
            Failed after {jobRun.attemptNumber} of {jobRun.maxAttempts} attempts
            {jobRun.completedAt && (
              <> &middot; {new Date(jobRun.completedAt).toLocaleString()}</>
            )}
          </p>
        </div>
        <button
          onClick={onRetry}
          disabled={retrying}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-red-600 px-3.5 py-2 text-xs font-semibold text-white transition-all hover:bg-red-700 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RotateCcw className={`size-3.5 ${retrying ? "animate-spin" : ""}`} />
          {retrying ? "Retrying..." : "Retry"}
        </button>
      </div>

      {/* Expandable technical details */}
      {jobRun.errorDetail && (
        <div className="mt-3 border-t border-red-200 pt-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-800 transition-colors"
          >
            {expanded ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
            Technical Details
          </button>
          {expanded && (
            <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-red-950 p-3 text-xs text-red-200 font-mono whitespace-pre-wrap">
              {jobRun.errorDetail}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}
