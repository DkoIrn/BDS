"use client"

import { AlertTriangle, AlertCircle, Info, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { ValidationRun } from "@/lib/types/validation"

interface ValidationSummaryProps {
  run: ValidationRun
  onRerun: () => void
}

function formatRunDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function ValidationSummary({ run, onRerun }: ValidationSummaryProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-base">Validation Results</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Run at {formatRunDate(run.run_at)}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onRerun}>
          <RotateCcw className="mr-1.5 size-3.5" />
          Re-run Validation
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Severity badges */}
        <div className="flex items-center gap-3">
          <Badge
            variant="destructive"
            className="flex items-center gap-1.5"
          >
            <AlertTriangle className="size-3" />
            {run.critical_count} Critical
          </Badge>
          <Badge
            variant="outline"
            className="flex items-center gap-1.5 border-yellow-500 text-yellow-700 dark:text-yellow-400"
          >
            <AlertCircle className="size-3" />
            {run.warning_count} Warning
          </Badge>
          <Badge
            variant="outline"
            className="flex items-center gap-1.5 border-blue-500 text-blue-700 dark:text-blue-400"
          >
            <Info className="size-3" />
            {run.info_count} Info
          </Badge>
        </div>

        {/* Summary stats */}
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <span>
            <strong className="text-foreground">{run.total_issues}</strong>{" "}
            total issues
          </span>
          {run.pass_rate != null && (
            <span>
              <strong className="text-foreground">
                {(run.pass_rate * 100).toFixed(1)}%
              </strong>{" "}
              pass rate
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
