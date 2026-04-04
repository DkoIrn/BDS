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
    <Table>
      <TableHeader>
        <TableRow>
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
            className="cursor-pointer select-none text-right"
            onClick={() => handleSort("jobs")}
          >
            Jobs
            <SortIcon column="jobs" />
          </TableHead>
          <TableHead
            className="cursor-pointer select-none text-right"
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
            className="group cursor-pointer transition-colors hover:bg-muted/50"
            onClick={() => router.push(`/projects/${project.id}`)}
          >
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
            <TableCell className="text-right tabular-nums">
              {getJobCount(project)}
            </TableCell>
            <TableCell className="text-right text-muted-foreground">
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
