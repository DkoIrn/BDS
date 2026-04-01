import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { PipelineStepper } from "@/app/(dashboard)/pipeline/components/pipeline-stepper"
import {
  initialState,
  pipelineReducer,
} from "@/app/(dashboard)/pipeline/lib/pipeline-state"

describe("PipelineStepper", () => {
  it("renders all 5 stage labels", () => {
    render(<PipelineStepper state={initialState} onStageClick={() => {}} />)
    expect(screen.getByText("Import")).toBeInTheDocument()
    expect(screen.getByText("Inspect")).toBeInTheDocument()
    expect(screen.getByText("Validate")).toBeInTheDocument()
    expect(screen.getByText("Clean")).toBeInTheDocument()
    expect(screen.getByText("Export")).toBeInTheDocument()
  })

  it("marks current stage with current visual style", () => {
    render(<PipelineStepper state={initialState} onStageClick={() => {}} />)
    const importButton = screen.getByRole("button", { name: /import stage/i })
    expect(importButton).toHaveAttribute("aria-current", "step")
  })

  it("marks completed stages with check icon", () => {
    const afterImport = pipelineReducer(initialState, {
      type: "IMPORT_FILE",
      fileName: "test.csv",
    })
    const { container } = render(
      <PipelineStepper state={afterImport} onStageClick={() => {}} />
    )
    // Import stage should now be completed (green circle with check)
    // The import button should have a green circle with bg-green-500
    const importButton = screen.getByRole("button", { name: /import stage/i })
    const greenCircle = importButton.querySelector(".bg-green-500")
    expect(greenCircle).toBeInTheDocument()
  })

  it("marks skipped stages with warning icon", () => {
    const afterInspect = pipelineReducer(
      pipelineReducer(initialState, {
        type: "IMPORT_FILE",
        fileName: "f.csv",
      }),
      { type: "INSPECT_COMPLETE", parsedData: [], columnCount: 0, rowCount: 0 }
    )
    const afterSkip = pipelineReducer(afterInspect, { type: "SKIP_VALIDATE" })
    render(<PipelineStepper state={afterSkip} onStageClick={() => {}} />)
    const validateButton = screen.getByRole("button", {
      name: /validate stage/i,
    })
    const yellowCircle = validateButton.querySelector(".bg-yellow-500")
    expect(yellowCircle).toBeInTheDocument()
  })

  it("calls onStageClick when a navigable stage is clicked", () => {
    const onStageClick = vi.fn()
    const afterImport = pipelineReducer(initialState, {
      type: "IMPORT_FILE",
      fileName: "test.csv",
    })
    render(<PipelineStepper state={afterImport} onStageClick={onStageClick} />)
    // Import is always navigable
    fireEvent.click(screen.getByRole("button", { name: /import stage/i }))
    expect(onStageClick).toHaveBeenCalledWith("import")
  })

  it("does not call onStageClick for non-navigable stages", () => {
    const onStageClick = vi.fn()
    render(
      <PipelineStepper state={initialState} onStageClick={onStageClick} />
    )
    // Inspect is not navigable from initial state (button is disabled)
    const inspectButton = screen.getByRole("button", { name: /inspect stage/i })
    fireEvent.click(inspectButton)
    expect(onStageClick).not.toHaveBeenCalled()
  })
})
