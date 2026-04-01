// Pipeline workflow sessionStorage persistence
// Follows the session-store.ts pattern from visualize tool

import type { PipelineState } from "./pipeline-state"

const PIPELINE_KEY = "pipeline-workflow-state"

export function savePipelineState(state: PipelineState): void {
  try {
    sessionStorage.setItem(PIPELINE_KEY, JSON.stringify(state))
  } catch {
    console.warn("Failed to save pipeline state to sessionStorage")
  }
}

export function loadPipelineState(): Partial<PipelineState> | null {
  try {
    const data = sessionStorage.getItem(PIPELINE_KEY)
    if (!data) return null
    return JSON.parse(data) as Partial<PipelineState>
  } catch {
    return null
  }
}

export function clearPipelineState(): void {
  try {
    sessionStorage.removeItem(PIPELINE_KEY)
  } catch {
    // Ignore errors
  }
}
