// Lightweight client-side QC validation for pipeline uploaded files
// Runs on parsedData (string[][]) without needing Supabase/backend

export interface ValidationIssue {
  type: "missing" | "duplicate" | "outlier" | "kp_gap" | "kp_monotonicity"
  severity: "critical" | "warning" | "info"
  row?: number
  column?: string
  message: string
  /** Human-readable explanation with expected vs actual values */
  detail?: string
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
