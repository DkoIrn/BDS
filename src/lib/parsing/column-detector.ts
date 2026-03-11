import type { SurveyType } from '@/lib/types/projects'
import type { DetectedColumn, SurveyColumnType } from './types'

/** Regex patterns for matching column names to survey column types */
const NAME_PATTERNS: Record<SurveyColumnType, RegExp[]> = {
  kp: [/^kp$/i, /^chainage$/i, /^station/i, /^km\s*p/i, /^mileage$/i],
  easting: [/^easting$/i, /^east$/i, /^e$/i, /^x$/i, /^x[_\s]?coord/i],
  northing: [/^northing$/i, /^north$/i, /^n$/i, /^y$/i, /^y[_\s]?coord/i],
  depth: [/^depth$/i, /^dep$/i, /^water[_\s]?depth/i, /^wd$/i],
  dob: [/^dob$/i, /^depth[_\s]?of[_\s]?burial$/i, /^burial[_\s]?depth$/i],
  doc: [/^doc$/i, /^depth[_\s]?of[_\s]?cover$/i, /^cover[_\s]?depth$/i],
  top: [/^top$/i, /^top[_\s]?of[_\s]?pipe$/i],
  elevation: [/^elevation$/i, /^elev$/i, /^height$/i, /^z$/i],
  event: [/^event$/i, /^event[_\s]?type$/i, /^event[_\s]?code$/i],
  description: [/^desc/i, /^comment/i, /^remarks?$/i, /^notes?$/i],
  date: [/^date$/i, /^survey[_\s]?date$/i, /^timestamp$/i],
  time: [/^time$/i, /^survey[_\s]?time$/i, /^utc$/i],
  latitude: [/^lat/i, /^latitude$/i],
  longitude: [/^lon/i, /^lng/i, /^longitude$/i],
}

/** Expected columns per survey type */
const EXPECTED_COLUMNS: Record<string, SurveyColumnType[]> = {
  DOB: ['kp', 'easting', 'northing', 'dob'],
  DOC: ['kp', 'easting', 'northing', 'doc'],
  TOP: ['kp', 'easting', 'northing', 'top'],
  'Event Listing': ['kp', 'event', 'description'],
  'Pipeline Position': ['kp', 'easting', 'northing', 'depth'],
  ROVV: ['kp', 'easting', 'northing'],
}

/**
 * Try to match a column header name to a survey column type.
 * Returns the matched type or null.
 */
function matchByName(headerName: string): SurveyColumnType | null {
  const trimmed = headerName.trim()
  if (!trimmed) return null

  for (const [type, patterns] of Object.entries(NAME_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(trimmed)) {
        return type as SurveyColumnType
      }
    }
  }
  return null
}

/**
 * Analyze column data values to infer type.
 * Returns the inferred type or null.
 */
function matchByData(
  values: string[]
): SurveyColumnType | null {
  if (values.length === 0) return null

  // Filter to non-empty values
  const nonEmpty = values.filter((v) => v.trim() !== '')
  if (nonEmpty.length === 0) return null

  // Check if all values are numeric
  const numericValues = nonEmpty
    .map((v) => Number(v.trim()))
    .filter((n) => !isNaN(n))

  if (numericValues.length < nonEmpty.length * 0.8) {
    // Mostly non-numeric -- could be event/description/date
    return null
  }

  // Check for monotonically increasing (KP candidate)
  if (numericValues.length >= 3) {
    let isIncreasing = true
    for (let i = 1; i < numericValues.length; i++) {
      if (numericValues[i] <= numericValues[i - 1]) {
        isIncreasing = false
        break
      }
    }
    if (isIncreasing) {
      // Small range, monotonically increasing = likely KP/chainage
      const range = numericValues[numericValues.length - 1] - numericValues[0]
      if (range < 100000) {
        return 'kp'
      }
    }
  }

  // Check value ranges for coordinate detection
  const min = Math.min(...numericValues)
  const max = Math.max(...numericValues)

  // Large values typical of UTM eastings (100,000 - 900,000)
  if (min > 100000 && max < 900000) {
    return 'easting'
  }

  // Very large values typical of UTM northings (1,000,000 - 10,000,000)
  if (min > 1000000 && max < 10000000) {
    return 'northing'
  }

  // Small positive numbers could be depth/dob/doc/top
  if (min >= 0 && max < 500) {
    return 'depth'
  }

  return null
}

/**
 * Detect column types from parsed rows.
 *
 * @param rows - All parsed rows including header
 * @param headerRowIndex - Index of the header row
 * @param surveyType - The survey type for context-aware detection
 * @returns Array of detected columns with type and confidence
 */
export function detectColumns(
  rows: string[][],
  headerRowIndex: number,
  surveyType: SurveyType
): DetectedColumn[] {
  if (rows.length <= headerRowIndex) return []

  const headers = rows[headerRowIndex]
  const dataRows = rows.slice(
    headerRowIndex + 1,
    Math.min(headerRowIndex + 101, rows.length)
  )

  return headers.map((header, index) => {
    const columnValues = dataRows.map((row) => (row[index] ?? ''))
    const nameMatch = matchByName(header)
    const dataMatch = matchByData(columnValues)

    let detectedType: SurveyColumnType | null = null
    let confidence: 'high' | 'medium' | 'low' = 'low'

    if (nameMatch && dataMatch) {
      // Both name and data match
      detectedType = nameMatch
      confidence = 'high'
    } else if (nameMatch) {
      // Only name matches
      detectedType = nameMatch
      confidence = 'medium'
    } else if (dataMatch) {
      // Only data matches
      detectedType = dataMatch
      confidence = 'low'
    } else {
      // Neither matches
      detectedType = null
      confidence = 'low'
    }

    return {
      index,
      originalName: header,
      detectedType,
      confidence,
    }
  })
}

/**
 * Check which expected columns for a survey type are missing from the detected columns.
 */
export function getMissingExpectedColumns(
  detected: DetectedColumn[],
  surveyType: SurveyType
): SurveyColumnType[] {
  const expected = EXPECTED_COLUMNS[surveyType] ?? []
  const detectedTypes = new Set(
    detected
      .filter((c) => c.detectedType !== null)
      .map((c) => c.detectedType)
  )

  return expected.filter((type) => !detectedTypes.has(type))
}
