"use client"

import { useEffect, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getSeverityColor } from "@/lib/utils/severity"
import { getIssueContext } from "@/lib/actions/validation"
import type { ValidationIssue } from "@/lib/types/validation"

interface IssueRowDetailProps {
  issue: ValidationIssue
  datasetId: string
}

interface IssueContext {
  headers: string[]
  rows: { rowNumber: number; cells: string[]; isFlagged: boolean }[]
}

export function IssueRowDetail({ issue, datasetId }: IssueRowDetailProps) {
  const [context, setContext] = useState<IssueContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const colors = getSeverityColor(issue.severity)

  useEffect(() => {
    let cancelled = false

    async function fetchContext() {
      setLoading(true)
      setError(null)

      const result = await getIssueContext(datasetId, issue.row_number)

      if (cancelled) return

      if ("error" in result) {
        setError(result.error)
      } else {
        setContext(result.data)
      }
      setLoading(false)
    }

    fetchContext()
    return () => { cancelled = true }
  }, [datasetId, issue.row_number])

  return (
    <div className="space-y-3 px-4 py-4">
      {/* Expected vs Actual */}
      {(issue.expected || issue.actual) && (
        <div className="grid gap-2 sm:grid-cols-2">
          {issue.expected && (
            <div className="rounded-xl border bg-card p-3">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Expected</p>
              <p className="mt-1 text-sm font-mono font-medium text-foreground">{issue.expected}</p>
            </div>
          )}
          {issue.actual && (
            <div className={`rounded-xl border p-3 ${colors.bg}`}>
              <p className={`text-[10px] font-medium uppercase tracking-wider ${colors.text}`}>Actual</p>
              <p className={`mt-1 text-sm font-mono font-medium ${colors.text}`}>{issue.actual}</p>
            </div>
          )}
        </div>
      )}

      {/* Surrounding context */}
      {loading && (
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive">
          Failed to load context: {error}
        </p>
      )}

      {context && (
        <div>
          <p className="mb-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            Surrounding Rows
          </p>
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14 text-[10px]">Row</TableHead>
                  {context.headers.map((h, i) => (
                    <TableHead key={i} className="text-[10px]">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {context.rows.map((row) => (
                  <TableRow
                    key={row.rowNumber}
                    className={row.isFlagged ? colors.bg : ""}
                  >
                    <TableCell className="font-mono text-[10px] tabular-nums text-muted-foreground">
                      {row.rowNumber}
                    </TableCell>
                    {row.cells.map((cell, i) => (
                      <TableCell key={i} className="text-xs">
                        {cell}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}
