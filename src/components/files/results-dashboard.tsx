"use client"

import { useEffect, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { getValidationRuns, getValidationIssues } from "@/lib/actions/validation"
import { ResultsStatCards } from "@/components/files/results-stat-cards"
import { IssuesTable } from "@/components/files/issues-table"
import { RunSwitcher } from "@/components/files/run-switcher"
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
        <Skeleton className="h-12 w-full" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  // No runs empty state
  if (runs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground">
          No validation runs yet. Run QC from the Mapping tab.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Results</h3>
        <RunSwitcher
          runs={runs}
          selectedRunId={selectedRunId}
          onRunChange={setSelectedRunId}
        />
      </div>

      {/* Stat cards */}
      {selectedRun && (
        <ResultsStatCards
          run={selectedRun}
          onSeverityClick={setActiveSeverity}
        />
      )}

      {/* Issues table */}
      {loadingIssues ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-48 w-full" />
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
