import { describe, it, expect, beforeEach } from "vitest"
import {
  savePipelineState,
  loadPipelineState,
  clearPipelineState,
} from "@/app/(dashboard)/pipeline/lib/pipeline-store"
import {
  initialState,
  pipelineReducer,
} from "@/app/(dashboard)/pipeline/lib/pipeline-state"

describe("pipeline-store", () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it("savePipelineState writes to sessionStorage", () => {
    savePipelineState(initialState)
    const raw = sessionStorage.getItem("pipeline-workflow-state")
    expect(raw).not.toBeNull()
  })

  it("loadPipelineState reads back saved state", () => {
    savePipelineState(initialState)
    const loaded = loadPipelineState()
    expect(loaded).not.toBeNull()
    expect(loaded?.currentStage).toBe("import")
  })

  it("save then load round-trips serializable fields correctly", () => {
    const afterImport = pipelineReducer(initialState, {
      type: "IMPORT_FILE",
      fileName: "data.csv",
    })
    savePipelineState(afterImport)
    const loaded = loadPipelineState()
    expect(loaded?.currentStage).toBe("inspect")
    expect(loaded?.fileName).toBe("data.csv")
    expect(loaded?.fileSource).toBe("upload")
    expect(loaded?.stages?.import.completed).toBe(true)
  })

  it("loadPipelineState returns null when no saved state", () => {
    const loaded = loadPipelineState()
    expect(loaded).toBeNull()
  })

  it("loadPipelineState returns null on corrupted JSON", () => {
    sessionStorage.setItem("pipeline-workflow-state", "{invalid json")
    const loaded = loadPipelineState()
    expect(loaded).toBeNull()
  })

  it("clearPipelineState removes state from sessionStorage", () => {
    savePipelineState(initialState)
    clearPipelineState()
    const raw = sessionStorage.getItem("pipeline-workflow-state")
    expect(raw).toBeNull()
  })

  it("omits parsedData and cleanedData from serialized state", () => {
    const stateWithData = {
      ...initialState,
      parsedData: [["a", "b"], ["1", "2"]],
      cleanedData: new Blob(["test"]),
    }
    savePipelineState(stateWithData)
    const raw = sessionStorage.getItem("pipeline-workflow-state")
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!)
    expect(parsed.parsedData).toBeUndefined()
    expect(parsed.cleanedData).toBeUndefined()
  })
})
