// Lightweight client-side QC validation for pipeline uploaded files
// Runs on parsedData (string[][]) without needing Supabase/backend

export interface ValidationIssue {
  type: "missing" | "duplicate" | "outlier" | "kp_gap" | "kp_monotonicity" | "cross_dataset" | "cross_dataset_coverage" | "custom_rule"
  severity: "critical" | "warning" | "info"
  row?: number
  column?: string
  message: string
  /** Human-readable explanation with expected vs actual values */
  detail?: string
  /** KP value for cross-dataset issues (used instead of row number) */
  kpValue?: number
}

export interface ValidationResult {
  issues: ValidationIssue[]
  summary: {
    total: number
    critical: number
    warning: number
    info: number
  }
}

/**
 * Run QC checks on parsed data entirely in the browser.
 * parsedData[0] is the header row, parsedData[1..] are data rows.
 */
export function validateClientSide(parsedData: string[][]): ValidationResult {
  if (parsedData.length < 2) {
    return { issues: [], summary: { total: 0, critical: 0, warning: 0, info: 0 } }
  }

  const headers = parsedData[0]
  const rows = parsedData.slice(1)
  const issues: ValidationIssue[] = []

  // 1. Missing data detection
  checkMissingData(headers, rows, issues)

  // 2. Duplicate row detection
  checkDuplicateRows(rows, issues)

  // 3. Numeric outlier detection (z-score)
  const numericCols = detectNumericColumns(headers, rows)
  for (const colIdx of numericCols) {
    checkOutliers(headers[colIdx], colIdx, rows, issues)
  }

  // 4. KP-specific checks
  const kpIdx = findKpColumn(headers)
  if (kpIdx !== -1) {
    checkKpMonotonicity(kpIdx, rows, issues)
    checkKpGaps(kpIdx, rows, issues)
  }

  const summary = {
    total: issues.length,
    critical: issues.filter((i) => i.severity === "critical").length,
    warning: issues.filter((i) => i.severity === "warning").length,
    info: issues.filter((i) => i.severity === "info").length,
  }

  return { issues, summary }
}

function checkMissingData(
  headers: string[],
  rows: string[][],
  issues: ValidationIssue[]
) {
  for (let col = 0; col < headers.length; col++) {
    let missingCount = 0
    for (let row = 0; row < rows.length; row++) {
      const val = rows[row]?.[col]?.trim() ?? ""
      if (val === "") missingCount++
    }
    if (missingCount > 0) {
      const pct = ((missingCount / rows.length) * 100).toFixed(1)
      issues.push({
        type: "missing",
        severity: "info",
        column: headers[col],
        message: `${missingCount} missing value${missingCount > 1 ? "s" : ""} in "${headers[col]}"`,
        detail: `${missingCount} of ${rows.length} rows (${pct}%) have empty values in the "${headers[col]}" column. Expected: all cells populated.`,
      })
    }
  }
}

function checkDuplicateRows(rows: string[][], issues: ValidationIssue[]) {
  const seen = new Map<string, number>()
  for (let i = 0; i < rows.length; i++) {
    const key = rows[i].join("|")
    const prev = seen.get(key)
    if (prev !== undefined) {
      issues.push({
        type: "duplicate",
        severity: "critical",
        row: i + 2, // +2 for 1-indexed + header
        message: `Row ${i + 2} is a duplicate of row ${prev + 2}`,
        detail: `Exact duplicate: all ${rows[i].length} column values match between row ${i + 2} and row ${prev + 2}. One copy should be removed.`,
      })
    } else {
      seen.set(key, i)
    }
  }
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
    // Consider numeric if >80% of non-empty values are numbers
    if (nonEmptyCount > 0 && numericCount / nonEmptyCount > 0.8) {
      numericCols.push(col)
    }
  }
  return numericCols
}

function checkOutliers(
  colName: string,
  colIdx: number,
  rows: string[][],
  issues: ValidationIssue[]
) {
  const values: { val: number; row: number }[] = []
  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i]?.[colIdx]?.trim() ?? ""
    if (raw === "") continue
    const num = Number(raw)
    if (!isNaN(num)) values.push({ val: num, row: i })
  }

  if (values.length < 5) return // Not enough data for stats

  const mean = values.reduce((s, v) => s + v.val, 0) / values.length
  const stdDev = Math.sqrt(
    values.reduce((s, v) => s + (v.val - mean) ** 2, 0) / values.length
  )

  if (stdDev === 0) return // All values identical

  const threshold = 3.0
  for (const { val, row } of values) {
    const zScore = Math.abs((val - mean) / stdDev)
    if (zScore > threshold) {
      issues.push({
        type: "outlier",
        severity: "warning",
        row: row + 2,
        column: colName,
        message: `Outlier in "${colName}" at row ${row + 2}: ${val} (z-score: ${zScore.toFixed(1)})`,
        detail: `Value ${val} is ${zScore.toFixed(1)} standard deviations from the mean. Expected range: ${(mean - 3 * stdDev).toFixed(2)} to ${(mean + 3 * stdDev).toFixed(2)} (mean: ${mean.toFixed(2)}, σ: ${stdDev.toFixed(2)}).`,
      })
    }
  }
}

function findKpColumn(headers: string[]): number {
  const kpPatterns = [/^kp$/i, /^chainage$/i, /^station/i, /^km\s*p/i]
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].trim()
    if (kpPatterns.some((p) => p.test(h))) return i
  }
  return -1
}

function checkKpMonotonicity(
  kpIdx: number,
  rows: string[][],
  issues: ValidationIssue[]
) {
  let prevKp: number | null = null
  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i]?.[kpIdx]?.trim() ?? ""
    if (raw === "") continue
    const kp = Number(raw)
    if (isNaN(kp)) continue

    if (prevKp !== null) {
      if (kp < prevKp) {
        issues.push({
          type: "kp_monotonicity",
          severity: "critical",
          row: i + 2,
          column: "KP",
          message: `KP decreases at row ${i + 2}: ${kp} < ${prevKp}`,
          detail: `KP should increase monotonically along the pipeline. Found ${kp} after ${prevKp} — a decrease of ${(prevKp - kp).toFixed(3)} km. This row may be out of order or contain a data entry error.`,
        })
      } else if (kp === prevKp) {
        issues.push({
          type: "kp_monotonicity",
          severity: "warning",
          row: i + 2,
          column: "KP",
          message: `Duplicate KP value at row ${i + 2}: ${kp}`,
          detail: `Two consecutive rows share the same KP value (${kp}). Expected: strictly increasing KP. This may indicate a duplicate measurement or a data entry error.`,
        })
      }
    }
    prevKp = kp
  }
}

function checkKpGaps(
  kpIdx: number,
  rows: string[][],
  issues: ValidationIssue[]
) {
  const spacings: { spacing: number; row: number }[] = []
  let prevKp: number | null = null

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i]?.[kpIdx]?.trim() ?? ""
    if (raw === "") continue
    const kp = Number(raw)
    if (isNaN(kp)) continue

    if (prevKp !== null) {
      spacings.push({ spacing: Math.abs(kp - prevKp), row: i })
    }
    prevKp = kp
  }

  if (spacings.length < 3) return

  // Median spacing
  const sorted = [...spacings].sort((a, b) => a.spacing - b.spacing)
  const median = sorted[Math.floor(sorted.length / 2)].spacing

  if (median === 0) return

  const gapThreshold = median * 3
  for (const { spacing, row } of spacings) {
    if (spacing > gapThreshold) {
      issues.push({
        type: "kp_gap",
        severity: "warning",
        row: row + 2,
        column: "KP",
        message: `KP gap at row ${row + 2}: spacing ${spacing.toFixed(3)} exceeds threshold ${gapThreshold.toFixed(3)}`,
        detail: `Gap of ${spacing.toFixed(3)} km detected between rows. Normal spacing: ~${median.toFixed(3)} km. Threshold: ${gapThreshold.toFixed(3)} km (3× median). This may indicate missing survey data or a line break.`,
      })
    }
  }
}


// --- Cross-dataset validation ---

import type { CrossValidationPresetConfig } from "./cross-validation-presets"

interface CrossDatasetConfig {
  preset: CrossValidationPresetConfig
  tolerances: Record<string, number>
  datasetTypeA: string
  datasetTypeB: string
}

interface NumericRow {
  kp: number
  values: Record<string, number>
}

function findColumnIndex(headers: string[], name: string): number {
  const lower = name.toLowerCase()
  for (let i = 0; i < headers.length; i++) {
    if (headers[i].toLowerCase().trim() === lower) return i
  }
  return -1
}

function extractNumericRows(
  data: string[][],
  kpIdx: number,
  colIndices: Record<string, number>
): NumericRow[] {
  const rows: NumericRow[] = []
  for (let i = 1; i < data.length; i++) {
    const kpRaw = data[i]?.[kpIdx]?.trim() ?? ""
    const kp = Number(kpRaw)
    if (isNaN(kp)) continue

    const values: Record<string, number> = {}
    for (const [name, idx] of Object.entries(colIndices)) {
      if (idx >= 0) {
        const v = Number(data[i]?.[idx]?.trim() ?? "")
        if (!isNaN(v)) values[name] = v
      }
    }
    rows.push({ kp, values })
  }
  return rows.sort((a, b) => a.kp - b.kp)
}

function alignByKp(
  rowsA: NumericRow[],
  rowsB: NumericRow[],
  tolerance: number
): Array<{ a: NumericRow; b: NumericRow | null }> {
  const aligned: Array<{ a: NumericRow; b: NumericRow | null }> = []
  let bStart = 0

  for (const a of rowsA) {
    let bestIdx = -1
    let bestDist = Infinity

    for (let j = bStart; j < rowsB.length; j++) {
      const dist = Math.abs(a.kp - rowsB[j].kp)
      if (dist < bestDist) {
        bestDist = dist
        bestIdx = j
      }
      // Once we're past the tolerance and moving away, stop searching
      if (rowsB[j].kp > a.kp + tolerance) break
    }

    if (bestDist <= tolerance && bestIdx >= 0) {
      aligned.push({ a, b: rowsB[bestIdx] })
      // Advance search start to avoid re-matching
      bStart = bestIdx + 1
    } else {
      aligned.push({ a, b: null })
    }
  }
  return aligned
}

/**
 * Run cross-dataset validation on two parsed datasets (string[][]).
 * Ports the Python cross_dataset.py logic to TypeScript for client-side use.
 */
export function validateCrossDataset(
  dataA: string[][],
  dataB: string[][],
  config: CrossDatasetConfig
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const { preset, tolerances, datasetTypeA, datasetTypeB } = config

  const headersA = dataA[0] ?? []
  const headersB = dataB[0] ?? []

  // Find KP columns
  const kpIdxA = findColumnIndex(headersA, "kp")
  const kpIdxB = findColumnIndex(headersB, "kp")

  if (kpIdxA === -1 || kpIdxB === -1) {
    if (kpIdxA === -1) {
      issues.push({
        type: "cross_dataset",
        severity: "warning",
        row: 0,
        message: `No KP column found in ${datasetTypeA} dataset -- cannot perform cross-dataset alignment`,
      })
    }
    if (kpIdxB === -1) {
      issues.push({
        type: "cross_dataset",
        severity: "warning",
        row: 0,
        message: `No KP column found in ${datasetTypeB} dataset -- cannot perform cross-dataset alignment`,
      })
    }
    return issues
  }

  // Collect column indices needed for checks
  const colNamesA = new Set<string>()
  const colNamesB = new Set<string>()
  for (const pair of preset.columnPairs) {
    if (pair.check !== "coverage") {
      colNamesA.add(pair.a)
      colNamesB.add(pair.b)
    }
  }

  const colIndicesA: Record<string, number> = {}
  for (const name of colNamesA) {
    colIndicesA[name] = findColumnIndex(headersA, name)
  }
  const colIndicesB: Record<string, number> = {}
  for (const name of colNamesB) {
    colIndicesB[name] = findColumnIndex(headersB, name)
  }

  const rowsA = extractNumericRows(dataA, kpIdxA, colIndicesA)
  const rowsB = extractNumericRows(dataB, kpIdxB, colIndicesB)

  if (rowsA.length === 0 || rowsB.length === 0) return issues

  // 1. Coverage gaps
  checkCoverageGaps(rowsA, rowsB, datasetTypeA, datasetTypeB, issues)

  // 2. Align by KP
  const kpTol = tolerances["kp_alignment"] ?? preset.kpAlignmentTolerance
  const aligned = alignByKp(rowsA, rowsB, kpTol)

  // 3. Run column pair checks
  for (const pair of preset.columnPairs) {
    if (pair.check === "coverage") continue

    const tolKey = `${pair.a}_vs_${pair.b}_${pair.check}`
    const pairTol = tolerances[tolKey] ?? pair.tolerance ?? 0

    for (const { a, b } of aligned) {
      if (!b) continue // No match within tolerance

      const valA = a.values[pair.a]
      const valB = b.values[pair.b]
      if (valA === undefined || valB === undefined) continue

      if (pair.check === "delta") {
        const delta = Math.abs(valA - valB)
        if (delta > pairTol) {
          issues.push({
            type: "cross_dataset",
            severity: "warning",
            row: 0,
            column: `${pair.a}(${datasetTypeA})/${pair.b}(${datasetTypeB})`,
            message: `${pair.a} vs ${pair.b} mismatch at KP ${a.kp.toFixed(3)}: ${pair.a}=${valA.toFixed(3)} (${datasetTypeA}) vs ${pair.b}=${valB.toFixed(3)} (${datasetTypeB}) -- delta ${delta.toFixed(3)} exceeds tolerance ${pairTol}`,
            kpValue: a.kp,
          })
        }
      } else if (pair.check === "a_gte_b") {
        if (valA < valB - pairTol) {
          const delta = valB - valA
          issues.push({
            type: "cross_dataset",
            severity: "critical",
            row: 0,
            column: `${pair.a}(${datasetTypeA})/${pair.b}(${datasetTypeB})`,
            message: `${pair.a} vs ${pair.b} violation at KP ${a.kp.toFixed(3)}: ${pair.a}=${valA.toFixed(3)} (${datasetTypeA}) vs ${pair.b}=${valB.toFixed(3)} (${datasetTypeB}) -- ${pair.b} exceeds ${pair.a} by ${delta.toFixed(3)}`,
            kpValue: a.kp,
          })
        }
      }
    }
  }

  return issues
}

function checkCoverageGaps(
  rowsA: NumericRow[],
  rowsB: NumericRow[],
  typeA: string,
  typeB: string,
  issues: ValidationIssue[]
) {
  const minA = rowsA[0].kp
  const maxA = rowsA[rowsA.length - 1].kp
  const minB = rowsB[0].kp
  const maxB = rowsB[rowsB.length - 1].kp

  if (maxA > maxB) {
    issues.push({
      type: "cross_dataset_coverage",
      severity: "warning",
      row: 0,
      message: `Coverage gap: ${typeA} extends to KP ${maxA.toFixed(3)} but ${typeB} only covers to KP ${maxB.toFixed(3)} -- gap from KP ${maxB.toFixed(3)} to ${maxA.toFixed(3)}`,
      kpValue: maxB,
    })
  }
  if (maxB > maxA) {
    issues.push({
      type: "cross_dataset_coverage",
      severity: "warning",
      row: 0,
      message: `Coverage gap: ${typeB} extends to KP ${maxB.toFixed(3)} but ${typeA} only covers to KP ${maxA.toFixed(3)} -- gap from KP ${maxA.toFixed(3)} to ${maxB.toFixed(3)}`,
      kpValue: maxA,
    })
  }
  if (minA < minB) {
    issues.push({
      type: "cross_dataset_coverage",
      severity: "warning",
      row: 0,
      message: `Coverage gap: ${typeA} starts at KP ${minA.toFixed(3)} but ${typeB} starts at KP ${minB.toFixed(3)} -- gap from KP ${minA.toFixed(3)} to ${minB.toFixed(3)}`,
      kpValue: minA,
    })
  }
  if (minB < minA) {
    issues.push({
      type: "cross_dataset_coverage",
      severity: "warning",
      row: 0,
      message: `Coverage gap: ${typeB} starts at KP ${minB.toFixed(3)} but ${typeA} starts at KP ${minA.toFixed(3)} -- gap from KP ${minB.toFixed(3)} to ${minA.toFixed(3)}`,
      kpValue: minB,
    })
  }
}
