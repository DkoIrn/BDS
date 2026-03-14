"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatRunDate, getRunProfileName } from "@/lib/utils/severity"
import type { ValidationRun } from "@/lib/types/validation"

interface RunSwitcherProps {
  runs: ValidationRun[]
  selectedRunId: string
  onRunChange: (runId: string) => void
}

export function RunSwitcher({ runs, selectedRunId, onRunChange }: RunSwitcherProps) {
  if (runs.length <= 1) return null

  const selectedRun = runs.find((r) => r.id === selectedRunId)
  const triggerLabel = selectedRun
    ? `${formatRunDate(selectedRun.run_at)} — ${selectedRun.total_issues} issues`
    : "Select run"

  return (
    <Select
      value={selectedRunId}
      onValueChange={(v) => { if (v) onRunChange(v) }}
    >
      <SelectTrigger className="w-[280px]">
        <SelectValue placeholder={triggerLabel}>{triggerLabel}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {runs.map((run) => (
          <SelectItem key={run.id} value={run.id}>
            {formatRunDate(run.run_at)} — {getRunProfileName(run)} — {run.total_issues} issues
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
