import { describe, it, expect } from "vitest"
import { ONBOARDING_STEPS } from "./onboarding-steps"
import { STAGE_ORDER } from "./pipeline-state"

describe("ONBOARDING_STEPS", () => {
  it("has one entry per pipeline stage", () => {
    expect(ONBOARDING_STEPS).toHaveLength(6)
  })

  it("stages match STAGE_ORDER", () => {
    const stages = ONBOARDING_STEPS.map((s) => s.stage)
    expect(stages).toEqual(STAGE_ORDER)
  })

  it("every step has selector, title, and description", () => {
    for (const step of ONBOARDING_STEPS) {
      expect(typeof step.selector).toBe("string")
      expect(step.selector.length).toBeGreaterThan(0)
      expect(typeof step.title).toBe("string")
      expect(step.title.length).toBeGreaterThan(0)
      expect(typeof step.description).toBe("string")
      expect(step.description.length).toBeGreaterThan(0)
    }
  })

  it("all selectors use data-onboarding attribute format", () => {
    for (const step of ONBOARDING_STEPS) {
      expect(step.selector).toMatch(/\[data-onboarding=/)
    }
  })
})
