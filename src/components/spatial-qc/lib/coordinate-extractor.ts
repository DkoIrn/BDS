import type { ColumnMapping } from '@/lib/parsing/types'
import type { ValidationIssue } from '@/lib/types/validation'
import type { SpatialIssue, SpatialDataPoint } from './types'

/**
 * Check whether column mappings include spatial coordinate pairs.
 * Returns true when lat+lon or easting+northing are both mapped.
 */
export function hasSpatialColumns(
  mappings: ColumnMapping[] | null
): boolean {
  if (!mappings) return false
  const types = new Set(mappings.map((m) => m.mappedType))
  // Only lat/lng — easting/northing requires CRS conversion which isn't implemented
  if (types.has('latitude') && types.has('longitude')) return true
  return false
}

/** Find the column index for a given mapped type, or -1 if not found */
function findColumnIndex(
  mappings: ColumnMapping[],
  type: ColumnMapping['mappedType']
): number {
  const mapping = mappings.find((m) => m.mappedType === type)
  return mapping ? mapping.index : -1
}

/**
 * Resolve coordinate column indices from mappings.
 * Prefers lat/lon, falls back to easting/northing.
 * For easting/northing: northing -> lat, easting -> lng (caller must convert CRS).
 * Returns null if no spatial columns found.
 */
function resolveCoordIndices(
  mappings: ColumnMapping[]
): { latIdx: number; lngIdx: number } | null {
  const latIdx = findColumnIndex(mappings, 'latitude')
  const lngIdx = findColumnIndex(mappings, 'longitude')
  if (latIdx >= 0 && lngIdx >= 0) return { latIdx, lngIdx }

  const northIdx = findColumnIndex(mappings, 'northing')
  const eastIdx = findColumnIndex(mappings, 'easting')
  if (northIdx >= 0 && eastIdx >= 0) return { latIdx: northIdx, lngIdx: eastIdx }

  return null
}

/**
 * Extract spatial issues by cross-referencing validation issues with parsed data.
 * row_number is 1-indexed (header is row 0 in parsedData).
 * Skips issues where row is out of bounds or coordinates are NaN.
 */
export function extractSpatialIssues(
  issues: ValidationIssue[],
  parsedData: string[][],
  columnMappings: ColumnMapping[]
): SpatialIssue[] {
  const coords = resolveCoordIndices(columnMappings)
  if (!coords) return []

  const { latIdx, lngIdx } = coords
  const result: SpatialIssue[] = []

  for (const iss of issues) {
    const rowIdx = iss.row_number
    if (rowIdx < 0 || rowIdx >= parsedData.length) continue

    const row = parsedData[rowIdx]
    if (!row) continue

    const lat = parseFloat(row[latIdx])
    const lng = parseFloat(row[lngIdx])
    if (isNaN(lat) || isNaN(lng)) continue

    result.push({ issue: iss, lat, lng })
  }

  return result
}

/**
 * Extract all data points as SpatialDataPoint[] (not just issue rows).
 * Skips header row (index 0). Includes kp value if KP column is mapped.
 */
export function extractSpatialPoints(
  parsedData: string[][],
  columnMappings: ColumnMapping[]
): SpatialDataPoint[] {
  const coords = resolveCoordIndices(columnMappings)
  if (!coords) return []

  const { latIdx, lngIdx } = coords
  const kpIdx = findColumnIndex(columnMappings, 'kp')
  const result: SpatialDataPoint[] = []

  // Skip header row (index 0)
  for (let i = 1; i < parsedData.length; i++) {
    const row = parsedData[i]
    if (!row) continue

    const lat = parseFloat(row[latIdx])
    const lng = parseFloat(row[lngIdx])
    if (isNaN(lat) || isNaN(lng)) continue

    const point: SpatialDataPoint = { rowIndex: i, lat, lng }
    if (kpIdx >= 0) {
      const kp = parseFloat(row[kpIdx])
      if (!isNaN(kp)) point.kp = kp
    }

    result.push(point)
  }

  return result
}
