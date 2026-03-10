"use client"

import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Job, JobStatus } from "@/lib/types/projects"

const statusVariantMap: Record<
  JobStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  pending: "outline",
  processing: "default",
  completed: "secondary",
  failed: "destructive",
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function JobsList({ jobs }: { jobs: Job[] }) {
  if (jobs.length === 0) return null

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Survey Type</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {jobs.map((job) => (
          <TableRow key={job.id}>
            <TableCell className="font-medium">{job.name}</TableCell>
            <TableCell>
              <Badge variant="outline">{job.survey_type}</Badge>
            </TableCell>
            <TableCell>
              <Badge variant={statusVariantMap[job.status]}>
                {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
              </Badge>
            </TableCell>
            <TableCell className="text-right text-muted-foreground">
              {formatDate(job.created_at)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
