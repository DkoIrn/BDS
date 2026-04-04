"use client"

import {
  Upload,
  Eye,
  ShieldCheck,
  Sparkles,
  Download,
  Check,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react"
import type {
  PipelineStage,
  PipelineState,
  StageStatus,
} from "../lib/pipeline-state"
import { canNavigateTo, STAGE_ORDER } from "../lib/pipeline-state"
import { cn } from "@/lib/utils"

interface StageConfig {
  id: PipelineStage
  label: string
  icon: LucideIcon
}

const STAGE_CONFIG: StageConfig[] = [
  { id: "import", label: "Import", icon: Upload },
  { id: "inspect", label: "Inspect", icon: Eye },
  { id: "validate", label: "Validate", icon: ShieldCheck },
  { id: "clean", label: "Resolve", icon: Sparkles },
  { id: "export", label: "Export", icon: Download },
]

type StepVisual = "pending" | "current" | "completed" | "skipped"

function getStepVisual(
  stageId: PipelineStage,
  stages: Record<PipelineStage, StageStatus>,
  currentStage: PipelineStage
): StepVisual {
  if (stageId === currentStage) return "current"
  if (stages[stageId].completed) return "completed"
  if (stages[stageId].skipped) return "skipped"
  return "pending"
}

interface PipelineStepperProps {
  state: PipelineState
  onStageClick: (stage: PipelineStage) => void
}

export function PipelineStepper({ state, onStageClick }: PipelineStepperProps) {
  return (
    <div className="rounded-2xl border bg-card px-6 py-4">
      <div className="flex items-center justify-between">
        {STAGE_CONFIG.map((stage, index) => {
          const visual = getStepVisual(stage.id, state.stages, state.currentStage)
          const navigable = canNavigateTo(state, stage.id)
          const isLast = index === STAGE_CONFIG.length - 1

          return (
            <div key={stage.id} className="flex flex-1 items-center">
              <button
                type="button"
                onClick={() => navigable && onStageClick(stage.id)}
                className={cn(
                  "flex flex-col items-center gap-1.5",
                  navigable
                    ? "cursor-pointer"
                    : "cursor-not-allowed opacity-50"
                )}
                disabled={!navigable}
                aria-label={`${stage.label} stage`}
                aria-current={visual === "current" ? "step" : undefined}
              >
                <StepCircle
                  visual={visual}
                  Icon={stage.icon}
                />
                <span
                  className={cn(
                    "text-xs font-medium",
                    visual === "current" && "text-primary",
                    visual === "completed" && "text-green-600 dark:text-green-400",
                    visual === "skipped" && "text-yellow-600 dark:text-yellow-400",
                    visual === "pending" && "text-muted-foreground"
                  )}
                >
                  {stage.label}
                </span>
                {state.stages[stage.id].summary && visual !== "current" && (
                  <span className="max-w-[120px] truncate text-[10px] text-muted-foreground">
                    {state.stages[stage.id].summary}
                  </span>
                )}
              </button>

              {!isLast && (
                <ConnectingLine
                  leftStage={STAGE_ORDER[index]}
                  rightStage={STAGE_ORDER[index + 1]}
                  stages={state.stages}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StepCircle({
  visual,
  Icon,
}: {
  visual: StepVisual
  Icon: LucideIcon
}) {
  if (visual === "completed") {
    return (
      <div className="flex size-10 items-center justify-center rounded-full bg-green-500 text-white">
        <Check className="size-5" />
      </div>
    )
  }

  if (visual === "skipped") {
    return (
      <div className="flex size-10 items-center justify-center rounded-full bg-yellow-500 text-white">
        <AlertTriangle className="size-5" />
      </div>
    )
  }

  if (visual === "current") {
    return (
      <div className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Icon className="size-5" />
      </div>
    )
  }

  // pending
  return (
    <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
      <Icon className="size-5" />
    </div>
  )
}

function ConnectingLine({
  leftStage,
  rightStage,
  stages,
}: {
  leftStage: PipelineStage
  rightStage: PipelineStage
  stages: Record<PipelineStage, StageStatus>
}) {
  const bothDone =
    (stages[leftStage].completed || stages[leftStage].skipped) &&
    (stages[rightStage].completed || stages[rightStage].skipped)

  return (
    <div
      className={cn(
        "mx-3 h-0.5 flex-1",
        bothDone ? "bg-green-500" : "bg-muted"
      )}
    />
  )
}
