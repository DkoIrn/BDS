"use client"

import { useReducer, useEffect, useCallback, useRef } from "react"
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
    // Non-serializable fields are always reset
    parsedData: null,
    cleanedData: null,
  }
}

export function PipelineWorkflow({ user: _user }: PipelineWorkflowProps) {
  const [state, dispatch] = useReducer(pipelineReducer, initialState, initializeState)
  const fileRef = useRef<File | null>(null)

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
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-6 pt-2">
        <div /> {/* Spacer */}
        {state.currentStage !== "import" && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-muted-foreground"
          >
            <RefreshCw className="mr-2 size-3.5" />
            Reset Pipeline
          </Button>
        )}
      </div>

      <PipelineStepper state={state} onStageClick={handleStageClick} />

      <div className="p-6">
        {state.currentStage === "import" && (
          <StageImport state={state} dispatch={dispatch} fileRef={fileRef} />
        )}

        {state.currentStage === "inspect" && (
          <StageInspect state={state} dispatch={dispatch} fileRef={fileRef} />
        )}

        {state.currentStage === "validate" && (
          <StageValidate state={state} dispatch={dispatch} />
        )}

        {state.currentStage === "clean" && (
          <StageClean state={state} dispatch={dispatch} />
        )}

        {state.currentStage === "export" && (
          <StageExport state={state} dispatch={dispatch} fileRef={fileRef} />
        )}
      </div>
    </div>
  )
}
