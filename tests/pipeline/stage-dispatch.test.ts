import { describe, it, expect } from "vitest"
import {
  pipelineReducer,
  initialState,
} from "../../src/app/(dashboard)/pipeline/lib/pipeline-state"

// Tests that stage panels dispatch correct actions.
// Component-level tests would require mocking react-dropzone, PapaParse, etc.
// Instead we test the reducer responses to the actions each stage dispatches.

describe("StageImport dispatch", () => {
  it("dispatches IMPORT_FILE with fileName on file drop", () => {
    const next = pipelineReducer(initialState, {
      type: "IMPORT_FILE",
      fileName: "test.csv",
    })
    expect(next.fileName).toBe("test.csv")
    expect(next.fileSource).toBe("upload")
    expect(next.stages.import.completed).toBe(true)
    expect(next.currentStage).toBe("inspect")
  })

  it("dispatches IMPORT_EXISTING with datasetId on dataset select", () => {
    const next = pipelineReducer(initialState, {
      type: "IMPORT_EXISTING",
      datasetId: "dataset-123",
      fileName: "existing.csv",
    })
    expect(next.fileName).toBe("existing.csv")
    expect(next.fileSource).toBe("existing")
    expect(next.datasetId).toBe("dataset-123")
    expect(next.stages.import.completed).toBe(true)
    expect(next.currentStage).toBe("inspect")
  })

  it("dispatches RESET when re-import button is clicked", () => {
    // Start with a completed import state
    const imported = pipelineReducer(initialState, {
      type: "IMPORT_FILE",
      fileName: "test.csv",
    })
    const reset = pipelineReducer(imported, { type: "RESET" })
    expect(reset.currentStage).toBe("import")
    expect(reset.fileName).toBeNull()
    expect(reset.stages.import.completed).toBe(false)
  })
})

describe("StageInspect dispatch", () => {
  it("dispatches INSPECT_COMPLETE after parsing uploaded file", () => {
    // Simulate state after import
    const imported = pipelineReducer(initialState, {
      type: "IMPORT_FILE",
      fileName: "test.csv",
    })

    const inspected = pipelineReducer(imported, {
      type: "INSPECT_COMPLETE",
      parsedData: [
        ["col1", "col2"],
        ["a", "b"],
        ["c", "d"],
      ],
      columnCount: 2,
      rowCount: 2,
    })

    expect(inspected.parsedData).toHaveLength(3) // header + 2 rows
    expect(inspected.columnCount).toBe(2)
    expect(inspected.rowCount).toBe(2)
    expect(inspected.stages.inspect.completed).toBe(true)
    expect(inspected.stages.inspect.summary).toBe("2 columns, 2 rows")
    expect(inspected.currentStage).toBe("validate")
  })
})

describe("StageValidate dispatch", () => {
  it("handles SKIP_VALIDATE action", () => {
    const imported = pipelineReducer(initialState, {
      type: "IMPORT_FILE",
      fileName: "test.csv",
    })
    const inspected = pipelineReducer(imported, {
      type: "INSPECT_COMPLETE",
      parsedData: [["col1"], ["a"]],
      columnCount: 1,
      rowCount: 1,
    })
    const skipped = pipelineReducer(inspected, { type: "SKIP_VALIDATE" })
    expect(skipped.stages.validate.skipped).toBe(true)
    expect(skipped.currentStage).toBe("clean")
  })

  it("handles VALIDATE_COMPLETE action", () => {
    const imported = pipelineReducer(initialState, {
      type: "IMPORT_FILE",
      fileName: "test.csv",
    })
    const inspected = pipelineReducer(imported, {
      type: "INSPECT_COMPLETE",
      parsedData: [["col1"], ["a"]],
      columnCount: 1,
      rowCount: 1,
    })
    const validated = pipelineReducer(inspected, {
      type: "VALIDATE_COMPLETE",
      runId: "run-1",
      issueCount: 5,
    })
    expect(validated.stages.validate.completed).toBe(true)
    expect(validated.validationRunId).toBe("run-1")
    expect(validated.issueCount).toBe(5)
    expect(validated.currentStage).toBe("clean")
  })
})

describe("StageClean dispatch", () => {
  it("handles SKIP_CLEAN action", () => {
    const state = {
      ...initialState,
      currentStage: "clean" as const,
      stages: {
        ...initialState.stages,
        import: { completed: true, skipped: false, summary: "test.csv" },
        inspect: { completed: true, skipped: false, summary: "2 cols, 1 row" },
      },
    }
    const skipped = pipelineReducer(state, { type: "SKIP_CLEAN" })
    expect(skipped.stages.clean.skipped).toBe(true)
    expect(skipped.currentStage).toBe("export")
  })
})

describe("StageExport dispatch", () => {
  it("handles SET_EXPORT_FORMAT action", () => {
    const state = {
      ...initialState,
      currentStage: "export" as const,
    }
    const next = pipelineReducer(state, {
      type: "SET_EXPORT_FORMAT",
      format: "geojson",
    })
    expect(next.exportFormat).toBe("geojson")
  })

  it("handles RESET from export to start new pipeline", () => {
    const state = {
      ...initialState,
      currentStage: "export" as const,
      fileName: "test.csv",
      exportFormat: "csv",
    }
    const reset = pipelineReducer(state, { type: "RESET" })
    expect(reset.currentStage).toBe("import")
    expect(reset.fileName).toBeNull()
    expect(reset.exportFormat).toBeNull()
  })
})
