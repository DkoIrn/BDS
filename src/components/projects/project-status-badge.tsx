"use client"

import type { ProjectStatus } from "@/lib/types/projects"

const statusStyles: Record<ProjectStatus, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  completed: "bg-blue-50 text-blue-700 border-blue-200",
  archived: "bg-muted text-muted-foreground border-border",
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${statusStyles[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}
