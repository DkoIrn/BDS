import { describe, it, expect } from "vitest"
import {
  pipelineReducer,
  canNavigateTo,
  initialState,
  type PipelineState,
} from "@/app/(dashboard)/pipeline/lib/pipeline-state"

describe("pipelineReducer", () => {
  it("IMPORT_FILE resets state and advances to inspect", () => {
    const result = pipelineReducer(initialState, {
      type: "IMPORT_FILE",
      fileName: "test.csv",
    })
    expect(result.currentStage).toBe("inspect")
    expect(result.stages.import.completed).toBe(true)
    expect(result.stages.import.summary).toBe("test.csv")
    expect(result.fileName).toBe("test.csv")
    expect(result.fileSource).toBe("upload")
  })

  it("IMPORT_EXISTING sets datasetId and advances to inspect", () => {
    const result = pipelineReducer(initialState, {
      type: "IMPORT_EXISTING",
      datasetId: "ds-123",
      fileName: "existing.csv",
    })
    expect(result.currentStage).toBe("inspect")
    expect(result.stages.import.completed).toBe(true)
    expect(result.fileSource).toBe("existing")
    expect(result.datasetId).toBe("ds-123")
    expect(result.fileName).toBe("existing.csv")
  })

  it("INSPECT_COMPLETE stores parsed data and advances to validate", () => {
    const afterImport = pipelineReducer(initialState, {
      type: "IMPORT_FILE",
      fileName: "test.csv",
    })
    const result = pipelineReducer(afterImport, {
      type: "INSPECT_COMPLETE",
      parsedData: [["a", "b"], ["1", "2"]],
      columnCount: 2,
      rowCount: 1,
    })
    expect(result.currentStage).toBe("validate")
    expect(result.stages.inspect.completed).toBe(true)
    expect(result.stages.inspect.summary).toBe("2 columns, 1 rows")
    expect(result.parsedData).toEqual([["a", "b"], ["1", "2"]])
    expect(result.columnCount).toBe(2)
    expect(result.rowCount).toBe(1)
  })

  it("SKIP_VALIDATE marks validate as skipped and advances to clean", () => {
    const afterInspect = pipelineReducer(
      pipelineReducer(initialState, { type: "IMPORT_FILE", fileName: "f.csv" }),
      { type: "INSPECT_COMPLETE", parsedData: [], columnCount: 0, rowCount: 0 }
    )
    const result = pipelineReducer(afterInspect, { type: "SKIP_VALIDATE" })
    expect(result.currentStage).toBe("clean")
    expect(result.stages.validate.skipped).toBe(true)
    expect(result.stages.validate.completed).toBe(false)
    expect(result.stages.validate.summary).toBe(
      "Skipped -- dataset not validated"
    )
  })

  it("VALIDATE_START keeps current stage as validate", () => {
    const afterInspect = pipelineReducer(
      pipelineReducer(initialState, { type: "IMPORT_FILE", fileName: "f.csv" }),
      { type: "INSPECT_COMPLETE", parsedData: [], columnCount: 0, rowCount: 0 }
    )
    const result = pipelineReducer(afterInspect, { type: "VALIDATE_START" })
    expect(result.currentStage).toBe("validate")
    // State should be identical (no changes)
    expect(result).toBe(afterInspect)
  })

  it("VALIDATE_COMPLETE stores run data and advances to clean", () => {
    const afterInspect = pipelineReducer(
      pipelineReducer(initialState, { type: "IMPORT_FILE", fileName: "f.csv" }),
      { type: "INSPECT_COMPLETE", parsedData: [], columnCount: 0, rowCount: 0 }
    )
    const result = pipelineReducer(afterInspect, {
      type: "VALIDATE_COMPLETE",
      runId: "run-1",
      issueCount: 3,
    })
    expect(result.currentStage).toBe("clean")
    expect(result.stages.validate.completed).toBe(true)
    expect(result.stages.validate.summary).toBe("3 issues found")
    expect(result.validationRunId).toBe("run-1")
    expect(result.issueCount).toBe(3)
  })

  it("VALIDATE_COMPLETE with 0 issues shows all checks passed", () => {
    const afterInspect = pipelineReducer(
      pipelineReducer(initialState, { type: "IMPORT_FILE", fileName: "f.csv" }),
      { type: "INSPECT_COMPLETE", parsedData: [], columnCount: 0, rowCount: 0 }
    )
    const result = pipelineReducer(afterInspect, {
      type: "VALIDATE_COMPLETE",
      runId: "run-2",
      issueCount: 0,
    })
    expect(result.stages.validate.summary).toBe("All checks passed")
  })

  it("SKIP_CLEAN marks clean as skipped and advances to export", () => {
    const afterValidate = pipelineReducer(
      pipelineReducer(
        pipelineReducer(initialState, {
          type: "IMPORT_FILE",
          fileName: "f.csv",
        }),
        { type: "INSPECT_COMPLETE", parsedData: [], columnCount: 0, rowCount: 0 }
      ),
      { type: "VALIDATE_COMPLETE", runId: "run-1", issueCount: 0 }
    )
    const result = pipelineReducer(afterValidate, { type: "SKIP_CLEAN" })
    expect(result.currentStage).toBe("export")
    expect(result.stages.clean.skipped).toBe(true)
  })

  it("CLEAN_COMPLETE stores cleaned data and advances to export", () => {
    const afterValidate = pipelineReducer(
      pipelineReducer(
        pipelineReducer(initialState, {
          type: "IMPORT_FILE",
          fileName: "f.csv",
        }),
        { type: "INSPECT_COMPLETE", parsedData: [], columnCount: 0, rowCount: 0 }
      ),
      { type: "VALIDATE_COMPLETE", runId: "run-1", issueCount: 0 }
    )
    const blob = new Blob(["test"])
    const result = pipelineReducer(afterValidate, {
      type: "CLEAN_COMPLETE",
      cleanedData: blob,
    })
    expect(result.currentStage).toBe("export")
    expect(result.stages.clean.completed).toBe(true)
    expect(result.cleanedData).toBe(blob)
  })

  it("SET_EXPORT_FORMAT updates export format", () => {
    const result = pipelineReducer(initialState, {
      type: "SET_EXPORT_FORMAT",
      format: "geojson",
    })
    expect(result.exportFormat).toBe("geojson")
  })

  it("GO_TO_STAGE transitions when canNavigateTo returns true", () => {
    const afterImport = pipelineReducer(initialState, {
      type: "IMPORT_FILE",
      fileName: "f.csv",
    })
    // Should be able to go back to import (always navigable)
    const result = pipelineReducer(afterImport, {
      type: "GO_TO_STAGE",
      stage: "import",
    })
    expect(result.currentStage).toBe("import")
  })

  it("GO_TO_STAGE does NOT transition when canNavigateTo returns false", () => {
    // From initial state, trying to go to inspect should fail
    const result = pipelineReducer(initialState, {
      type: "GO_TO_STAGE",
      stage: "inspect",
    })
    expect(result.currentStage).toBe("import")
  })

  it("RESET returns initial state", () => {
    const modified = pipelineReducer(initialState, {
      type: "IMPORT_FILE",
      fileName: "f.csv",
    })
    const result = pipelineReducer(modified, { type: "RESET" })
    expect(result.currentStage).toBe("import")
    expect(result.fileName).toBeNull()
    expect(result.stages.import.completed).toBe(false)
  })
})

describe("canNavigateTo", () => {
  const afterImport = pipelineReducer(initialState, {
    type: "IMPORT_FILE",
    fileName: "test.csv",
  })
  const afterInspect = pipelineReducer(afterImport, {
    type: "INSPECT_COMPLETE",
    parsedData: [],
    columnCount: 0,
    rowCount: 0,
  })

  it("always allows navigation to import", () => {
    expect(canNavigateTo(initialState, "import")).toBe(true)
    expect(canNavigateTo(afterImport, "import")).toBe(true)
  })

  it("allows inspect only when import is completed", () => {
    expect(canNavigateTo(afterImport, "inspect")).toBe(true)
  })

  it("allows validate only when inspect is completed", () => {
    expect(canNavigateTo(afterInspect, "validate")).toBe(true)
  })

  it("allows clean when inspect is completed (validate can be skipped)", () => {
    expect(canNavigateTo(afterInspect, "clean")).toBe(true)
  })

  it("allows export when import is completed", () => {
    expect(canNavigateTo(afterImport, "export")).toBe(true)
  })

  it("blocks inspect when import is not completed", () => {
    expect(canNavigateTo(initialState, "inspect")).toBe(false)
  })

  it("blocks validate when inspect is not completed", () => {
    expect(canNavigateTo(afterImport, "validate")).toBe(false)
  })
})
