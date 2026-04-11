import { describe, it, expect } from 'vitest'
import type { ColumnMapping } from '@/lib/parsing/types'
import type { ValidationIssue } from '@/lib/types/validation'
import {
  extractSpatialIssues,
  extractSpatialPoints,
  hasSpatialColumns,
} from './coordinate-extractor'

// Helper to create a mock ColumnMapping
function col(
  index: number,
  name: string,
  mappedType: ColumnMapping['mappedType'],
  ignored = false
): ColumnMapping {
  return { index, originalName: name, mappedType, ignored }
}

// Helper to create a mock ValidationIssue
function issue(overrides: Partial<ValidationIssue> = {}): ValidationIssue {
  return {
    id: 'iss-1',
    run_id: 'run-1',
    dataset_id: 'ds-1',
    row_number: 1,
    column_name: 'depth',
    rule_type: 'range_check',
    severity: 'warning',
    message: 'Value out of range',
    expected: '0-100',
    actual: '150',
    kp_value: 0.5,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('hasSpatialColumns', () => {
  it('returns true when lat and lon columns are mapped', () => {
    const mappings = [
      col(0, 'KP', 'kp'),
      col(1, 'Latitude', 'latitude'),
      col(2, 'Longitude', 'longitude'),
    ]
    expect(hasSpatialColumns(mappings)).toBe(true)
  })

  it('returns true when easting and northing columns are mapped', () => {
    const mappings = [
      col(0, 'KP', 'kp'),
      col(1, 'Easting', 'easting'),
      col(2, 'Northing', 'northing'),
    ]
    expect(hasSpatialColumns(mappings)).toBe(true)
  })

  it('returns false when only lat is mapped (no lon)', () => {
    const mappings = [
      col(0, 'KP', 'kp'),
      col(1, 'Latitude', 'latitude'),
    ]
    expect(hasSpatialColumns(mappings)).toBe(false)
  })

  it('returns false when no spatial columns are mapped', () => {
    const mappings = [
      col(0, 'KP', 'kp'),
      col(1, 'Depth', 'depth'),
    ]
    expect(hasSpatialColumns(mappings)).toBe(false)
  })

  it('returns false for null mappings', () => {
    expect(hasSpatialColumns(null)).toBe(false)
  })
})

describe('extractSpatialIssues', () => {
  const latLonMappings = [
    col(0, 'KP', 'kp'),
    col(1, 'Latitude', 'latitude'),
    col(2, 'Longitude', 'longitude'),
    col(3, 'Depth', 'depth'),
  ]

  // Header row + 3 data rows (row_number is 1-indexed, header is row 0)
  const parsedData = [
    ['KP', 'Latitude', 'Longitude', 'Depth'],
    ['0.0', '56.1234', '-3.4567', '10.5'],
    ['0.5', '56.1240', '-3.4570', '11.0'],
    ['1.0', '56.1250', '-3.4580', '12.0'],
  ]

  it('returns SpatialIssue[] with correct coords from lat/lon columns', () => {
    const issues = [issue({ row_number: 1 })]
    const result = extractSpatialIssues(issues, parsedData, latLonMappings)
    expect(result).toHaveLength(1)
    expect(result[0].lat).toBe(56.1234)
    expect(result[0].lng).toBe(-3.4567)
    expect(result[0].issue).toBe(issues[0])
  })

  it('uses easting/northing when no lat/lon columns exist', () => {
    const enMappings = [
      col(0, 'KP', 'kp'),
      col(1, 'Easting', 'easting'),
      col(2, 'Northing', 'northing'),
      col(3, 'Depth', 'depth'),
    ]
    const enData = [
      ['KP', 'Easting', 'Northing', 'Depth'],
      ['0.0', '400000', '600000', '10.5'],
    ]
    const issues = [issue({ row_number: 1 })]
    const result = extractSpatialIssues(issues, enData, enMappings)
    expect(result).toHaveLength(1)
    // easting/northing passed as lat/lng (caller must convert)
    expect(result[0].lat).toBe(600000)
    expect(result[0].lng).toBe(400000)
  })

  it('returns empty array when no spatial columns exist', () => {
    const noSpatialMappings = [
      col(0, 'KP', 'kp'),
      col(1, 'Depth', 'depth'),
    ]
    const issues = [issue({ row_number: 1 })]
    const result = extractSpatialIssues(issues, parsedData, noSpatialMappings)
    expect(result).toEqual([])
  })

  it('skips issues where row_number is out of bounds', () => {
    const issues = [issue({ row_number: 99 })]
    const result = extractSpatialIssues(issues, parsedData, latLonMappings)
    expect(result).toEqual([])
  })

  it('skips issues where coordinates are NaN', () => {
    const nanData = [
      ['KP', 'Latitude', 'Longitude', 'Depth'],
      ['0.0', 'invalid', '-3.4567', '10.5'],
    ]
    const issues = [issue({ row_number: 1 })]
    const result = extractSpatialIssues(issues, nanData, latLonMappings)
    expect(result).toEqual([])
  })

  it('handles multiple issues across different rows', () => {
    const issues = [
      issue({ id: 'i1', row_number: 1 }),
      issue({ id: 'i2', row_number: 3 }),
    ]
    const result = extractSpatialIssues(issues, parsedData, latLonMappings)
    expect(result).toHaveLength(2)
    expect(result[0].lat).toBe(56.1234)
    expect(result[1].lat).toBe(56.1250)
  })
})

describe('extractSpatialPoints', () => {
  it('extracts all data rows as SpatialDataPoint[]', () => {
    const mappings = [
      col(0, 'KP', 'kp'),
      col(1, 'Latitude', 'latitude'),
      col(2, 'Longitude', 'longitude'),
    ]
    const data = [
      ['KP', 'Latitude', 'Longitude'],
      ['0.0', '56.1234', '-3.4567'],
      ['0.5', '56.1240', '-3.4570'],
    ]
    const result = extractSpatialPoints(data, mappings)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ rowIndex: 1, lat: 56.1234, lng: -3.4567, kp: 0.0 })
    expect(result[1]).toEqual({ rowIndex: 2, lat: 56.1240, lng: -3.4570, kp: 0.5 })
  })

  it('omits kp when KP column is not mapped', () => {
    const mappings = [
      col(0, 'Latitude', 'latitude'),
      col(1, 'Longitude', 'longitude'),
    ]
    const data = [
      ['Latitude', 'Longitude'],
      ['56.1234', '-3.4567'],
    ]
    const result = extractSpatialPoints(data, mappings)
    expect(result).toHaveLength(1)
    expect(result[0].kp).toBeUndefined()
  })

  it('skips rows with NaN coordinates', () => {
    const mappings = [
      col(0, 'Latitude', 'latitude'),
      col(1, 'Longitude', 'longitude'),
    ]
    const data = [
      ['Latitude', 'Longitude'],
      ['56.1234', '-3.4567'],
      ['bad', '-3.4570'],
    ]
    const result = extractSpatialPoints(data, mappings)
    expect(result).toHaveLength(1)
  })
})
