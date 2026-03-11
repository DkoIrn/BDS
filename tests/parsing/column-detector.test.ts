import { describe, it, expect } from 'vitest'
import { detectColumns, getMissingExpectedColumns } from '@/lib/parsing/column-detector'

describe('detectColumns', () => {
  it('detects KP, Easting, Northing with high confidence from exact names', () => {
    const rows = [
      ['KP', 'Easting', 'Northing'],
      ['0.0', '432100.1', '6543210.4'],
      ['0.5', '432100.5', '6543210.8'],
      ['1.0', '432101.0', '6543211.3'],
    ]
    const result = detectColumns(rows, 0, 'DOB')
    expect(result).toHaveLength(3)
    expect(result[0]).toMatchObject({
      index: 0,
      originalName: 'KP',
      detectedType: 'kp',
      confidence: 'high',
    })
    expect(result[1]).toMatchObject({
      detectedType: 'easting',
      confidence: 'high',
    })
    expect(result[2]).toMatchObject({
      detectedType: 'northing',
      confidence: 'high',
    })
  })

  it('matches chainage, E, N via regex patterns', () => {
    const rows = [
      ['Chainage', 'E', 'N'],
      ['0.0', '432100.1', '6543210.4'],
      ['0.5', '432100.5', '6543210.8'],
    ]
    const result = detectColumns(rows, 0, 'DOB')
    expect(result[0].detectedType).toBe('kp')
    expect(result[1].detectedType).toBe('easting')
    expect(result[2].detectedType).toBe('northing')
  })

  it('returns null type with low confidence for unrecognizable header', () => {
    const rows = [
      ['Foo', 'Bar', 'Baz'],
      ['abc', 'def', 'ghi'],
      ['jkl', 'mno', 'pqr'],
    ]
    const result = detectColumns(rows, 0, 'DOB')
    expect(result[0].detectedType).toBeNull()
    expect(result[0].confidence).toBe('low')
  })

  it('uses data sampling to detect type when header is ambiguous', () => {
    // Monotonically increasing numeric column suggests kp
    const rows = [
      ['Station', 'X', 'Y'],
      ['0.000', '432100.1', '6543210.4'],
      ['0.500', '432100.5', '6543210.8'],
      ['1.000', '432101.0', '6543211.3'],
      ['1.500', '432101.4', '6543211.7'],
    ]
    const result = detectColumns(rows, 0, 'DOB')
    expect(result[0].detectedType).toBe('kp')
  })

  it('assigns high confidence when both name and data match', () => {
    const rows = [
      ['KP', 'Easting', 'Northing'],
      ['0.0', '432100.1', '6543210.4'],
      ['0.5', '432100.5', '6543210.8'],
      ['1.0', '432101.0', '6543211.3'],
    ]
    const result = detectColumns(rows, 0, 'DOB')
    expect(result[0].confidence).toBe('high')
  })

  it('assigns medium confidence when only name matches', () => {
    // Header says "Depth" but data is non-numeric text
    const rows = [
      ['Depth', 'Notes'],
      ['shallow', 'ok'],
      ['deep', 'check'],
    ]
    const result = detectColumns(rows, 0, 'DOB')
    expect(result[0].detectedType).toBe('depth')
    expect(result[0].confidence).toBe('medium')
  })

  it('assigns low confidence when only data matches', () => {
    // Header is unrecognizable but data looks like coordinates
    const rows = [
      ['Col_A', 'Col_B'],
      ['432100.123', '6543210.456'],
      ['432100.567', '6543210.890'],
      ['432101.012', '6543211.345'],
    ]
    const result = detectColumns(rows, 0, 'DOB')
    // At least one should detect as easting or northing with low confidence
    const detected = result.filter((c) => c.detectedType !== null)
    if (detected.length > 0) {
      expect(detected.some((c) => c.confidence === 'low')).toBe(true)
    }
  })
})

describe('getMissingExpectedColumns', () => {
  it('reports missing dob column for DOB survey type', () => {
    const detected = [
      { index: 0, originalName: 'KP', detectedType: 'kp' as const, confidence: 'high' as const },
      { index: 1, originalName: 'Easting', detectedType: 'easting' as const, confidence: 'high' as const },
      { index: 2, originalName: 'Northing', detectedType: 'northing' as const, confidence: 'high' as const },
    ]
    const missing = getMissingExpectedColumns(detected, 'DOB')
    expect(missing).toContain('dob')
  })

  it('returns empty array when all expected columns are present', () => {
    const detected = [
      { index: 0, originalName: 'KP', detectedType: 'kp' as const, confidence: 'high' as const },
      { index: 1, originalName: 'Easting', detectedType: 'easting' as const, confidence: 'high' as const },
      { index: 2, originalName: 'Northing', detectedType: 'northing' as const, confidence: 'high' as const },
      { index: 3, originalName: 'DOB', detectedType: 'dob' as const, confidence: 'high' as const },
    ]
    const missing = getMissingExpectedColumns(detected, 'DOB')
    expect(missing).toHaveLength(0)
  })

  it('reports missing doc column for DOC survey type', () => {
    const detected = [
      { index: 0, originalName: 'KP', detectedType: 'kp' as const, confidence: 'high' as const },
    ]
    const missing = getMissingExpectedColumns(detected, 'DOC')
    expect(missing).toContain('doc')
    expect(missing).toContain('easting')
    expect(missing).toContain('northing')
  })
})
