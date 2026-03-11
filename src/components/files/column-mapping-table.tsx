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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { DetectedColumn, SurveyColumnType, ColumnMapping } from "@/lib/parsing/types"

const SURVEY_COLUMN_TYPES: SurveyColumnType[] = [
  "kp",
  "easting",
  "northing",
  "depth",
  "dob",
  "doc",
  "top",
  "elevation",
  "event",
  "description",
  "date",
  "time",
  "latitude",
  "longitude",
]

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

function confidenceBadge(confidence: "high" | "medium" | "low") {
  switch (confidence) {
    case "high":
      return (
        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
          High
        </Badge>
      )
    case "medium":
      return (
        <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
          Medium
        </Badge>
      )
    case "low":
      return (
        <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
          Low
        </Badge>
      )
  }
}

interface ColumnMappingTableProps {
  columns: DetectedColumn[]
  mappings: ColumnMapping[]
  onMappingChange: (
    index: number,
    type: SurveyColumnType | null,
    ignored: boolean
  ) => void
  disabled: boolean
}

export function ColumnMappingTable({
  columns,
  mappings,
  onMappingChange,
  disabled,
}: ColumnMappingTableProps) {
  function getSelectValue(mapping: ColumnMapping): string {
    if (mapping.ignored) return "__ignore__"
    if (mapping.mappedType === null) return "__unmapped__"
    return mapping.mappedType
  }

  function handleValueChange(index: number, value: string | null) {
    if (!value || value === "__unmapped__") {
      onMappingChange(index, null, false)
    } else if (value === "__ignore__") {
      onMappingChange(index, null, true)
    } else {
      onMappingChange(index, value as SurveyColumnType, false)
    }
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]">#</TableHead>
            <TableHead>Original Column</TableHead>
            <TableHead>Mapped Type</TableHead>
            <TableHead className="w-[100px]">Confidence</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {mappings.map((mapping) => {
            const detectedCol = columns.find(
              (c) => c.index === mapping.index
            )
            const confidence = detectedCol?.confidence ?? "low"

            return (
              <TableRow
                key={mapping.index}
                className={
                  mapping.ignored
                    ? "opacity-50"
                    : mapping.mappedType === null
                      ? "bg-orange-50/50 dark:bg-orange-950/10"
                      : ""
                }
              >
                <TableCell className="text-muted-foreground">
                  {mapping.index + 1}
                </TableCell>
                <TableCell className="font-medium">
                  {mapping.originalName}
                </TableCell>
                <TableCell>
                  {disabled ? (
                    <div className="flex items-center gap-2">
                      {mapping.ignored ? (
                        <Badge variant="secondary">Ignored</Badge>
                      ) : mapping.mappedType ? (
                        <Badge variant="default">
                          {COLUMN_TYPE_LABELS[mapping.mappedType]}
                        </Badge>
                      ) : (
                        <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                          Unmapped
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <Select
                      value={getSelectValue(mapping)}
                      onValueChange={(val) =>
                        handleValueChange(mapping.index, val)
                      }
                    >
                      <SelectTrigger size="sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__unmapped__">
                          Unmapped
                        </SelectItem>
                        <SelectItem value="__ignore__">
                          Ignore
                        </SelectItem>
                        {SURVEY_COLUMN_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {COLUMN_TYPE_LABELS[type]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </TableCell>
                <TableCell>{confidenceBadge(confidence)}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
