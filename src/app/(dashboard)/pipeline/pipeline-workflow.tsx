"use client"

import { useReducer, useEffect, useCallback, useRef, useState } from "react"
import {
  pipelineReducer,
  initialState,
  type PipelineState,
  type PipelineStage,
} from "./lib/pipeline-state"
import {
  savePipelineState,
  loadPipelineState,
  clearPipelineState,
} from "./lib/pipeline-store"
import { PipelineStepper } from "./components/pipeline-stepper"
import { StageImport } from "./components/stage-import"
import { StageInspect } from "./components/stage-inspect"
import { StageValidate } from "./components/stage-validate"
import type { ValidationIssue } from "./lib/client-validate"
import { StageClean } from "./components/stage-clean"
import { StageExport } from "./components/stage-export"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"

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
    // Blob is non-serializable, always reset
    cleanedData: null,
  }
}

export function PipelineWorkflow({ user }: PipelineWorkflowProps) {
  const [state, dispatch] = useReducer(pipelineReducer, initialState, initializeState)
  const fileRef = useRef<File | null>(null)
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([])

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

  const handleReset = useCallback(() => {
    clearPipelineState()
    fileRef.current = null
    dispatch({ type: "RESET" })
  }, [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Pipeline
          </h1>
          <p className="text-sm text-muted-foreground">
            Import, inspect, validate, clean, and export your survey data
          </p>
        </div>
        {state.currentStage !== "import" && (
          <button
            onClick={handleReset}
            className="group inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-all hover:opacity-90 active:scale-[0.98]"
          >
            <RefreshCw className="size-3.5" />
            Reset Pipeline
          </button>
        )}
      </div>

      <PipelineStepper state={state} onStageClick={handleStageClick} />

      <div className="animate-fade-up [animation-delay:80ms] [animation-fill-mode:backwards]">
        {state.currentStage === "import" && (
          <StageImport state={state} dispatch={dispatch} fileRef={fileRef} />
        )}

        {state.currentStage === "inspect" && (
          <StageInspect state={state} dispatch={dispatch} fileRef={fileRef} />
        )}

        {state.currentStage === "validate" && (
          <StageValidate state={state} dispatch={dispatch} onIssuesFound={setValidationIssues} />
        )}

        {state.currentStage === "clean" && (
          <StageClean state={state} dispatch={dispatch} validationIssues={validationIssues} />
        )}

        {state.currentStage === "export" && (
          <StageExport state={state} dispatch={dispatch} fileRef={fileRef} userId={user.id} validationIssues={validationIssues} />
        )}
      </div>
    </div>
  )
}
