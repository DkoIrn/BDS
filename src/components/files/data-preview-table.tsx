"use client"

import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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

const ROW_PRESETS = [50, 100, 250] as const

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
  const [visibleRows, setVisibleRows] = useState(50)

  // Sort columns: mapped first, then unmapped, then ignored
  const sortedMappings = useMemo(() => {
    return [...mappings].sort((a, b) => {
      const aOrder = a.ignored ? 2 : a.mappedType ? 0 : 1
      const bOrder = b.ignored ? 2 : b.mappedType ? 0 : 1
      if (aOrder !== bOrder) return aOrder - bOrder
      return a.index - b.index
    })
  }, [mappings])

  const maxRows = Math.min(preview.length, totalRows)
  const displayedRows = preview.slice(0, visibleRows)

  // Build the select value — match to a preset or show actual number
  const selectValue = String(visibleRows)

  function handleSelectChange(value: string | null) {
    if (!value) return
    setVisibleRows(Number(value))
  }

  function handleCustomInput(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return
    const num = parseInt(e.currentTarget.value, 10)
    if (num > 0) {
      setVisibleRows(Math.min(num, maxRows))
      e.currentTarget.value = ""
      e.currentTarget.blur()
    }
  }

  if (preview.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No preview data available.</p>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {displayedRows.length} of {totalRows.toLocaleString()} rows
          {displayedRows.length < visibleRows && displayedRows.length === preview.length && preview.length < totalRows && (
            <span> (all available preview data)</span>
          )}
        </p>
        <div className="flex items-center gap-2">
          <Select value={selectValue} onValueChange={handleSelectChange}>
            <SelectTrigger size="sm" className="w-[90px] text-xs">
              <SelectValue>{visibleRows} rows</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {ROW_PRESETS.filter((n) => n <= maxRows).map((count) => (
                <SelectItem key={count} value={String(count)}>
                  {count} rows
                </SelectItem>
              ))}
              {maxRows > ROW_PRESETS[ROW_PRESETS.length - 1] && (
                <SelectItem value={String(maxRows)}>
                  All ({maxRows})
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          <Input
            type="number"
            min={1}
            max={maxRows}
            placeholder="Custom"
            className="h-7 w-[90px] text-xs"
            onKeyDown={handleCustomInput}
          />
        </div>
      </div>
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
            {displayedRows.map((row, rowIndex) => (
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
