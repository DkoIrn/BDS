import { describe, it, expect } from "vitest"
import {
  DEMO_DATASET,
  DEMO_VALIDATION,
  DEMO_TRIAGE,
  DEMO_CLEAN_RESULT,
} from "./demo-data"

describe("DEMO_DATASET", () => {
  it("has correct structure", () => {
    expect(DEMO_DATASET.parsedData).toHaveLength(22) // header + 21 rows
    expect(DEMO_DATASET.columnCount).toBe(8)
    expect(DEMO_DATASET.rowCount).toBe(21)
    expect(DEMO_DATASET.parsedData[0]).toEqual([
      "KP",
      "Easting",
      "Northing",
      "Depth",
      "DOB",
      "Cover",
      "Coating_Condition",
      "CP_Reading",
    ])
  })

  it("parsedData rows are all string arrays with 8 elements", () => {
    for (const row of DEMO_DATASET.parsedData) {
      expect(Array.isArray(row)).toBe(true)
      expect(row).toHaveLength(8)
      for (const cell of row) {
        expect(typeof cell).toBe("string")
      }
    }
  })
})

describe("DEMO_VALIDATION", () => {
  it("has 7 issues with distinct types", () => {
    expect(DEMO_VALIDATION.issueCount).toBe(7)
    expect(DEMO_VALIDATION.issues).toHaveLength(7)

    const types = DEMO_VALIDATION.issues.map((i) => i.type)
    expect(types).toContain("missing_data")
    expect(types).toContain("outlier")
    expect(types).toContain("duplicate")
    expect(types).toContain("range_violation")
    expect(types).toContain("monotonicity")
  })
})

describe("DEMO_TRIAGE", () => {
  it("has decisions for all validation issue IDs", () => {
    for (const issue of DEMO_VALIDATION.issues) {
      expect(DEMO_TRIAGE).toHaveProperty(issue.id)
    }
  })
})

describe("DEMO_CLEAN_RESULT", () => {
  it("has same dimensions as DEMO_DATASET.parsedData", () => {
    expect(DEMO_CLEAN_RESULT).toHaveLength(DEMO_DATASET.parsedData.length)
    expect(DEMO_CLEAN_RESULT[0]).toHaveLength(
      DEMO_DATASET.parsedData[0].length
    )
  })
})
