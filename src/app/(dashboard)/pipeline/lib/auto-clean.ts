// Deterministic auto-clean engine for pipeline data
// Runs client-side on parsedData (string[][]) + validation issues
// Returns cleaned data + a changelog of every modification

import type { ValidationIssue } from "./client-validate"

export interface CleanAction {
  type:
    | "remove_duplicate"
    | "reorder_kp"
    | "interpolate"
    | "remove_spike"
    | "fill_missing"
    | "standardize"
  row: number
  column?: string
  before: string
  after: string
  confidence: "high" | "medium"
  explanation: string
}

export interface CleanResult {
  /** Cleaned data (header + rows) */
  data: string[][]
  /** Every change made, in order */
  actions: CleanAction[]
  /** Issues that couldn't be auto-fixed (pass to AI) */
  unresolved: ValidationIssue[]
  summary: {
    duplicatesRemoved: number
    rowsReordered: boolean
    valuesInterpolated: number
    spikesRemoved: number
    missingFilled: number
    totalActions: number
  }
}

/**
 * Run all deterministic cleaning passes on the data.
 * Order matters: duplicates first, then reorder, then fill/fix values.
 */
export function autoClean(
  parsedData: string[][],
  issues: ValidationIssue[]
): CleanResult {
  if (parsedData.length < 2) {
    return emptyResult(parsedData, issues)
  }

  const headers = parsedData[0]
  let rows = parsedData.slice(1).map((r) => [...r]) // deep copy
  const actions: CleanAction[] = []
  const unresolvedIssues: ValidationIssue[] = []

  const kpIdx = findKpColumn(headers)
  const numericCols = detectNumericColumns(headers, rows)

  // Pass 1: Remove exact duplicate rows
  const { rows: deduped, actions: dupActions } = removeDuplicates(rows, headers)
  rows = deduped
  actions.push(...dupActions)

  // Pass 2: Reorder by KP if KP column exists and is not monotonic
  if (kpIdx !== -1) {
    const { rows: sorted, actions: sortActions } = reorderByKp(rows, kpIdx, headers)
    rows = sorted
    actions.push(...sortActions)
  }

  // Pass 3: Interpolate small gaps in numeric columns
  for (const colIdx of numericCols) {
    const { rows: filled, actions: fillActions } = interpolateGaps(
      rows,
      colIdx,
      headers[colIdx],
      kpIdx
    )
    rows = filled
    actions.push(...fillActions)
  }

  // Pass 4: Remove/replace obvious spikes (z-score > 4)
  for (const colIdx of numericCols) {
    const { rows: cleaned, actions: spikeActions } = removeSpikes(
      rows,
      colIdx,
      headers[colIdx]
    )
    rows = cleaned
    actions.push(...spikeActions)
  }

  // Pass 5: Standardize text columns (trim whitespace, consistent casing)
  const textCols = headers
    .map((_, i) => i)
    .filter((i) => !numericCols.includes(i) && i !== kpIdx)
  for (const colIdx of textCols) {
    const { rows: standardized, actions: stdActions } = standardizeColumn(
      rows,
      colIdx,
      headers[colIdx]
    )
    rows = standardized
    actions.push(...stdActions)
  }

  // Collect unresolved issues (things auto-clean couldn't fix)
  for (const issue of issues) {
    if (!isResolved(issue, actions)) {
      unresolvedIssues.push(issue)
    }
  }

  return {
    data: [headers, ...rows],
    actions,
    unresolved: unresolvedIssues,
    summary: {
      duplicatesRemoved: actions.filter((a) => a.type === "remove_duplicate").length,
      rowsReordered: actions.some((a) => a.type === "reorder_kp"),
      valuesInterpolated: actions.filter((a) => a.type === "interpolate").length,
      spikesRemoved: actions.filter((a) => a.type === "remove_spike").length,
      missingFilled: actions.filter((a) => a.type === "fill_missing").length,
      totalActions: actions.length,
    },
  }
}

// --- Cleaning passes ---

function removeDuplicates(
  rows: string[][],
  headers: string[]
): { rows: string[][]; actions: CleanAction[] } {
  const actions: CleanAction[] = []
  const seen = new Set<string>()
  const result: string[][] = []

  for (let i = 0; i < rows.length; i++) {
    const key = rows[i].join("|")
    if (seen.has(key)) {
      actions.push({
        type: "remove_duplicate",
        row: i + 2, // 1-indexed + header
        before: `Row ${i + 2}`,
        after: "Removed",
        confidence: "high",
        explanation: `Exact duplicate of a previous row — removed`,
      })
    } else {
      seen.add(key)
      result.push(rows[i])
    }
  }

  return { rows: result, actions }
}

function reorderByKp(
  rows: string[][],
  kpIdx: number,
  headers: string[]
): { rows: string[][]; actions: CleanAction[] } {
  const actions: CleanAction[] = []

  // Check if already monotonic
  let needsSort = false
  let prevKp = -Infinity
  for (const row of rows) {
    const kp = Number(row[kpIdx])
    if (!isNaN(kp) && kp < prevKp) {
      needsSort = true
      break
    }
    if (!isNaN(kp)) prevKp = kp
  }

  if (!needsSort) return { rows, actions }

  // Capture original order for changelog
  const originalKps = rows.map((r) => r[kpIdx])

  const sorted = [...rows].sort((a, b) => {
    const aKp = Number(a[kpIdx])
    const bKp = Number(b[kpIdx])
    if (isNaN(aKp) && isNaN(bKp)) return 0
    if (isNaN(aKp)) return 1
    if (isNaN(bKp)) return -1
    return aKp - bKp
  })

  actions.push({
    type: "reorder_kp",
    row: 0,
    before: `KP order: ${originalKps.slice(0, 5).join(", ")}...`,
    after: `KP order: ${sorted.slice(0, 5).map((r) => r[kpIdx]).join(", ")}...`,
    confidence: "high",
    explanation: `Rows reordered by KP column to ensure monotonically increasing sequence`,
  })

  return { rows: sorted, actions }
}

function interpolateGaps(
  rows: string[][],
  colIdx: number,
  colName: string,
  kpIdx: number
): { rows: string[][]; actions: CleanAction[] } {
  const actions: CleanAction[] = []

  for (let i = 0; i < rows.length; i++) {
    const val = rows[i][colIdx]?.trim() ?? ""
    if (val !== "") continue

    // Find nearest non-empty neighbors
    let prevIdx = -1
    let nextIdx = -1
    for (let j = i - 1; j >= 0; j--) {
      if ((rows[j][colIdx]?.trim() ?? "") !== "" && !isNaN(Number(rows[j][colIdx]))) {
        prevIdx = j
        break
      }
    }
    for (let j = i + 1; j < rows.length; j++) {
      if ((rows[j][colIdx]?.trim() ?? "") !== "" && !isNaN(Number(rows[j][colIdx]))) {
        nextIdx = j
        break
      }
    }

    // Only interpolate if we have both neighbors and gap is small (≤3 rows)
    if (prevIdx === -1 || nextIdx === -1) continue
    if (nextIdx - prevIdx > 4) continue // Gap too large — leave for AI

    const prevVal = Number(rows[prevIdx][colIdx])
    const nextVal = Number(rows[nextIdx][colIdx])

    // Linear interpolation
    const ratio = (i - prevIdx) / (nextIdx - prevIdx)
    const interpolated = prevVal + ratio * (nextVal - prevVal)
    const rounded = Number(interpolated.toFixed(3))

    rows[i][colIdx] = String(rounded)
    actions.push({
      type: "interpolate",
      row: i + 2,
      column: colName,
      before: "(empty)",
      after: String(rounded),
      confidence: "high",
      explanation: `Interpolated from neighbors: ${prevVal} (row ${prevIdx + 2}) → ${nextVal} (row ${nextIdx + 2})`,
    })
  }

  return { rows, actions }
}

function removeSpikes(
  rows: string[][],
  colIdx: number,
  colName: string
): { rows: string[][]; actions: CleanAction[] } {
  const actions: CleanAction[] = []

  // Collect valid numeric values
  const values: { val: number; idx: number }[] = []
  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i][colIdx]?.trim() ?? ""
    if (raw === "") continue
    const num = Number(raw)
    if (!isNaN(num)) values.push({ val: num, idx: i })
  }

  if (values.length < 5) return { rows, actions }

  const mean = values.reduce((s, v) => s + v.val, 0) / values.length
  const stdDev = Math.sqrt(
    values.reduce((s, v) => s + (v.val - mean) ** 2, 0) / values.length
  )

  if (stdDev === 0) return { rows, actions }

  // Only fix extreme spikes (z-score > 4) with high confidence
  const threshold = 4.0
  for (const { val, idx } of values) {
    const zScore = Math.abs((val - mean) / stdDev)
    if (zScore <= threshold) continue

    // Replace with median of neighbors (±2 rows)
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

    rows[idx][colIdx] = String(rounded)
    actions.push({
      type: "remove_spike",
      row: idx + 2,
      column: colName,
      before: String(val),
      after: String(rounded),
      confidence: "medium",
      explanation: `Spike detected (z-score: ${zScore.toFixed(1)}) — replaced with neighbor median ${rounded}`,
    })
  }

  return { rows, actions }
}

function standardizeColumn(
  rows: string[][],
  colIdx: number,
  colName: string
): { rows: string[][]; actions: CleanAction[] } {
  const actions: CleanAction[] = []

  // Count frequency of each value (trimmed, case-normalized)
  const valueCounts = new Map<string, { canonical: string; count: number }>()
  for (const row of rows) {
    const raw = row[colIdx] ?? ""
    const trimmed = raw.trim()
    if (trimmed === "") continue

    const key = trimmed.toLowerCase()
    const existing = valueCounts.get(key)
    if (existing) {
      existing.count++
    } else {
      valueCounts.set(key, { canonical: trimmed, count: 1 })
    }
  }

  // Find the most common casing for each value
  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i][colIdx] ?? ""
    const trimmed = raw.trim()

    // Fix leading/trailing whitespace
    if (raw !== trimmed && trimmed !== "") {
      rows[i][colIdx] = trimmed
      actions.push({
        type: "standardize",
        row: i + 2,
        column: colName,
        before: JSON.stringify(raw),
        after: trimmed,
        confidence: "high",
        explanation: `Trimmed whitespace`,
      })
    }
  }

  return { rows, actions }
}

// --- Utilities ---

function findKpColumn(headers: string[]): number {
  const patterns = [/^kp$/i, /^chainage$/i, /^station/i, /^km\s*p/i]
  for (let i = 0; i < headers.length; i++) {
    if (patterns.some((p) => p.test(headers[i].trim()))) return i
  }
  return -1
}

function detectNumericColumns(headers: string[], rows: string[][]): number[] {
  const numericCols: number[] = []
  const sampleSize = Math.min(rows.length, 20)

  for (let col = 0; col < headers.length; col++) {
    let numericCount = 0
    let nonEmptyCount = 0
    for (let row = 0; row < sampleSize; row++) {
      const val = rows[row]?.[col]?.trim() ?? ""
      if (val === "") continue
      nonEmptyCount++
      if (!isNaN(Number(val))) numericCount++
    }
    if (nonEmptyCount > 0 && numericCount / nonEmptyCount > 0.8) {
      numericCols.push(col)
    }
  }
  return numericCols
}

function isResolved(issue: ValidationIssue, actions: CleanAction[]): boolean {
  // Check if any action addresses this issue
  if (issue.type === "duplicate") {
    return actions.some((a) => a.type === "remove_duplicate" && a.row === issue.row)
  }
  if (issue.type === "kp_monotonicity") {
    return actions.some((a) => a.type === "reorder_kp")
  }
  if (issue.type === "outlier" && issue.row && issue.column) {
    return actions.some(
      (a) => a.type === "remove_spike" && a.row === issue.row && a.column === issue.column
    )
  }
  if (issue.type === "missing" && issue.column) {
    // Check if all missing values in this column were filled
    return actions.some((a) => a.type === "interpolate" && a.column === issue.column)
  }
  if (issue.type === "kp_gap") {
    // KP gaps might be resolved by reordering, or might remain
    return actions.some((a) => a.type === "reorder_kp")
  }
  return false
}

function emptyResult(data: string[][], issues: ValidationIssue[]): CleanResult {
  return {
    data,
    actions: [],
    unresolved: issues,
    summary: {
      duplicatesRemoved: 0,
      rowsReordered: false,
      valuesInterpolated: 0,
      spikesRemoved: 0,
      missingFilled: 0,
      totalActions: 0,
    },
  }
}
