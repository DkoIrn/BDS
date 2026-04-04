"use client"

import { useEffect, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { getValidationRuns, getValidationIssues } from "@/lib/actions/validation"
import { ResultsStatCards } from "@/components/files/results-stat-cards"
import { IssuesTable } from "@/components/files/issues-table"
import { RunSwitcher } from "@/components/files/run-switcher"
import { ExportButtons } from "@/components/files/export-buttons"
import type { ValidationRun, ValidationIssue, ValidationSeverity } from "@/lib/types/validation"

interface ResultsDashboardProps {
  datasetId: string
}

export function ResultsDashboard({ datasetId }: ResultsDashboardProps) {
  const [runs, setRuns] = useState<ValidationRun[]>([])
  const [selectedRunId, setSelectedRunId] = useState<string>("")
  const [issues, setIssues] = useState<ValidationIssue[]>([])
  const [loadingRuns, setLoadingRuns] = useState(true)
  const [loadingIssues, setLoadingIssues] = useState(false)
  const [activeSeverity, setActiveSeverity] = useState<ValidationSeverity | "all">("all")

  // Fetch runs on mount
  useEffect(() => {
    async function fetchRuns() {
      setLoadingRuns(true)
      const result = await getValidationRuns(datasetId)
      if ("data" in result) {
        setRuns(result.data)
        if (result.data.length > 0) {
          setSelectedRunId(result.data[0].id)
        }
      }
      setLoadingRuns(false)
    }

    fetchRuns()
  }, [datasetId])

  // Fetch issues when selected run changes
  useEffect(() => {
    if (!selectedRunId) return

    async function fetchIssues() {
      setLoadingIssues(true)
      setIssues([])
      const result = await getValidationIssues(selectedRunId)
      if ("data" in result) {
        setIssues(result.data)
      }
      setLoadingIssues(false)
    }

    fetchIssues()
  }, [selectedRunId])

  const selectedRun = runs.find((r) => r.id === selectedRunId)

  // Loading skeleton
  if (loadingRuns) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full rounded-xl" />
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    )
  }

  // No runs empty state
  if (runs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center">
        <p className="text-sm font-medium text-muted-foreground">
          No validation runs yet
        </p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          Run QC from the Mapping tab to see results here
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold tracking-tight">Results</h3>
        <div className="flex items-center gap-3">
          <RunSwitcher
            runs={runs}
            selectedRunId={selectedRunId}
            onRunChange={setSelectedRunId}
          />
          {selectedRunId && (
            <ExportButtons runId={selectedRunId} datasetId={datasetId} />
          )}
        </div>
      </div>

      {/* Stat cards */}
      {selectedRun && (
        <ResultsStatCards
          run={selectedRun}
          onSeverityClick={setActiveSeverity}
        />
      )}

      {/* Issues */}
      {loadingIssues ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      ) : (
        <IssuesTable
          issues={issues}
          datasetId={datasetId}
          activeSeverity={activeSeverity}
          onSeverityChange={setActiveSeverity}
        />
      )}
    </div>
  )
}
