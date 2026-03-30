"use client"

import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"

interface OutputPreviewTableProps {
  csvText: string
  maxRows?: number
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"'
        i++
      } else if (char === '"') {
        inQuotes = false
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ",") {
        cells.push(current.trim())
        current = ""
      } else {
        current += char
      }
    }
  }
  cells.push(current.trim())
  return cells
}

function truncateCell(value: string, max = 30): { display: string; truncated: boolean } {
  if (value.length <= max) return { display: value, truncated: false }
  return { display: value.slice(0, max) + "...", truncated: true }
}

export function OutputPreviewTable({ csvText, maxRows = 20 }: OutputPreviewTableProps) {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim() !== "")

  if (lines.length < 2) return null

  const headers = parseCsvLine(lines[0])
  const allRows = lines.slice(1)
  const displayRows = allRows.slice(0, maxRows)
  const totalRows = allRows.length

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border">
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              {headers.map((header, i) => (
                <TableHead key={i} className="px-2 py-1 text-xs">
                  {header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayRows.map((line, rowIdx) => {
              const cells = parseCsvLine(line)
              return (
                <TableRow key={rowIdx}>
                  {headers.map((_, colIdx) => {
                    const raw = cells[colIdx] ?? ""
                    const { display, truncated } = truncateCell(raw)
                    return (
                      <TableCell
                        key={colIdx}
                        className="px-2 py-1 text-xs"
                        title={truncated ? raw : undefined}
                      >
                        {display}
                      </TableCell>
                    )
                  })}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      {totalRows > maxRows && (
        <p className="text-xs text-muted-foreground">
          Showing first {maxRows} of {totalRows} rows
        </p>
      )}
    </div>
  )
}
