// One-click fix engine: individual fix functions with preview and apply
// Extracts algorithms from auto-clean.ts into targeted, user-controlled operations

import type { FixPreview, FixResult } from "./fix-types"
import { findKpColumn, detectNumericColumns } from "./auto-clean"

// =============================================================================
// Fill Missing Values (linear interpolation)
// =============================================================================

export function previewFillMissing(data: string[][]): FixPreview {
  if (data.length < 2) {
    return { type: "fill_missing", affectedRows: [], totalAffected: 0 }
  }

  const headers = data[0]
  const rows = data.slice(1)
  const numericCols = detectNumericColumns(headers, rows)
  const affectedRows: FixPreview["affectedRows"] = []

  for (const colIdx of numericCols) {
    for (let i = 0; i < rows.length; i++) {
      const val = rows[i][colIdx]?.trim() ?? ""
      if (val !== "") continue

      const interpolated = computeInterpolation(rows, i, colIdx)
      if (interpolated !== null) {
        affectedRows.push({
          rowIndex: i + 2, // 1-indexed + header
          column: headers[colIdx],
          before: "(empty)",
          after: String(interpolated),
          explanation: "Linear interpolation from surrounding values",
        })
      }
    }
  }

  return { type: "fill_missing", affectedRows, totalAffected: affectedRows.length }
}

export function applyFillMissing(data: string[][]): FixResult {
  const undoSnapshot = deepCopy(data)
  const preview = previewFillMissing(data)

  // Deep copy data for mutation
  const result = deepCopy(data)

  for (const row of preview.affectedRows) {
    const dataRowIdx = row.rowIndex - 1 // convert 1-indexed to array index
    const colIdx = result[0].findIndex((h) => h === row.column)
    if (colIdx !== -1 && dataRowIdx < result.length) {
      result[dataRowIdx][colIdx] = row.after
    }
  }

  return { data: result, preview, undoSnapshot }
}

// =============================================================================
// Remove Duplicates
// =============================================================================

export function previewRemoveDuplicates(data: string[][]): FixPreview {
  if (data.length < 2) {
    return { type: "remove_duplicates", affectedRows: [], totalAffected: 0 }
  }

  const rows = data.slice(1)
  const seen = new Set<string>()
  const affectedRows: FixPreview["affectedRows"] = []

  for (let i = 0; i < rows.length; i++) {
    const key = rows[i].join("|")
    if (seen.has(key)) {
      affectedRows.push({
        rowIndex: i + 2, // 1-indexed + header
        before: `Row ${i + 2}`,
        after: "Removed",
        explanation: "Exact duplicate of a previous row",
      })
    } else {
      seen.add(key)
    }
  }

  return { type: "remove_duplicates", affectedRows, totalAffected: affectedRows.length }
}

export function applyRemoveDuplicates(data: string[][]): FixResult {
  const undoSnapshot = deepCopy(data)
  const preview = previewRemoveDuplicates(data)

  const headers = data[0]
  const rows = data.slice(1)
  const seen = new Set<string>()
  const unique: string[][] = []

  for (const row of rows) {
    const key = row.join("|")
    if (!seen.has(key)) {
      seen.add(key)
      unique.push([...row])
    }
  }

  return { data: [[...headers], ...unique], preview, undoSnapshot }
}

// =============================================================================
// Smooth Spikes (z-score > 4 replaced with neighbor median)
// =============================================================================

export function previewSmoothSpikes(data: string[][]): FixPreview {
  if (data.length < 2) {
    return { type: "smooth_spikes", affectedRows: [], totalAffected: 0 }
  }

  const headers = data[0]
  const rows = data.slice(1)
  const numericCols = detectNumericColumns(headers, rows)
  const affectedRows: FixPreview["affectedRows"] = []

  for (const colIdx of numericCols) {
    const values: { val: number; idx: number }[] = []
    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i][colIdx]?.trim() ?? ""
      if (raw === "") continue
      const num = Number(raw)
      if (!isNaN(num)) values.push({ val: num, idx: i })
    }

    if (values.length < 5) continue

    const mean = values.reduce((s, v) => s + v.val, 0) / values.length
    const stdDev = Math.sqrt(
      values.reduce((s, v) => s + (v.val - mean) ** 2, 0) / values.length
    )

    if (stdDev === 0) continue

    const threshold = 4.0
    for (const { val, idx } of values) {
      const zScore = Math.abs((val - mean) / stdDev)
      if (zScore <= threshold) continue

      // Compute neighbor median (same as auto-clean.ts removeSpikes)
      const neighbors: number[] = []
      for (let j = Math.max(0, idx - 2); j <= Math.min(rows.length - 1, idx + 2); j++) {
        if (j === idx) continue
        const nVal = Number(rows[j][colIdx])
        if (!isNaN(nVal)) neighbors.push(nVal)
      }

      if (neighbors.length < 2) continue

      neighbors.sort((a, b) => a - b)
      const median = neighbors[Math.floor(neighbors.length / 2)]
      const rounded = Number(median.toFixed(3))

      affectedRows.push({
        rowIndex: idx + 2,
        column: headers[colIdx],
        before: String(val),
        after: String(rounded),
        explanation: `Spike detected (z-score: ${zScore.toFixed(1)}) — replaced with neighbor median ${rounded}`,
      })
    }
  }

  return { type: "smooth_spikes", affectedRows, totalAffected: affectedRows.length }
}

export function applySmoothSpikes(data: string[][]): FixResult {
  const undoSnapshot = deepCopy(data)
  const preview = previewSmoothSpikes(data)

  const result = deepCopy(data)

  for (const row of preview.affectedRows) {
    const dataRowIdx = row.rowIndex - 1
    const colIdx = result[0].findIndex((h) => h === row.column)
    if (colIdx !== -1 && dataRowIdx < result.length) {
      result[dataRowIdx][colIdx] = row.after
    }
  }

  return { data: result, preview, undoSnapshot }
}

// =============================================================================
// Utilities
// =============================================================================

function computeInterpolation(
  rows: string[][],
  rowIdx: number,
  colIdx: number
): number | null {
  // Find nearest non-empty numeric neighbors
  let prevIdx = -1
  let nextIdx = -1

  for (let j = rowIdx - 1; j >= 0; j--) {
    if ((rows[j][colIdx]?.trim() ?? "") !== "" && !isNaN(Number(rows[j][colIdx]))) {
      prevIdx = j
      break
    }
  }
  for (let j = rowIdx + 1; j < rows.length; j++) {
    if ((rows[j][colIdx]?.trim() ?? "") !== "" && !isNaN(Number(rows[j][colIdx]))) {
      nextIdx = j
      break
    }
  }

  // Only interpolate with both neighbors and small gap (<=3 rows)
  if (prevIdx === -1 || nextIdx === -1) return null
  if (nextIdx - prevIdx > 4) return null

  const prevVal = Number(rows[prevIdx][colIdx])
  const nextVal = Number(rows[nextIdx][colIdx])
  const ratio = (rowIdx - prevIdx) / (nextIdx - prevIdx)
  const interpolated = prevVal + ratio * (nextVal - prevVal)

  return Number(interpolated.toFixed(3))
}

function deepCopy(data: string[][]): string[][] {
  return data.map((row) => [...row])
}
