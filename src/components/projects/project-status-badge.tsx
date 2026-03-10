"use client"

import { Badge } from "@/components/ui/badge"
import type { ProjectStatus } from "@/lib/types/projects"

const statusVariantMap: Record<ProjectStatus, "default" | "secondary" | "outline"> = {
  active: "default",
  completed: "secondary",
  archived: "outline",
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <Badge variant={statusVariantMap[status]}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  )
}
