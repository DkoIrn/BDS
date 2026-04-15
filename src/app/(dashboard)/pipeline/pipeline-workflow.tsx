"use client"

import { useReducer, useEffect, useCallback, useRef, useState, useMemo } from "react"
import { useSearchParams, useRouter } from "next/navigation"
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
import { StageReview } from "./components/stage-review"
import { StageClean } from "./components/stage-clean"
import { toast } from "sonner"
import { StageExport } from "./components/stage-export"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import { GuidedOnboarding } from "./components/guided-onboarding"

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
    // Deep-merge stages so new stages (e.g. "review") get defaults
    // even when loading old sessionStorage data that lacks them
    stages: {
      ...initialState.stages,
      ...(saved.stages ?? {}),
    },
    // Blob is non-serializable, always reset
    cleanedData: null,
  }
}

export function PipelineWorkflow({ user }: PipelineWorkflowProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const isDemoMode = searchParams.get("demo") === "true"

  const [state, dispatch] = useReducer(pipelineReducer, initialState, initializeState)
  const fileRef = useRef<File | null>(null)
  const secondFileRef = useRef<File | null>(null)
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
    secondFileRef.current = null
    dispatch({ type: "RESET" })
  }, [])

  // Auto-skip review when validation found 0 issues
  useEffect(() => {
    if (
      state.currentStage === "review" &&
      state.stages.validate.completed &&
      !state.triageAutoSkipped &&
      (state.issueCount === 0 || (state.issueCount === null && validationIssues.length === 0))
    ) {
      dispatch({ type: "AUTO_SKIP_REVIEW" })
      toast("No issues found -- skipping review")
    }
  }, [state.currentStage, state.stages.validate.completed, state.issueCount, state.triageAutoSkipped, validationIssues.length, dispatch])

  // Filter issues for Clean stage: only accepted or untriaged issues
  const acceptedIssues = useMemo(() => {
    if (Object.keys(state.triageDecisions).length === 0) return validationIssues
    return validationIssues.filter((issue, index) => {
      const issueId = `${issue.type}-${issue.row ?? "x"}-${issue.column ?? "x"}-${index}`
      const entry = state.triageDecisions[issueId]
      return !entry || entry.decision === "accept"
    })
  }, [validationIssues, state.triageDecisions])

  // Demo mode: render guided onboarding instead of normal workflow
  if (isDemoMode) {
    return (
      <GuidedOnboarding
        user={user}
        onComplete={() => {
          // Clear demo sessionStorage and redirect to normal pipeline
          sessionStorage.removeItem("truqc-pipeline-demo")
          router.replace("/pipeline")
        }}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between animate-fade-up">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Pipeline
          </h1>
          <p className="text-sm text-muted-foreground">
            Import, inspect, validate, review, clean, and export your survey data
          </p>
        </div>
        {state.currentStage !== "import" && (
          <button
            onClick={handleReset}
            className="group inline-flex items-center gap-2 self-start rounded-xl bg-foreground px-4 py-2 text-sm font-semibold text-background transition-all hover:opacity-90 active:scale-[0.98] sm:px-5 sm:py-2.5"
          >
            <RefreshCw className="size-3.5" />
            Reset Pipeline
          </button>
        )}
      </div>

      <PipelineStepper state={state} onStageClick={handleStageClick} />

      <div className="animate-fade-up [animation-delay:80ms] [animation-fill-mode:backwards]">
        {state.currentStage === "import" && (
          <StageImport state={state} dispatch={dispatch} fileRef={fileRef} secondFileRef={secondFileRef} />
        )}

        {state.currentStage === "inspect" && (
          <StageInspect state={state} dispatch={dispatch} fileRef={fileRef} secondFileRef={secondFileRef} />
        )}

        {state.currentStage === "validate" && (
          <StageValidate state={state} dispatch={dispatch} onIssuesFound={setValidationIssues} validationIssues={validationIssues} />
        )}

        {state.currentStage === "review" && (
          <StageReview state={state} dispatch={dispatch} validationIssues={validationIssues} />
        )}

        {state.currentStage === "clean" && (
          <StageClean state={state} dispatch={dispatch} validationIssues={acceptedIssues} />
        )}

        {state.currentStage === "export" && (
          <StageExport state={state} dispatch={dispatch} fileRef={fileRef} userId={user.id} validationIssues={validationIssues} />
        )}
      </div>
    </div>
  )
}
