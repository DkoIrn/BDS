// Pipeline workflow sessionStorage persistence
// Follows the session-store.ts pattern from visualize tool

import type { PipelineState } from "./pipeline-state"

const PIPELINE_KEY = "pipeline-workflow-state"

/** Serializable subset of PipelineState -- omits non-serializable Blob */
type SerializablePipelineState = Omit<PipelineState, "cleanedData">

export function savePipelineState(state: PipelineState): void {
  try {
    const serializable: SerializablePipelineState = {
      currentStage: state.currentStage,
      stages: state.stages,
      fileName: state.fileName,
      fileSource: state.fileSource,
      datasetId: state.datasetId,
      parsedData: state.parsedData,
      columnCount: state.columnCount,
      rowCount: state.rowCount,
      validationRunId: state.validationRunId,
      issueCount: state.issueCount,
      exportFormat: state.exportFormat,
    }
    sessionStorage.setItem(PIPELINE_KEY, JSON.stringify(serializable))
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
