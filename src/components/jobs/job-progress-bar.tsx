"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { ValidationProgress, ValidationStage } from "@/lib/types/jobs"
import { stageToPercent } from "@/lib/types/jobs"

const STAGE_LABELS: Record<ValidationStage, string> = {
  starting: "Starting validation...",
  downloading: "Downloading dataset...",
  parsing: "Parsing data...",
  validating: "Running QC checks...",
  storing_results: "Storing results...",
  complete: "Validation complete",
  error: "Validation error",
}

interface JobProgressBarProps {
  datasetId: string
  initialProgress?: ValidationProgress | null
}

export function JobProgressBar({ datasetId, initialProgress }: JobProgressBarProps) {
  const [progress, setProgress] = useState<ValidationProgress | null>(
    initialProgress ?? null
  )

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`progress-${datasetId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "datasets",
          filter: `id=eq.${datasetId}`,
        },
        (payload: { new: { validation_progress?: ValidationProgress } }) => {
          const newProgress = payload.new.validation_progress
          if (newProgress) {
            setProgress(newProgress)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [datasetId])

  if (!progress) return null

  const percent = stageToPercent(progress.stage)
  const isComplete = progress.stage === "complete"
  const isError = progress.stage === "error"
  const isRunning = !isComplete && !isError

  const label = STAGE_LABELS[progress.stage] ?? progress.stage
  const detail = progress.detail

  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-foreground">
          {label}
        </span>
        {!isError && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {percent}%
          </span>
        )}
      </div>

      {!isError && (
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={`h-2 rounded-full transition-all duration-700 ease-out ${
              isComplete ? "bg-emerald-500" : "bg-blue-500"
            } ${isRunning ? "animate-pulse" : ""}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}

      {detail && (
        <p className="mt-1.5 text-xs text-muted-foreground">{detail}</p>
      )}
    </div>
  )
}
