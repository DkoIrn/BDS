"use client"

import type { ActivityEventType } from "@/lib/types/activity"

const FILTER_CONFIG: { type: ActivityEventType; label: string; dotColor: string }[] = [
  { type: "validation_run", label: "Validations", dotColor: "bg-emerald-500" },
  { type: "validation_failed", label: "Failures", dotColor: "bg-red-500" },
  { type: "cleaning_applied", label: "Fixes", dotColor: "bg-amber-500" },
  { type: "comment_added", label: "Comments", dotColor: "bg-blue-500" },
  { type: "comment_resolved", label: "Resolved", dotColor: "bg-teal-500" },
  { type: "report_exported", label: "Exports", dotColor: "bg-violet-500" },
  { type: "certificate_generated", label: "Certificates", dotColor: "bg-indigo-500" },
  { type: "dataset_uploaded", label: "Uploads", dotColor: "bg-sky-500" },
]

interface ActivityFiltersProps {
  activeFilters: Set<ActivityEventType>
  onFilterChange: (filters: Set<ActivityEventType>) => void
}

export function ActivityFilters({
  activeFilters,
  onFilterChange,
}: ActivityFiltersProps) {
  function toggleFilter(type: ActivityEventType) {
    const next = new Set(activeFilters)
    if (next.has(type)) {
      next.delete(type)
    } else {
      next.add(type)
    }
    onFilterChange(next)
  }

  return (
    <div className="flex flex-wrap gap-2">
      {FILTER_CONFIG.map(({ type, label, dotColor }) => {
        const active = activeFilters.has(type)
        return (
          <button
            key={type}
            type="button"
            onClick={() => toggleFilter(type)}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              active
                ? "bg-foreground text-background"
                : "border border-border bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            <span
              className={`inline-block size-2 rounded-full ${
                active ? "bg-background" : dotColor
              }`}
            />
            {label}
          </button>
        )
      })}
    </div>
  )
}
