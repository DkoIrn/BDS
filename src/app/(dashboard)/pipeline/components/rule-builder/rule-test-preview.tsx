"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, AlertTriangle, CheckCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import type { RuleTestResult } from "@/lib/types/custom-rules"

interface RuleTestPreviewProps {
  result: RuleTestResult
}

export function RuleTestPreview({ result }: RuleTestPreviewProps) {
  const [showSample, setShowSample] = useState(false)
  const hasMatches = result.matching_rows > 0

  return (
    <Card className="border-violet-200 dark:border-violet-900">
      <CardContent className="p-4 space-y-3">
        {/* Summary line */}
        <div className="flex items-center gap-2">
          {hasMatches ? (
            <AlertTriangle className="size-4 shrink-0 text-destructive" />
          ) : (
            <CheckCircle className="size-4 shrink-0 text-emerald-600" />
          )}
          <p className="text-sm">
            <span
              className={`font-bold ${hasMatches ? "text-destructive" : "text-emerald-600"}`}
            >
              {result.matching_rows}
            </span>{" "}
            of {result.total_rows} rows matched
          </p>
        </div>

        {/* Truncation warning */}
        {result.truncated && (
          <div className="rounded-md bg-amber-50 px-3 py-1.5 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
            Dataset was truncated to 10,000 rows for preview
          </div>
        )}

        {/* No matches */}
        {!hasMatches && (
          <p className="text-xs text-muted-foreground">
            No rows matched this rule
          </p>
        )}

        {/* Sample matches */}
        {result.sample_matches.length > 0 && (
          <div>
            <button
              onClick={() => setShowSample((v) => !v)}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              {showSample ? (
                <ChevronDown className="size-3.5" />
              ) : (
                <ChevronRight className="size-3.5" />
              )}
              Sample matches ({Math.min(result.sample_matches.length, 50)} rows)
            </button>

            {showSample && (
              <div className="mt-2 max-h-64 overflow-auto rounded-md border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">
                        Row
                      </th>
                      {result.sample_matches[0] &&
                        Object.keys(result.sample_matches[0].values)
                          .slice(0, 8)
                          .map((col) => (
                            <th
                              key={col}
                              className="px-2 py-1.5 text-left font-medium text-muted-foreground"
                            >
                              {col}
                            </th>
                          ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.sample_matches.slice(0, 50).map((match) => (
                      <tr
                        key={match.row_number}
                        className="border-b last:border-0 hover:bg-muted/30"
                      >
                        <td className="px-2 py-1 font-mono text-muted-foreground">
                          {match.row_number}
                        </td>
                        {Object.entries(match.values)
                          .slice(0, 8)
                          .map(([col, val]) => (
                            <td key={col} className="px-2 py-1 max-w-[120px] truncate">
                              {val == null ? (
                                <span className="text-muted-foreground italic">null</span>
                              ) : (
                                String(val)
                              )}
                            </td>
                          ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
