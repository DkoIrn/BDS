import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parseCSV } from '@/lib/parsing/csv-parser'

const fixturesDir = join(__dirname, '..', 'fixtures')

describe('parseCSV', () => {
  it('parses normal CSV into string[][] rows', () => {
    const csv = 'KP,Easting,Northing\n0.0,500.1,600.2\n1.0,500.5,600.6'
    const result = parseCSV(csv)
    expect(result.rows).toEqual([
      ['KP', 'Easting', 'Northing'],
      ['0.0', '500.1', '600.2'],
      ['1.0', '500.5', '600.6'],
    ])
    expect(result.errors).toHaveLength(0)
  })

  it('strips BOM prefix and parses correctly', () => {
    const csv = '\ufeffKP,Easting,Northing\n0.0,500.1,600.2'
    const result = parseCSV(csv)
    expect(result.rows[0][0]).toBe('KP')
    expect(result.warnings.some((w) => w.type === 'bom_removed')).toBe(true)
  })

  it('parses fixture file with BOM', () => {
    const content = readFileSync(join(fixturesDir, 'sample-bom.csv'), 'utf-8')
    const result = parseCSV(content)
    expect(result.rows[0][0]).toBe('KP')
    expect(result.warnings.some((w) => w.type === 'bom_removed')).toBe(true)
    expect(result.rows).toHaveLength(6) // header + 5 data rows
  })

  it('skips empty lines between data rows', () => {
    const csv = 'KP,Easting\n0.0,500.1\n\n\n1.0,500.5'
    const result = parseCSV(csv)
    expect(result.rows).toHaveLength(3) // header + 2 data rows, empties skipped
  })

  it('returns meta with detected delimiter', () => {
    const csv = 'KP,Easting,Northing\n0.0,500.1,600.2'
    const result = parseCSV(csv)
    expect(result.meta.delimiter).toBe(',')
  })

  it('detects tab delimiter', () => {
    const csv = 'KP\tEasting\tNorthing\n0.0\t500.1\t600.2'
    const result = parseCSV(csv)
    expect(result.meta.delimiter).toBe('\t')
    expect(result.rows[0]).toEqual(['KP', 'Easting', 'Northing'])
  })

  it('detects semicolon delimiter', () => {
    const csv = 'KP;Easting;Northing\n0.0;500.1;600.2'
    const result = parseCSV(csv)
    expect(result.meta.delimiter).toBe(';')
  })

  it('handles rows with mismatched column counts gracefully', () => {
    // PapaParse with header:false doesn't error on mismatched columns,
    // but it does parse them into different-length arrays
    const csv = 'A,B,C\n1,2\n3,4,5'
    const result = parseCSV(csv)
    expect(result.rows).toHaveLength(3)
    expect(result.rows[1]).toHaveLength(2) // short row
    expect(result.rows[2]).toHaveLength(3) // full row
  })

  it('parses sample fixture file', () => {
    const content = readFileSync(join(fixturesDir, 'sample.csv'), 'utf-8')
    const result = parseCSV(content)
    expect(result.rows).toHaveLength(6) // header + 5 data rows
    expect(result.rows[0]).toEqual(['KP', 'Easting', 'Northing', 'Depth'])
    expect(result.rows[1][0]).toBe('0.000')
  })
})
