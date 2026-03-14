"use client"

import { useEffect, useState } from "react"
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
import { getSeverityColor, getSeverityIcon } from "@/lib/utils/severity"
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
  const Icon = getSeverityIcon(issue.severity)

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
    <div className="space-y-4 p-4">
      {/* Explanation */}
      <div className={`flex items-start gap-2 ${colors.text}`}>
        <Icon className="mt-0.5 size-4 shrink-0" />
        <p className="text-sm">{issue.message}</p>
      </div>

      {/* Expected vs Actual */}
      {(issue.expected || issue.actual) && (
        <div className="grid gap-2 sm:grid-cols-2">
          {issue.expected && (
            <div className="rounded border p-2 text-sm">
              <span className="text-muted-foreground">Expected: </span>
              <span className="font-mono">{issue.expected}</span>
            </div>
          )}
          {issue.actual && (
            <div className="rounded border p-2 text-sm">
              <span className="text-muted-foreground">Actual: </span>
              <span className="font-mono">{issue.actual}</span>
            </div>
          )}
        </div>
      )}

      {/* Rule type and KP */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{issue.rule_type}</Badge>
        {issue.kp_value != null && (
          <span className="text-sm text-muted-foreground">
            KP: {issue.kp_value}
          </span>
        )}
      </div>

      {/* Surrounding context */}
      {loading && (
        <div className="space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive">
          Failed to load context: {error}
        </p>
      )}

      {context && (
        <div className="overflow-x-auto rounded border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Row</TableHead>
                {context.headers.map((h, i) => (
                  <TableHead key={i}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {context.rows.map((row) => (
                <TableRow
                  key={row.rowNumber}
                  className={row.isFlagged ? colors.bg : ""}
                >
                  <TableCell className="font-mono text-xs tabular-nums">
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
      )}
    </div>
  )
}
