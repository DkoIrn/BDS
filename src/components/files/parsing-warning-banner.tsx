"use client"

import { useState } from "react"
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { ParseWarning, SurveyColumnType } from "@/lib/parsing/types"

interface ParsingWarningBannerProps {
  warnings: ParseWarning[]
  missingExpected: SurveyColumnType[]
}

export function ParsingWarningBanner({
  warnings,
  missingExpected,
}: ParsingWarningBannerProps) {
  const [expanded, setExpanded] = useState(false)

  if (warnings.length === 0 && missingExpected.length === 0) {
    return null
  }

  const totalIssues = warnings.length + (missingExpected.length > 0 ? 1 : 0)

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-600 dark:bg-amber-950/30">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              {totalIssues === 1
                ? "1 issue detected during parsing"
                : `${totalIssues} issues detected during parsing`}
            </p>
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="ml-2 rounded p-1 text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/50"
            >
              {expanded ? (
                <ChevronUp className="size-4" />
              ) : (
                <ChevronDown className="size-4" />
              )}
            </button>
          </div>

          {missingExpected.length > 0 && (
            <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
              Missing expected columns:{" "}
              {missingExpected
                .map((col) => col.toUpperCase())
                .join(", ")}
            </p>
          )}

          {expanded && (
            <div className="mt-3 space-y-2">
              {warnings.map((warning, index) => (
                <div
                  key={index}
                  className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-300"
                >
                  <Badge variant="outline" className="shrink-0 text-xs">
                    {warning.type.replace(/_/g, " ")}
                  </Badge>
                  <span>
                    {warning.message}
                    {warning.count != null && warning.count > 1
                      ? ` (${warning.count} occurrences)`
                      : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
