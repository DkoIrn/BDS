import { describe, it, expect } from "vitest"
import {
  previewFillMissing,
  applyFillMissing,
  previewRemoveDuplicates,
  applyRemoveDuplicates,
  previewSmoothSpikes,
  applySmoothSpikes,
} from "@/app/(dashboard)/pipeline/lib/fix-engine"

// --- Test data helpers ---

function makeData(headers: string[], rows: string[][]): string[][] {
  return [headers, ...rows]
}

const HEADERS = ["KP", "Depth", "Temp"]

function numericRows(count: number, opts?: { spike?: number; missing?: number[] }): string[][] {
  const rows: string[][] = []
  for (let i = 0; i < count; i++) {
    const kp = String((i + 1) * 0.1)
    let depth = String(10 + i * 0.5)
    let temp = String(20 + i * 0.1)

    if (opts?.spike !== undefined && i === opts.spike) {
      depth = "500" // spike value -- moderate but detectable with enough rows
    }
    if (opts?.missing?.includes(i)) {
      depth = ""
    }

    rows.push([kp, depth, temp])
  }
  return rows
}

// =============================================================================
// Fill Missing
// =============================================================================

describe("previewFillMissing", () => {
  it("returns preview with interpolated values for empty cells", () => {
    const rows = numericRows(5, { missing: [2] })
    const data = makeData(HEADERS, rows)
    const preview = previewFillMissing(data)

    expect(preview.type).toBe("fill_missing")
    expect(preview.totalAffected).toBeGreaterThan(0)
    expect(preview.affectedRows.length).toBe(preview.totalAffected)

    const fill = preview.affectedRows.find((r) => r.column === "Depth")
    expect(fill).toBeDefined()
    expect(fill!.before).toBe("(empty)")
    expect(Number(fill!.after)).toBeCloseTo(11, 0) // interpolated between 10.5 and 11.5
  })

  it("does NOT mutate the input data", () => {
    const rows = numericRows(5, { missing: [2] })
    const data = makeData(HEADERS, rows)
    const dataCopy = JSON.parse(JSON.stringify(data))

    previewFillMissing(data)

    expect(data).toEqual(dataCopy)
  })

  it("returns empty preview when no missing values", () => {
    const data = makeData(HEADERS, numericRows(5))
    const preview = previewFillMissing(data)

    expect(preview.totalAffected).toBe(0)
    expect(preview.affectedRows).toEqual([])
  })

  it("handles edge case: dataset with < 2 rows", () => {
    const data = [HEADERS] // header only
    const preview = previewFillMissing(data)

    expect(preview.totalAffected).toBe(0)
  })
})

describe("applyFillMissing", () => {
  it("returns FixResult with filled data and undo snapshot", () => {
    const rows = numericRows(5, { missing: [2] })
    const data = makeData(HEADERS, rows)
    const result = applyFillMissing(data)

    expect(result.data).toBeDefined()
    expect(result.preview.type).toBe("fill_missing")
    expect(result.undoSnapshot).toEqual(data)

    // The filled cell should no longer be empty
    const filledRow = result.data[3] // row index 2 + 1 for header
    expect(filledRow[1]).not.toBe("")
    expect(Number(filledRow[1])).toBeCloseTo(11, 0)
  })

  it("does NOT mutate original data", () => {
    const rows = numericRows(5, { missing: [2] })
    const data = makeData(HEADERS, rows)
    const dataCopy = JSON.parse(JSON.stringify(data))

    applyFillMissing(data)

    expect(data).toEqual(dataCopy)
  })
})

// =============================================================================
// Remove Duplicates
// =============================================================================

describe("previewRemoveDuplicates", () => {
  it("identifies duplicate rows in preview", () => {
    const rows = [
      ["0.1", "10", "20"],
      ["0.2", "11", "21"],
      ["0.1", "10", "20"], // duplicate of row 0
      ["0.3", "12", "22"],
    ]
    const data = makeData(HEADERS, rows)
    const preview = previewRemoveDuplicates(data)

    expect(preview.type).toBe("remove_duplicates")
    expect(preview.totalAffected).toBe(1)
    expect(preview.affectedRows[0].rowIndex).toBe(4) // 1-indexed: row 3 data + 1 header = 4
    expect(preview.affectedRows[0].after).toBe("Removed")
  })

  it("does NOT mutate the input data", () => {
    const rows = [
      ["0.1", "10", "20"],
      ["0.1", "10", "20"],
    ]
    const data = makeData(HEADERS, rows)
    const dataCopy = JSON.parse(JSON.stringify(data))

    previewRemoveDuplicates(data)

    expect(data).toEqual(dataCopy)
  })

  it("returns empty preview when no duplicates", () => {
    const data = makeData(HEADERS, numericRows(5))
    const preview = previewRemoveDuplicates(data)

    expect(preview.totalAffected).toBe(0)
  })

  it("handles edge case: dataset with < 2 rows", () => {
    const data = [HEADERS]
    const preview = previewRemoveDuplicates(data)

    expect(preview.totalAffected).toBe(0)
  })
})

describe("applyRemoveDuplicates", () => {
  it("removes duplicate rows keeping first occurrence", () => {
    const rows = [
      ["0.1", "10", "20"],
      ["0.2", "11", "21"],
      ["0.1", "10", "20"], // dup
      ["0.3", "12", "22"],
    ]
    const data = makeData(HEADERS, rows)
    const result = applyRemoveDuplicates(data)

    expect(result.data.length).toBe(4) // header + 3 unique rows
    expect(result.preview.totalAffected).toBe(1)
    expect(result.undoSnapshot).toEqual(data)
  })

  it("does NOT mutate original data", () => {
    const rows = [
      ["0.1", "10", "20"],
      ["0.1", "10", "20"],
    ]
    const data = makeData(HEADERS, rows)
    const originalLen = data.length

    applyRemoveDuplicates(data)

    expect(data.length).toBe(originalLen)
  })
})

// =============================================================================
// Smooth Spikes
// =============================================================================

describe("previewSmoothSpikes", () => {
  it("detects spikes and shows replacement values", () => {
    // Need enough rows for z-score stats, with one outlier
    const rows = numericRows(30, { spike: 15 })
    const data = makeData(HEADERS, rows)
    const preview = previewSmoothSpikes(data)

    expect(preview.type).toBe("smooth_spikes")
    expect(preview.totalAffected).toBeGreaterThan(0)

    const spike = preview.affectedRows.find((r) => r.before === "500")
    expect(spike).toBeDefined()
    expect(Number(spike!.after)).toBeLessThan(100) // should be replaced with neighbor median
  })

  it("does NOT mutate the input data", () => {
    const rows = numericRows(30, { spike: 15 })
    const data = makeData(HEADERS, rows)
    const dataCopy = JSON.parse(JSON.stringify(data))

    previewSmoothSpikes(data)

    expect(data).toEqual(dataCopy)
  })

  it("returns empty preview when no spikes", () => {
    const data = makeData(HEADERS, numericRows(30))
    const preview = previewSmoothSpikes(data)

    expect(preview.totalAffected).toBe(0)
  })

  it("handles edge case: too few values for statistics", () => {
    const data = makeData(HEADERS, numericRows(3))
    const preview = previewSmoothSpikes(data)

    expect(preview.totalAffected).toBe(0)
  })
})

describe("applySmoothSpikes", () => {
  it("replaces spike values with neighbor median", () => {
    const rows = numericRows(30, { spike: 15 })
    const data = makeData(HEADERS, rows)
    const result = applySmoothSpikes(data)

    // The spike at data row 15 (index 16 with header) should be replaced
    const fixedVal = Number(result.data[16][1])
    expect(fixedVal).toBeLessThan(100)
    expect(result.preview.totalAffected).toBeGreaterThan(0)
    expect(result.undoSnapshot).toEqual(data)
  })

  it("does NOT mutate original data", () => {
    const rows = numericRows(30, { spike: 15 })
    const data = makeData(HEADERS, rows)
    const dataCopy = JSON.parse(JSON.stringify(data))

    applySmoothSpikes(data)

    expect(data).toEqual(dataCopy)
  })
})
