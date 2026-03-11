"use client"

import { useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ColumnMapping, SurveyColumnType } from "@/lib/parsing/types"

const COLUMN_TYPE_LABELS: Record<SurveyColumnType, string> = {
  kp: "KP",
  easting: "Easting",
  northing: "Northing",
  depth: "Depth",
  dob: "DOB",
  doc: "DOC",
  top: "TOP",
  elevation: "Elevation",
  event: "Event",
  description: "Description",
  date: "Date",
  time: "Time",
  latitude: "Latitude",
  longitude: "Longitude",
}

interface DataPreviewTableProps {
  preview: string[][]
  mappings: ColumnMapping[]
  totalRows: number
}

export function DataPreviewTable({
  preview,
  mappings,
  totalRows,
}: DataPreviewTableProps) {
  // Sort columns: mapped first, then unmapped, then ignored
  const sortedMappings = useMemo(() => {
    return [...mappings].sort((a, b) => {
      const aOrder = a.ignored ? 2 : a.mappedType ? 0 : 1
      const bOrder = b.ignored ? 2 : b.mappedType ? 0 : 1
      if (aOrder !== bOrder) return aOrder - bOrder
      return a.index - b.index
    })
  }, [mappings])

  if (preview.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No preview data available.</p>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Showing {preview.length} of {totalRows.toLocaleString()} rows
      </p>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {sortedMappings.map((mapping) => (
                <TableHead
                  key={mapping.index}
                  className={`min-w-[120px] whitespace-nowrap ${
                    mapping.ignored ? "opacity-50" : ""
                  }`}
                >
                  <div className="space-y-1">
                    <span className="text-xs font-medium">
                      {mapping.originalName}
                    </span>
                    {mapping.mappedType ? (
                      <Badge
                        variant="default"
                        className="block w-fit text-[10px]"
                      >
                        {COLUMN_TYPE_LABELS[mapping.mappedType]}
                      </Badge>
                    ) : mapping.ignored ? (
                      <Badge
                        variant="secondary"
                        className="block w-fit text-[10px]"
                      >
                        Ignored
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="block w-fit text-[10px]"
                      >
                        Unmapped
                      </Badge>
                    )}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {preview.map((row, rowIndex) => (
              <TableRow key={rowIndex}>
                {sortedMappings.map((mapping) => (
                  <TableCell
                    key={mapping.index}
                    className={`whitespace-nowrap text-xs ${
                      mapping.ignored ? "opacity-50" : ""
                    }`}
                  >
                    {row[mapping.index] ?? ""}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
