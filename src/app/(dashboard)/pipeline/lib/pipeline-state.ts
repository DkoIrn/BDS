// Pipeline workflow state machine: types, reducer, gating logic

export type PipelineStage =
  | "import"
  | "inspect"
  | "validate"
  | "review"
  | "clean"
  | "export"

export const STAGE_ORDER: PipelineStage[] = [
  "import",
  "inspect",
  "validate",
  "review",
  "clean",
  "export",
]

export interface StageStatus {
  completed: boolean
  skipped: boolean
  summary: string | null
}

export type TriageDecision = "accept" | "reject" | "defer"

export interface TriageEntry {
  decision: TriageDecision
  justification: string | null
  timestamp: number
}

/** Dataset type labels for cross-dataset validation */
export type DatasetTypeLabel =
  | "DOB"
  | "DOC"
  | "TOP"
  | "Event Listing"
  | "Position"
  | "Other"

/** Map dataset type pairs to preset IDs */
const PRESET_MAP: Record<string, string> = {
  "DOB|DOC": "dob_vs_doc",
  "DOC|DOB": "dob_vs_doc",
  "Position|Event Listing": "position_vs_event",
  "Event Listing|Position": "position_vs_event",
}

/** Lookup a preset ID from two dataset type labels */
export function lookupPreset(a: DatasetTypeLabel | null, b: DatasetTypeLabel | null): string | null {
  if (!a || !b) return null
  return PRESET_MAP[`${a}|${b}`] ?? null
}

/** Human-readable preset names */
export const PRESET_NAMES: Record<string, string> = {
  dob_vs_doc: "DOB vs DOC Consistency",
  position_vs_event: "Position vs Event Alignment",
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
  /** Data after auto-clean (replaces parsedData for export) */
  cleanedData: string[][] | null
  /** Number of auto-clean actions applied */
  cleanActionCount: number | null
  /** Auto-clean summary for audit trail */
  cleanSummary: Record<string, unknown> | null
  exportFormat: string | null
  triageDecisions: Record<string, TriageEntry>
  triageAutoSkipped: boolean

  // Cross-dataset fields
  crossDatasetMode: boolean
  secondFileName: string | null
  secondFileSource: "upload" | "existing" | null
  secondDatasetId: string | null
  secondParsedData: string[][] | null
  secondColumnCount: number | null
  secondRowCount: number | null
  datasetTypeA: DatasetTypeLabel | null
  datasetTypeB: DatasetTypeLabel | null
  crossValidationPreset: string | null
  crossValidationTolerances: Record<string, number>
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
  | { type: "CLEAN_COMPLETE"; cleanedData: string[][]; actionCount: number; summary: Record<string, unknown> }
  | { type: "AI_FIX_APPLIED"; updatedData: string[][] }
  | { type: "SET_EXPORT_FORMAT"; format: string }
  | { type: "TRIAGE_ISSUE"; issueId: string; decision: TriageDecision; justification: string | null }
  | { type: "TRIAGE_BULK"; issueIds: string[]; decision: TriageDecision; justification: string | null }
  | { type: "SKIP_REVIEW" }
  | { type: "REVIEW_COMPLETE" }
  | { type: "AUTO_SKIP_REVIEW" }
  | { type: "GO_TO_STAGE"; stage: PipelineStage }
  | { type: "RESET" }
  // Cross-dataset actions
  | { type: "TOGGLE_CROSS_DATASET" }
  | { type: "IMPORT_SECOND_FILE"; fileName: string }
  | { type: "IMPORT_SECOND_EXISTING"; datasetId: string; fileName: string }
  | { type: "INSPECT_SECOND_COMPLETE"; parsedData: string[][]; columnCount: number; rowCount: number }
  | { type: "SET_DATASET_TYPE"; which: "A" | "B"; datasetType: DatasetTypeLabel }
  | { type: "SET_CROSS_TOLERANCE"; key: string; value: number }

const defaultStageStatus: StageStatus = {
  completed: false,
  skipped: false,
  summary: null,
}

const defaultCrossDatasetFields = {
  crossDatasetMode: false,
  secondFileName: null,
  secondFileSource: null as "upload" | "existing" | null,
  secondDatasetId: null,
  secondParsedData: null,
  secondColumnCount: null,
  secondRowCount: null,
  datasetTypeA: null as DatasetTypeLabel | null,
  datasetTypeB: null as DatasetTypeLabel | null,
  crossValidationPreset: null,
  crossValidationTolerances: {} as Record<string, number>,
}

export const initialState: PipelineState = {
  currentStage: "import",
  stages: {
    import: { ...defaultStageStatus },
    inspect: { ...defaultStageStatus },
    validate: { ...defaultStageStatus },
    review: { ...defaultStageStatus },
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
  cleanActionCount: null,
  cleanSummary: null,
  exportFormat: null,
  triageDecisions: {},
  triageAutoSkipped: false,
  ...defaultCrossDatasetFields,
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
    case "review":
      return state.stages.validate.completed || state.stages.validate.skipped
    case "clean":
      // Clean available if inspect completed (validate and review can be skipped)
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
      // In cross-dataset mode, don't advance to inspect until both files are ready
      const bothReady = state.crossDatasetMode && state.secondFileName
      const waitingForSecond = state.crossDatasetMode && !state.secondFileName
      return {
        ...initialState,
        crossDatasetMode: state.crossDatasetMode,
        secondFileName: state.secondFileName,
        secondFileSource: state.secondFileSource,
        secondDatasetId: state.secondDatasetId,
        secondParsedData: state.secondParsedData,
        secondColumnCount: state.secondColumnCount,
        secondRowCount: state.secondRowCount,
        datasetTypeA: state.datasetTypeA,
        datasetTypeB: state.datasetTypeB,
        crossValidationPreset: state.crossValidationPreset,
        crossValidationTolerances: state.crossValidationTolerances,
        currentStage: waitingForSecond ? "import" : "inspect",
        stages: {
          ...initialState.stages,
          import: {
            completed: !waitingForSecond,
            skipped: false,
            summary: action.fileName,
          },
        },
        fileName: action.fileName,
        fileSource: "upload",
      }
    }

    case "IMPORT_EXISTING": {
      const bothReady2 = state.crossDatasetMode && state.secondFileName
      const waitingForSecond2 = state.crossDatasetMode && !state.secondFileName
      return {
        ...initialState,
        crossDatasetMode: state.crossDatasetMode,
        secondFileName: state.secondFileName,
        secondFileSource: state.secondFileSource,
        secondDatasetId: state.secondDatasetId,
        secondParsedData: state.secondParsedData,
        secondColumnCount: state.secondColumnCount,
        secondRowCount: state.secondRowCount,
        datasetTypeA: state.datasetTypeA,
        datasetTypeB: state.datasetTypeB,
        crossValidationPreset: state.crossValidationPreset,
        crossValidationTolerances: state.crossValidationTolerances,
        currentStage: waitingForSecond2 ? "import" : "inspect",
        stages: {
          ...initialState.stages,
          import: {
            completed: !waitingForSecond2,
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
        currentStage: "review",
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
        currentStage: "validate",
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

    case "TRIAGE_ISSUE": {
      return {
        ...state,
        triageDecisions: {
          ...state.triageDecisions,
          [action.issueId]: {
            decision: action.decision,
            justification: action.justification,
            timestamp: Date.now(),
          },
        },
      }
    }

    case "TRIAGE_BULK": {
      const newDecisions = { ...state.triageDecisions }
      for (const issueId of action.issueIds) {
        newDecisions[issueId] = {
          decision: action.decision,
          justification: action.justification,
          timestamp: Date.now(),
        }
      }
      return {
        ...state,
        triageDecisions: newDecisions,
      }
    }

    case "SKIP_REVIEW": {
      return {
        ...state,
        currentStage: "clean",
        stages: {
          ...state.stages,
          review: {
            completed: false,
            skipped: true,
            summary: "Skipped -- issues not reviewed",
          },
        },
      }
    }

    case "REVIEW_COMPLETE": {
      const decisions = Object.values(state.triageDecisions)
      const accepted = decisions.filter((d) => d.decision === "accept").length
      const rejected = decisions.filter((d) => d.decision === "reject").length
      const deferred = decisions.filter((d) => d.decision === "defer").length
      return {
        ...state,
        currentStage: "clean",
        stages: {
          ...state.stages,
          review: {
            completed: true,
            skipped: false,
            summary: `${accepted} accepted, ${rejected} rejected, ${deferred} deferred`,
          },
        },
      }
    }

    case "AUTO_SKIP_REVIEW": {
      return {
        ...state,
        currentStage: "clean",
        triageAutoSkipped: true,
        stages: {
          ...state.stages,
          review: {
            completed: true,
            skipped: false,
            summary: "No issues to review",
          },
        },
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
            summary: `${action.actionCount} fix${action.actionCount !== 1 ? "es" : ""} applied`,
          },
        },
        cleanedData: action.cleanedData,
        cleanActionCount: action.actionCount,
        cleanSummary: action.summary,
        // Update parsedData so export uses cleaned version
        parsedData: action.cleanedData,
        rowCount: action.cleanedData.length - 1,
      }
    }

    case "AI_FIX_APPLIED": {
      return {
        ...state,
        cleanedData: action.updatedData,
        parsedData: action.updatedData,
        rowCount: action.updatedData.length - 1,
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

    // Cross-dataset actions
    case "TOGGLE_CROSS_DATASET": {
      if (state.crossDatasetMode) {
        // Turning off: reset all cross-dataset fields
        return {
          ...state,
          ...defaultCrossDatasetFields,
        }
      }
      return {
        ...state,
        crossDatasetMode: true,
      }
    }

    case "IMPORT_SECOND_FILE": {
      // If primary file is already imported, advance to inspect
      const primaryReady = !!state.fileName
      return {
        ...state,
        secondFileName: action.fileName,
        secondFileSource: "upload",
        secondDatasetId: null,
        currentStage: primaryReady ? "inspect" : "import",
        stages: {
          ...state.stages,
          import: {
            completed: primaryReady,
            skipped: false,
            summary: primaryReady ? `${state.fileName} + ${action.fileName}` : state.stages.import.summary,
          },
        },
      }
    }

    case "IMPORT_SECOND_EXISTING": {
      const primaryReady2 = !!state.fileName
      return {
        ...state,
        secondFileName: action.fileName,
        secondFileSource: "existing",
        secondDatasetId: action.datasetId,
        currentStage: primaryReady2 ? "inspect" : "import",
        stages: {
          ...state.stages,
          import: {
            completed: primaryReady2,
            skipped: false,
            summary: primaryReady2 ? `${state.fileName} + ${action.fileName}` : state.stages.import.summary,
          },
        },
      }
    }

    case "INSPECT_SECOND_COMPLETE": {
      return {
        ...state,
        secondParsedData: action.parsedData,
        secondColumnCount: action.columnCount,
        secondRowCount: action.rowCount,
      }
    }

    case "SET_DATASET_TYPE": {
      const newState = { ...state }
      if (action.which === "A") {
        newState.datasetTypeA = action.datasetType
      } else {
        newState.datasetTypeB = action.datasetType
      }
      // Auto-select preset
      newState.crossValidationPreset = lookupPreset(newState.datasetTypeA, newState.datasetTypeB)
      // Reset tolerances when preset changes
      newState.crossValidationTolerances = {}
      return newState
    }

    case "SET_CROSS_TOLERANCE": {
      return {
        ...state,
        crossValidationTolerances: {
          ...state.crossValidationTolerances,
          [action.key]: action.value,
        },
      }
    }

    default:
      return state
  }
}
