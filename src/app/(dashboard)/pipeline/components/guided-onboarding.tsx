"use client"

import { useReducer, useCallback, useRef, useState, useMemo, useEffect } from "react"
import {
  pipelineReducer,
  initialState,
} from "../lib/pipeline-state"
import { PipelineStepper } from "./pipeline-stepper"
import { StageImport } from "./stage-import"
import { StageInspect } from "./stage-inspect"
import { StageValidate } from "./stage-validate"
import { StageReview } from "./stage-review"
import { StageClean } from "./stage-clean"
import { StageExport } from "./stage-export"
import { OnboardingWelcome } from "./onboarding-welcome"
import { OnboardingTooltip } from "./onboarding-tooltip"
import { OnboardingCelebration } from "./onboarding-celebration"
import { ONBOARDING_STEPS } from "../lib/onboarding-steps"
import {
  DEMO_DATASET,
  DEMO_VALIDATION,
  DEMO_TRIAGE,
  DEMO_CLEAN_RESULT,
} from "../lib/demo-data"
import { completeOnboarding } from "@/lib/actions/onboarding"
import type { ValidationIssue } from "../lib/client-validate"

interface GuidedOnboardingProps {
  user: { id: string; email: string }
  onComplete: () => void
}

const ONBOARDING_STORAGE_KEY = "truqc-onboarding-completed"

export function GuidedOnboarding({ user, onComplete }: GuidedOnboardingProps) {
  const [tourPhase, setTourPhase] = useState<"welcome" | "touring" | "celebration" | null>("welcome")
  const [stepIndex, setStepIndex] = useState(0)
  const [state, dispatch] = useReducer(pipelineReducer, initialState)
  const fileRef = useRef<File | null>(null)

  // Map demo issue types to ValidationIssue types
  const demoValidationIssues: ValidationIssue[] = useMemo(() => {
    const typeMap: Record<string, ValidationIssue["type"]> = {
      missing_data: "missing",
      outlier: "outlier",
      duplicate: "duplicate",
      range_violation: "outlier",
      monotonicity: "kp_monotonicity",
      kp_gap: "kp_gap",
    }
    const severityMap: Record<string, ValidationIssue["severity"]> = {
      error: "critical",
      warning: "warning",
      info: "info",
    }
    return DEMO_VALIDATION.issues.map((issue) => ({
      type: typeMap[issue.type] ?? "missing",
      severity: severityMap[issue.severity] ?? "warning",
      row: issue.row,
      column: issue.column,
      message: issue.message,
      detail: `Expected: ${issue.expected}. Actual: ${issue.actual}`,
    }))
  }, [])

  // Avoid saving demo state into real pipeline sessionStorage
  // The real pipeline uses "truqc-pipeline" key; we skip persistence entirely in demo mode

  const handleFinishOnboarding = useCallback(async () => {
    try {
      await completeOnboarding()
    } catch {
      // Best effort -- localStorage fallback ensures we don't show again
    }
    localStorage.setItem(ONBOARDING_STORAGE_KEY, "true")
    onComplete()
  }, [onComplete])

  const handleSkip = useCallback(async () => {
    await handleFinishOnboarding()
  }, [handleFinishOnboarding])

  const handleStartTour = useCallback(() => {
    setTourPhase("touring")
    // Stay on import stage — don't dispatch IMPORT_FILE yet
    // Step 0 tooltip will highlight the import card
  }, [])

  const handleNextStep = useCallback(() => {
    // Advance pipeline to the NEXT step's stage, then move tooltip forward
    const nextIndex = stepIndex + 1

    switch (stepIndex) {
      case 0:
        // Leaving import → show inspect with demo data loaded
        dispatch({ type: "IMPORT_FILE", fileName: DEMO_DATASET.fileName })
        // Immediately provide parsed data so inspect preview renders
        dispatch({
          type: "INSPECT_COMPLETE",
          parsedData: DEMO_DATASET.parsedData,
          columnCount: DEMO_DATASET.columnCount,
          rowCount: DEMO_DATASET.rowCount,
        })
        // Stay on inspect stage (INSPECT_COMPLETE advances to validate, so go back)
        dispatch({ type: "GO_TO_STAGE", stage: "inspect" })
        break
      case 1:
        // Leaving inspect → show validate with results
        dispatch({
          type: "VALIDATE_COMPLETE",
          runId: DEMO_VALIDATION.runId,
          issueCount: DEMO_VALIDATION.issueCount,
        })
        dispatch({ type: "GO_TO_STAGE", stage: "validate" })
        break
      case 2:
        // Leaving validate → show review with issues
        dispatch({ type: "GO_TO_STAGE", stage: "review" })
        break
      case 3:
        // Leaving review → advance to clean
        for (const [issueId, entry] of Object.entries(DEMO_TRIAGE)) {
          dispatch({
            type: "TRIAGE_ISSUE",
            issueId,
            decision: entry.decision,
            justification: entry.justification,
          })
        }
        dispatch({ type: "REVIEW_COMPLETE" })
        break
      case 4:
        // Leaving clean → advance to export
        dispatch({
          type: "CLEAN_COMPLETE",
          cleanedData: DEMO_CLEAN_RESULT,
          actionCount: 3,
          summary: { interpolated: 2, smoothed: 1 },
        })
        break
      case 5:
        // Leaving export → show celebration
        setTourPhase("celebration")
        return
    }

    setStepIndex(nextIndex)
  }, [stepIndex])

  if (tourPhase === "welcome") {
    return <OnboardingWelcome onStart={handleStartTour} onSkip={handleSkip} />
  }

  if (tourPhase === "celebration") {
    return (
      <OnboardingCelebration
        issueCount={DEMO_VALIDATION.issueCount}
        fixCount={3}
        onFinish={handleFinishOnboarding}
      />
    )
  }

  if (tourPhase !== "touring") return null

  const currentStep = ONBOARDING_STEPS[stepIndex]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Pipeline
          </h1>
          <p className="text-sm text-muted-foreground">
            Guided tour -- demo data loaded
          </p>
        </div>
      </div>

      <PipelineStepper state={state} onStageClick={() => {}} />

      <div className="animate-fade-up [animation-delay:80ms] [animation-fill-mode:backwards]">
        {state.currentStage === "import" && (
          <StageImport state={state} dispatch={dispatch} fileRef={fileRef} />
        )}

        {state.currentStage === "inspect" && (
          <StageInspect state={state} dispatch={dispatch} fileRef={fileRef} />
        )}

        {state.currentStage === "validate" && (
          <StageValidate state={state} dispatch={dispatch} onIssuesFound={() => {}} validationIssues={demoValidationIssues} />
        )}

        {state.currentStage === "review" && (
          <StageReview state={state} dispatch={dispatch} validationIssues={demoValidationIssues} />
        )}

        {state.currentStage === "clean" && (
          <StageClean state={state} dispatch={dispatch} validationIssues={demoValidationIssues} />
        )}

        {state.currentStage === "export" && (
          <StageExport state={state} dispatch={dispatch} fileRef={fileRef} userId={user.id} validationIssues={demoValidationIssues} />
        )}
      </div>

      {/* Tooltip overlay */}
      {currentStep && (
        <OnboardingTooltip
          step={currentStep}
          currentIndex={stepIndex}
          totalSteps={ONBOARDING_STEPS.length}
          onNext={handleNextStep}
          onSkip={handleSkip}
        />
      )}
    </div>
  )
}
