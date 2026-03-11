import { describe, it, expect } from 'vitest'
import { detectHeaderRow } from '@/lib/parsing/header-detector'

describe('detectHeaderRow', () => {
  it('returns 0 when first row is headers', () => {
    const rows = [
      ['KP', 'Easting', 'Northing', 'Depth'],
      ['0.000', '432100.123', '6543210.456', '12.34'],
      ['0.500', '432100.567', '6543210.890', '12.56'],
    ]
    expect(detectHeaderRow(rows)).toBe(0)
  })

  it('returns 3 when first 3 rows are metadata', () => {
    const rows = [
      ['Company: ACME Surveys Ltd', '', '', ''],
      ['Date: 2026-01-15', '', '', ''],
      ['', '', '', ''],
      ['KP', 'Easting', 'Northing', 'Depth'],
      ['0.000', '432100.123', '6543210.456', '12.34'],
    ]
    expect(detectHeaderRow(rows)).toBe(3)
  })

  it('skips single-cell metadata rows', () => {
    const rows = [
      ['Survey Report', '', ''],
      ['KP', 'Easting', 'Northing'],
      ['0.0', '500.1', '600.2'],
    ]
    expect(detectHeaderRow(rows)).toBe(1)
  })

  it('skips rows with key: value pattern', () => {
    const rows = [
      ['Client: BigCorp', '', ''],
      ['Project: Pipeline A', '', ''],
      ['KP', 'Easting', 'Northing'],
      ['0.0', '500.1', '600.2'],
    ]
    expect(detectHeaderRow(rows)).toBe(2)
  })

  it('defaults to 0 if no clear header found', () => {
    const rows = [
      ['1', '2', '3'],
      ['4', '5', '6'],
    ]
    expect(detectHeaderRow(rows)).toBe(0)
  })

  it('handles empty rows array', () => {
    expect(detectHeaderRow([])).toBe(0)
  })

  it('skips mostly-empty rows', () => {
    const rows = [
      ['', '', '', ''],
      ['', '', '', ''],
      ['KP', 'Easting', 'Northing', 'Depth'],
      ['0.0', '500.1', '600.2', '12.3'],
    ]
    expect(detectHeaderRow(rows)).toBe(2)
  })
})
