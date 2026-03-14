"use client"

import { CheckCircle, XCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  getSeverityColor,
  getSeverityIcon,
  getPassRateColor,
  getVerdict,
} from "@/lib/utils/severity"
import type { ValidationRun, ValidationSeverity } from "@/lib/types/validation"

interface ResultsStatCardsProps {
  run: ValidationRun
  onSeverityClick: (severity: ValidationSeverity | "all") => void
}

export function ResultsStatCards({ run, onSeverityClick }: ResultsStatCardsProps) {
  const verdict = getVerdict(run.critical_count)
  const passRateColor = run.pass_rate != null ? getPassRateColor(run.pass_rate) : ""

  const severities: { key: ValidationSeverity; count: number }[] = [
    { key: "critical", count: run.critical_count },
    { key: "warning", count: run.warning_count },
    { key: "info", count: run.info_count },
  ]

  return (
    <div className="space-y-4">
      {/* Verdict banner */}
      <div
        className={`flex items-center gap-3 rounded-lg border-2 p-3 ${
          verdict === "PASS"
            ? "border-green-500 bg-green-50 dark:bg-green-900/20"
            : "border-red-500 bg-red-50 dark:bg-red-900/20"
        }`}
      >
        {verdict === "PASS" ? (
          <CheckCircle className="size-6 text-green-600" />
        ) : (
          <XCircle className="size-6 text-red-600" />
        )}
        <span className="text-lg font-bold">{verdict}</span>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Total Issues */}
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Issues</p>
            <p className="mt-1 text-3xl font-bold tabular-nums">{run.total_issues}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {severities.map(({ key, count }) => {
                const colors = getSeverityColor(key)
                const Icon = getSeverityIcon(key)
                return (
                  <Badge
                    key={key}
                    className={`cursor-pointer gap-1 transition-transform hover:scale-105 active:scale-95 ${colors.badge}`}
                    onClick={() => onSeverityClick(key)}
                  >
                    <Icon className="size-3" />
                    {count} {key}
                  </Badge>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Pass Rate */}
        <Card className={run.pass_rate != null ? `border-l-4 ${passRateColor}` : ""}>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Pass Rate</p>
            <p className="mt-1 text-3xl font-bold tabular-nums">
              {run.pass_rate != null ? `${run.pass_rate.toFixed(1)}%` : "N/A"}
            </p>
          </CardContent>
        </Card>

        {/* Data Completeness */}
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Data Completeness</p>
            <p className="mt-1 text-3xl font-bold tabular-nums">
              {run.completeness_score != null
                ? `${run.completeness_score.toFixed(1)}%`
                : "N/A"}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
