// Pipeline workflow state machine: types, reducer, gating logic

export type PipelineStage =
  | "import"
  | "inspect"
  | "validate"
  | "clean"
  | "export"

export const STAGE_ORDER: PipelineStage[] = [
  "import",
  "inspect",
  "validate",
  "clean",
  "export",
]

export interface StageStatus {
  completed: boolean
  skipped: boolean
  summary: string | null
}

export interface PipelineState {
  currentStage: PipelineStage
  stages: Record<PipelineStage, StageStatus>
  fileName: string | null
  fileSource: "upload" | "existing" | null
  datasetId: string | null
  parsedData: string[][] | null
  columnCount: number | null
  rowCount: number | null
  validationRunId: string | null
  issueCount: number | null
  cleanedData: Blob | null
  exportFormat: string | null
}

export type PipelineAction =
  | { type: "IMPORT_FILE"; fileName: string }
  | { type: "IMPORT_EXISTING"; datasetId: string; fileName: string }
  | {
      type: "INSPECT_COMPLETE"
      parsedData: string[][]
      columnCount: number
      rowCount: number
    }
  | { type: "SKIP_VALIDATE" }
  | { type: "VALIDATE_START" }
  | { type: "VALIDATE_COMPLETE"; runId: string; issueCount: number }
  | { type: "SKIP_CLEAN" }
  | { type: "CLEAN_COMPLETE"; cleanedData: Blob }
  | { type: "SET_EXPORT_FORMAT"; format: string }
  | { type: "GO_TO_STAGE"; stage: PipelineStage }
  | { type: "RESET" }

const defaultStageStatus: StageStatus = {
  completed: false,
  skipped: false,
  summary: null,
}

export const initialState: PipelineState = {
  currentStage: "import",
  stages: {
    import: { ...defaultStageStatus },
    inspect: { ...defaultStageStatus },
    validate: { ...defaultStageStatus },
    clean: { ...defaultStageStatus },
    export: { ...defaultStageStatus },
  },
  fileName: null,
  fileSource: null,
  datasetId: null,
  parsedData: null,
  columnCount: null,
  rowCount: null,
  validationRunId: null,
  issueCount: null,
  cleanedData: null,
  exportFormat: null,
}

/**
 * Determine if navigation to a target stage is allowed given current state.
 * Smart gating: import always navigable, validate/clean skippable, export after import.
 */
export function canNavigateTo(
  state: PipelineState,
  targetStage: PipelineStage
): boolean {
  switch (targetStage) {
    case "import":
      // Always navigable (restart)
      return true
    case "inspect":
      return state.stages.import.completed
    case "validate":
      return state.stages.inspect.completed
    case "clean":
      // Clean available if inspect completed (validate can be skipped)
      return state.stages.inspect.completed
    case "export":
      // Export available once data is imported
      return state.stages.import.completed
    default:
      return false
  }
}

export function pipelineReducer(
  state: PipelineState,
  action: PipelineAction
): PipelineState {
  switch (action.type) {
    case "IMPORT_FILE": {
      return {
        ...initialState,
        currentStage: "inspect",
        stages: {
          ...initialState.stages,
          import: {
            completed: true,
            skipped: false,
            summary: action.fileName,
          },
        },
        fileName: action.fileName,
        fileSource: "upload",
      }
    }

    case "IMPORT_EXISTING": {
      return {
        ...initialState,
        currentStage: "inspect",
        stages: {
          ...initialState.stages,
          import: {
            completed: true,
            skipped: false,
            summary: action.fileName,
          },
        },
        fileName: action.fileName,
        fileSource: "existing",
        datasetId: action.datasetId,
      }
    }

    case "INSPECT_COMPLETE": {
      return {
        ...state,
        currentStage: "validate",
        stages: {
          ...state.stages,
          inspect: {
            completed: true,
            skipped: false,
            summary: `${action.columnCount} columns, ${action.rowCount} rows`,
          },
        },
        parsedData: action.parsedData,
        columnCount: action.columnCount,
        rowCount: action.rowCount,
      }
    }

    case "SKIP_VALIDATE": {
      return {
        ...state,
        currentStage: "clean",
        stages: {
          ...state.stages,
          validate: {
            completed: false,
            skipped: true,
            summary: "Skipped -- dataset not validated",
          },
        },
      }
    }

    case "VALIDATE_START": {
      // Stay on validate (for loading state tracking in the component)
      return state
    }

    case "VALIDATE_COMPLETE": {
      const summary =
        action.issueCount === 0
          ? "All checks passed"
          : `${action.issueCount} issues found`
      return {
        ...state,
        currentStage: "clean",
        stages: {
          ...state.stages,
          validate: {
            completed: true,
            skipped: false,
            summary,
          },
        },
        validationRunId: action.runId,
        issueCount: action.issueCount,
      }
    }

    case "SKIP_CLEAN": {
      return {
        ...state,
        currentStage: "export",
        stages: {
          ...state.stages,
          clean: {
            completed: false,
            skipped: true,
            summary: "Skipped -- no transforms applied",
          },
        },
      }
    }

    case "CLEAN_COMPLETE": {
      return {
        ...state,
        currentStage: "export",
        stages: {
          ...state.stages,
          clean: {
            completed: true,
            skipped: false,
            summary: "Transforms applied",
          },
        },
        cleanedData: action.cleanedData,
      }
    }

    case "SET_EXPORT_FORMAT": {
      return {
        ...state,
        exportFormat: action.format,
      }
    }

    case "GO_TO_STAGE": {
      if (!canNavigateTo(state, action.stage)) {
        return state
      }
      return {
        ...state,
        currentStage: action.stage,
      }
    }

    case "RESET": {
      return { ...initialState }
    }

    default:
      return state
  }
}
