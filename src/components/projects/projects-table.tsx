"use client"

import { useState } from "react"
import Link from "next/link"
import { FolderOpen, Briefcase, MoreHorizontal, Trash2, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ProjectStatusBadge } from "@/components/projects/project-status-badge"
import { DeleteProjectDialog } from "@/components/projects/delete-project-dialog"
import type { Project } from "@/lib/types/projects"

function getJobCount(project: Project): number {
  return project.jobs?.[0]?.count ?? 0
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

export function ProjectsTable({ projects }: { projects: Project[] }) {
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  const sorted = [...projects].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  )

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((project) => {
          const jobCount = getJobCount(project)
          return (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="group relative flex flex-col rounded-2xl border bg-card p-5 transition-all hover:border-foreground/20 hover:shadow-md"
            >
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/50">
                    <FolderOpen className="size-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {project.name}
                    </h3>
                    <ProjectStatusBadge status={project.status} />
                  </div>
                </div>
                <div onClick={(e) => e.preventDefault()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="ghost" size="icon" className="size-8 opacity-0 group-hover:opacity-100 transition-opacity" />
                      }
                    >
                      <MoreHorizontal className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setDeleteTarget({ id: project.id, name: project.name })}
                      >
                        <Trash2 className="mr-2 size-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Description */}
              {project.description && (
                <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                  {project.description}
                </p>
              )}

              {/* Stats */}
              <div className="mt-4 flex items-center gap-4 border-t pt-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Briefcase className="size-3.5" />
                  <span>{jobCount} job{jobCount !== 1 ? "s" : ""}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="size-3.5" />
                  <span>{formatTimeAgo(project.updated_at)}</span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {deleteTarget && (
        <DeleteProjectDialog
          projectId={deleteTarget.id}
          projectName={deleteTarget.name}
          open={!!deleteTarget}
          onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        />
      )}
    </>
  )
}
