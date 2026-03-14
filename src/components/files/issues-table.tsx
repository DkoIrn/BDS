"use client"

import { useState, Fragment } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { getSeverityColor, getSeverityIcon } from "@/lib/utils/severity"
import { IssueRowDetail } from "@/components/files/issue-row-detail"
import type { ValidationIssue, ValidationSeverity } from "@/lib/types/validation"

type SortColumn = "row_number" | "column_name" | "severity"
type SortDirection = "asc" | "desc"

const severityOrdinal: Record<ValidationSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
}

interface IssuesTableProps {
  issues: ValidationIssue[]
  datasetId: string
  activeSeverity: ValidationSeverity | "all"
  onSeverityChange: (severity: ValidationSeverity | "all") => void
}

export function IssuesTable({
  issues,
  datasetId,
  activeSeverity,
  onSeverityChange,
}: IssuesTableProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>("row_number")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  function handleSort(column: SortColumn) {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
    } else {
      setSortColumn(column)
      setSortDirection("asc")
    }
  }

  function toggleRow(issueId: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(issueId)) {
        next.delete(issueId)
      } else {
        next.add(issueId)
      }
      return next
    })
  }

  // Count by severity for tab labels
  const counts = {
    all: issues.length,
    critical: issues.filter((i) => i.severity === "critical").length,
    warning: issues.filter((i) => i.severity === "warning").length,
    info: issues.filter((i) => i.severity === "info").length,
  }

  // Filter
  const filtered =
    activeSeverity === "all"
      ? issues
      : issues.filter((i) => i.severity === activeSeverity)

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    const dir = sortDirection === "asc" ? 1 : -1

    switch (sortColumn) {
      case "row_number":
        return dir * (a.row_number - b.row_number)
      case "column_name":
        return dir * a.column_name.localeCompare(b.column_name)
      case "severity":
        return dir * (severityOrdinal[a.severity] - severityOrdinal[b.severity])
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

  const tabs: { value: ValidationSeverity | "all"; label: string }[] = [
    { value: "all", label: `All (${counts.all})` },
    { value: "critical", label: `Critical (${counts.critical})` },
    { value: "warning", label: `Warning (${counts.warning})` },
    { value: "info", label: `Info (${counts.info})` },
  ]

  return (
    <div className="space-y-4">
      <Tabs
        value={activeSeverity}
        onValueChange={(v) => onSeverityChange(v as ValidationSeverity | "all")}
      >
        <TabsList>
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {sorted.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {activeSeverity === "all"
            ? "No issues found"
            : `No ${activeSeverity} issues found`}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="w-20 cursor-pointer select-none"
                onClick={() => handleSort("row_number")}
              >
                Row #
                <SortIcon column="row_number" />
              </TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort("column_name")}
              >
                Column
                <SortIcon column="column_name" />
              </TableHead>
              <TableHead
                className="w-28 cursor-pointer select-none"
                onClick={() => handleSort("severity")}
              >
                Severity
                <SortIcon column="severity" />
              </TableHead>
              <TableHead>Message</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((issue) => {
              const colors = getSeverityColor(issue.severity)
              const Icon = getSeverityIcon(issue.severity)
              const isExpanded = expandedRows.has(issue.id)

              return (
                <Fragment key={issue.id}>
                  <TableRow
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => toggleRow(issue.id)}
                  >
                    <TableCell className="font-mono tabular-nums">
                      {issue.row_number}
                    </TableCell>
                    <TableCell>{issue.column_name}</TableCell>
                    <TableCell>
                      <Badge className={`gap-1 ${colors.badge}`}>
                        <Icon className="size-3" />
                        {issue.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-md truncate">
                      {issue.message.length > 80
                        ? `${issue.message.slice(0, 80)}…`
                        : issue.message}
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow>
                      <TableCell colSpan={4} className="p-0">
                        <IssueRowDetail issue={issue} datasetId={datasetId} />
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              )
            })}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
