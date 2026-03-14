"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getJobValidationSummary } from "@/lib/actions/validation"
import { formatRunDate } from "@/lib/utils/severity"
import type { JobDatasetSummary } from "@/lib/types/validation"

interface JobResultsTableProps {
  jobId: string
  projectId: string
}

export function JobResultsTable({ jobId, projectId }: JobResultsTableProps) {
  const router = useRouter()
  const [summaries, setSummaries] = useState<JobDatasetSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchSummary() {
      setLoading(true)
      const result = await getJobValidationSummary(jobId)
      if ("data" in result) {
        setSummaries(result.data)
      }
      setLoading(false)
    }

    fetchSummary()
  }, [jobId])

  if (loading) {
    return (
      <div className="space-y-3 pt-4">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (summaries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-sm text-muted-foreground">
          No datasets in this job yet.
        </p>
      </div>
    )
  }

  const validatedCount = summaries.filter((s) => s.isValidated).length
  const totalDatasets = summaries.length
  const totalIssues = summaries.reduce((sum, s) => sum + s.issueCount, 0)
  const passCount = summaries.filter((s) => s.verdict === "PASS").length
  const failCount = summaries.filter((s) => s.verdict === "FAIL").length

  return (
    <div className="space-y-4 pt-4">
      {validatedCount > 0 && (
        <p className="text-sm text-muted-foreground">
          {validatedCount} of {totalDatasets} datasets validated —{" "}
          {totalIssues} total issues — {failCount} FAIL, {passCount} PASS
        </p>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Dataset Name</TableHead>
            <TableHead className="w-24">Verdict</TableHead>
            <TableHead className="w-20 text-right">Issues</TableHead>
            <TableHead className="w-24 text-right">Pass Rate</TableHead>
            <TableHead className="w-36 text-right">Last Run</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {summaries.map((summary) => (
            <TableRow
              key={summary.id}
              className="cursor-pointer transition-colors hover:bg-muted/50"
              onClick={() => router.push(`/projects/${projectId}/jobs/${jobId}/files/${summary.id}`)}
            >
              <TableCell>
                <Link
                  href={`/projects/${projectId}/jobs/${jobId}/files/${summary.id}`}
                  className="font-medium text-foreground hover:underline"
                >
                  {summary.fileName}
                </Link>
              </TableCell>
              <TableCell>
                {summary.verdict === "PASS" ? (
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                    PASS
                  </Badge>
                ) : summary.verdict === "FAIL" ? (
                  <Badge variant="destructive">FAIL</Badge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {summary.isValidated ? summary.issueCount : "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {summary.passRate != null
                  ? `${summary.passRate.toFixed(1)}%`
                  : "—"}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {summary.lastRunAt
                  ? formatRunDate(summary.lastRunAt)
                  : "Not run"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
