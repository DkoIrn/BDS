"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronDown, ChevronUp, MoreHorizontal, Trash2 } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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

type SortColumn = "name" | "status" | "jobs" | "updated_at"
type SortDirection = "asc" | "desc"

function getJobCount(project: Project): number {
  return project.jobs?.[0]?.count ?? 0
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function ProjectsTable({ projects }: { projects: Project[] }) {
  const router = useRouter()
  const [sortColumn, setSortColumn] = useState<SortColumn>("updated_at")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)

  function handleSort(column: SortColumn) {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
    } else {
      setSortColumn(column)
      setSortDirection("asc")
    }
  }

  const sorted = [...projects].sort((a, b) => {
    const dir = sortDirection === "asc" ? 1 : -1

    switch (sortColumn) {
      case "name":
        return dir * a.name.localeCompare(b.name)
      case "status":
        return dir * a.status.localeCompare(b.status)
      case "jobs":
        return dir * (getJobCount(a) - getJobCount(b))
      case "updated_at":
        return dir * (new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime())
      default:
        return 0
    }
  })

  const allSelected = projects.length > 0 && selected.size === projects.length

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(projects.map((p) => p.id)))
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) return null
    return sortDirection === "asc" ? (
      <ChevronUp className="ml-1 inline size-3.5" />
    ) : (
      <ChevronDown className="ml-1 inline size-3.5" />
    )
  }

  return (
    <>
    {selected.size > 0 && (
      <div className="flex flex-col gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 mb-4 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <span className="text-sm font-medium">
          {selected.size} project{selected.size !== 1 ? "s" : ""} selected
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelected(new Set())}
          >
            Clear
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setBulkDeleteOpen(true)}
          >
            <Trash2 className="mr-1.5 size-3.5" />
            Delete selected
          </Button>
        </div>
      </div>
    )}

    <div className="overflow-x-auto">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="size-4 rounded border-muted-foreground/30 cursor-pointer accent-primary"
              aria-label="Select all projects"
            />
          </TableHead>
          <TableHead
            className="cursor-pointer select-none"
            onClick={() => handleSort("name")}
          >
            Name
            <SortIcon column="name" />
          </TableHead>
          <TableHead
            className="cursor-pointer select-none"
            onClick={() => handleSort("status")}
          >
            Status
            <SortIcon column="status" />
          </TableHead>
          <TableHead
            className="hidden sm:table-cell cursor-pointer select-none text-right"
            onClick={() => handleSort("jobs")}
          >
            Jobs
            <SortIcon column="jobs" />
          </TableHead>
          <TableHead
            className="hidden md:table-cell cursor-pointer select-none text-right"
            onClick={() => handleSort("updated_at")}
          >
            Last Updated
            <SortIcon column="updated_at" />
          </TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((project) => (
          <TableRow
            key={project.id}
            className={`group cursor-pointer transition-colors hover:bg-muted/50 ${selected.has(project.id) ? "bg-muted/30" : ""}`}
            onClick={() => router.push(`/projects/${project.id}`)}
          >
            <TableCell onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={selected.has(project.id)}
                onChange={() => toggleOne(project.id)}
                className="size-4 rounded border-muted-foreground/30 cursor-pointer accent-primary"
                aria-label={`Select ${project.name}`}
              />
            </TableCell>
            <TableCell>
              <Link
                href={`/projects/${project.id}`}
                className="font-medium text-foreground hover:underline"
              >
                {project.name}
              </Link>
            </TableCell>
            <TableCell>
              <ProjectStatusBadge status={project.status} />
            </TableCell>
            <TableCell className="hidden sm:table-cell text-right tabular-nums">
              {getJobCount(project)}
            </TableCell>
            <TableCell className="hidden md:table-cell text-right text-muted-foreground">
              {formatDate(project.updated_at)}
            </TableCell>
            <TableCell onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="ghost" size="icon" className="size-8" />
                  }
                >
                  <MoreHorizontal className="size-4" />
                  <span className="sr-only">Actions</span>
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
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    </div>

    {deleteTarget && (
      <DeleteProjectDialog
        projectId={deleteTarget.id}
        projectName={deleteTarget.name}
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
      />
    )}

    {bulkDeleteOpen && (
      <DeleteProjectDialog
        projectIds={[...selected]}
        projectName={`${selected.size} project${selected.size !== 1 ? "s" : ""}`}
        open={bulkDeleteOpen}
        onOpenChange={(open) => {
          if (!open) {
            setBulkDeleteOpen(false)
            setSelected(new Set())
          }
        }}
      />
    )}
    </>
  )
}
