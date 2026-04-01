"use client"

import {
  Sparkles,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  SkipForward,
  Wrench,
  ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { setPipelineHandoff } from "@/lib/pipeline-handoff"
import type { StagePanelProps } from "./stage-import"

const TRANSFORM_TOOLS = [
  {
    title: "CRS Conversion",
    description: "Convert coordinate reference systems",
    href: "/tools/transform/crs",
  },
  {
    title: "Merge Files",
    description: "Combine multiple datasets into one",
    href: "/tools/transform/merge",
  },
  {
    title: "Split Dataset",
    description: "Split dataset by column values or ranges",
    href: "/tools/transform/split",
  },
]

export function StageClean({ state, dispatch }: StagePanelProps) {
  const hasIssues = state.issueCount !== null && state.issueCount > 0
  const validationSkipped = state.stages.validate.skipped
  const cleanCompleted = state.stages.clean.completed

  function handleRemoveFlagged() {
    // MVP: Mark as complete. Real row removal would require backend processing.
    // The export will use original data with flagged rows highlighted.
    dispatch({
      type: "CLEAN_COMPLETE",
      cleanedData: new Blob(["cleaned"]),
    })
  }

  // Completed state (revisiting)
  if (cleanCompleted) {
    return (
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="size-5 text-green-600" />
            Clean Complete
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            {state.stages.clean.summary}
          </p>
          <TransformToolLinks fileName={state.fileName} parsedData={state.parsedData} />
          <button
            onClick={() =>
              dispatch({ type: "GO_TO_STAGE", stage: "export" })
            }
            className="group inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-all hover:opacity-90 active:scale-[0.98]"
          >
            Continue to Export
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        </CardContent>
      </Card>
    )
  }

  // Skipped state (revisiting)
  if (state.stages.clean.skipped) {
    return (
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-amber-500" />
            Clean Skipped
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            No transforms were applied to this dataset.
          </p>
          <TransformToolLinks fileName={state.fileName} parsedData={state.parsedData} />
          <button
            onClick={() =>
              dispatch({ type: "GO_TO_STAGE", stage: "export" })
            }
            className="group inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-all hover:opacity-90 active:scale-[0.98]"
          >
            Continue to Export
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-5" />
          Clean Data
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Issue summary or no-issues state */}
        {hasIssues ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
              <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                  {state.issueCount} issue{state.issueCount !== 1 ? "s" : ""}{" "}
                  detected
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Flagged rows will be highlighted in the exported file.
                </p>
              </div>
            </div>
            <Button onClick={handleRemoveFlagged} variant="outline">
              <Sparkles className="mr-2 size-4" />
              Remove Flagged Rows
            </Button>
          </div>
        ) : validationSkipped ? (
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
            <AlertTriangle className="size-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Validation was skipped</p>
              <p className="text-xs text-muted-foreground">
                No issues to clean. You can use the transform tools below or
                continue to export.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30">
            <CheckCircle className="size-5 text-green-600 dark:text-green-400" />
            <div>
              <p className="text-sm font-medium text-green-700 dark:text-green-300">
                No cleaning needed
              </p>
              <p className="text-xs text-green-600 dark:text-green-400">
                All quality checks passed. You can still use transform tools or
                continue to export.
              </p>
            </div>
          </div>
        )}

        {/* Transform tool links */}
        <TransformToolLinks fileName={state.fileName} parsedData={state.parsedData} />

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() =>
              dispatch({ type: "GO_TO_STAGE", stage: "validate" })
            }
          >
            <ArrowLeft className="mr-2 size-4" />
            Back
          </Button>
          <button
            onClick={() =>
              dispatch({ type: "GO_TO_STAGE", stage: "export" })
            }
            className="group inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-all hover:opacity-90 active:scale-[0.98]"
          >
            Continue to Export
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
          <Button
            variant="outline"
            onClick={() => dispatch({ type: "SKIP_CLEAN" })}
          >
            <SkipForward className="mr-2 size-4" />
            Skip
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function TransformToolLinks({
  fileName,
  parsedData,
}: {
  fileName: string | null
  parsedData: string[][] | null
}) {
  function handleToolClick(href: string) {
    // Store current pipeline data so the tool can pre-load it
    if (parsedData && parsedData.length > 1 && fileName) {
      setPipelineHandoff(fileName, parsedData)
    }
    window.open(href, "_blank")
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Transform Tools
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        {TRANSFORM_TOOLS.map((tool) => (
          <button
            key={tool.href}
            onClick={() => handleToolClick(tool.href)}
            className="group flex items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
          >
            <Wrench className="mt-0.5 size-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium group-hover:text-foreground">
                {tool.title}
              </p>
              <p className="text-xs text-muted-foreground">
                {tool.description}
              </p>
            </div>
            <ExternalLink className="size-3 shrink-0 text-muted-foreground/50" />
          </button>
        ))}
      </div>
    </div>
  )
}
