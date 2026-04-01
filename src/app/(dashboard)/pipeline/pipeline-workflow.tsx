"use client"

import { useReducer, useEffect, useCallback } from "react"
import {
  pipelineReducer,
  initialState,
  type PipelineState,
  type PipelineStage,
} from "./lib/pipeline-state"
import {
  savePipelineState,
  loadPipelineState,
} from "./lib/pipeline-store"
import { PipelineStepper } from "./components/pipeline-stepper"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Upload,
  Eye,
  ShieldCheck,
  Sparkles,
  Download,
  SkipForward,
  ArrowRight,
} from "lucide-react"

interface PipelineWorkflowProps {
  user: { id: string; email: string }
}

function initializeState(): PipelineState {
  if (typeof window === "undefined") return initialState

  const saved = loadPipelineState()
  if (!saved) return initialState

  return {
    ...initialState,
    ...saved,
    // Non-serializable fields are always reset
    parsedData: null,
    cleanedData: null,
  }
}

export function PipelineWorkflow({ user: _user }: PipelineWorkflowProps) {
  const [state, dispatch] = useReducer(pipelineReducer, initialState, initializeState)

  // Persist state on changes
  useEffect(() => {
    savePipelineState(state)
  }, [state])

  const handleStageClick = useCallback(
    (stage: PipelineStage) => {
      dispatch({ type: "GO_TO_STAGE", stage })
    },
    []
  )

  return (
    <div className="flex flex-col">
      <PipelineStepper state={state} onStageClick={handleStageClick} />

      <div className="p-6">
        {state.currentStage === "import" && (
          <StagePlaceholder
            icon={Upload}
            title="Import"
            description="Upload a file or select an existing dataset"
            actions={
              <>
                <Button
                  onClick={() =>
                    dispatch({ type: "IMPORT_FILE", fileName: "sample.csv" })
                  }
                >
                  <ArrowRight className="mr-2 size-4" />
                  Upload File (Placeholder)
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    dispatch({
                      type: "IMPORT_EXISTING",
                      datasetId: "demo-id",
                      fileName: "existing-dataset.csv",
                    })
                  }
                >
                  Select Existing Dataset
                </Button>
              </>
            }
          />
        )}

        {state.currentStage === "inspect" && (
          <StagePlaceholder
            icon={Eye}
            title="Inspect"
            description={
              state.columnCount !== null
                ? `${state.columnCount} columns, ${state.rowCount} rows`
                : "Preview data, column stats, and row count"
            }
            actions={
              <Button
                onClick={() =>
                  dispatch({
                    type: "INSPECT_COMPLETE",
                    parsedData: [["col1", "col2"], ["a", "b"]],
                    columnCount: 2,
                    rowCount: 1,
                  })
                }
              >
                <ArrowRight className="mr-2 size-4" />
                Continue (Placeholder)
              </Button>
            }
          />
        )}

        {state.currentStage === "validate" && (
          <StagePlaceholder
            icon={ShieldCheck}
            title="Validate"
            description="Run QC rule templates against the dataset"
            actions={
              <>
                <Button
                  onClick={() =>
                    dispatch({
                      type: "VALIDATE_COMPLETE",
                      runId: "demo-run",
                      issueCount: 3,
                    })
                  }
                >
                  <ArrowRight className="mr-2 size-4" />
                  Run Validation (Placeholder)
                </Button>
                <Button
                  variant="outline"
                  onClick={() => dispatch({ type: "SKIP_VALIDATE" })}
                >
                  <SkipForward className="mr-2 size-4" />
                  Skip
                </Button>
              </>
            }
          />
        )}

        {state.currentStage === "clean" && (
          <StagePlaceholder
            icon={Sparkles}
            title="Clean"
            description="Apply transforms to fix flagged issues"
            actions={
              <>
                <Button
                  onClick={() =>
                    dispatch({
                      type: "CLEAN_COMPLETE",
                      cleanedData: new Blob(["cleaned"]),
                    })
                  }
                >
                  <ArrowRight className="mr-2 size-4" />
                  Apply Transforms (Placeholder)
                </Button>
                <Button
                  variant="outline"
                  onClick={() => dispatch({ type: "SKIP_CLEAN" })}
                >
                  <SkipForward className="mr-2 size-4" />
                  Skip
                </Button>
              </>
            }
          />
        )}

        {state.currentStage === "export" && (
          <StagePlaceholder
            icon={Download}
            title="Export"
            description="Choose output format and download"
            actions={
              <>
                <Button
                  onClick={() =>
                    dispatch({ type: "SET_EXPORT_FORMAT", format: "csv" })
                  }
                >
                  <Download className="mr-2 size-4" />
                  Download (Placeholder)
                </Button>
                <Button
                  variant="outline"
                  onClick={() => dispatch({ type: "RESET" })}
                >
                  Start Over
                </Button>
              </>
            }
          />
        )}
      </div>
    </div>
  )
}

function StagePlaceholder({
  icon: Icon,
  title,
  description,
  actions,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  actions: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="size-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground">{description}</p>
        <div className="flex flex-wrap gap-3">{actions}</div>
      </CardContent>
    </Card>
  )
}
