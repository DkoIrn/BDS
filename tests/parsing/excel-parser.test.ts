import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { parseExcel } from '@/lib/parsing/excel-parser'

function createTestWorkbook(
  data: string[][],
  sheetName = 'Sheet1',
  extraSheets?: Record<string, string[][]>
): ArrayBuffer {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(data)
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  if (extraSheets) {
    for (const [name, rows] of Object.entries(extraSheets)) {
      const extraWs = XLSX.utils.aoa_to_sheet(rows)
      XLSX.utils.book_append_sheet(wb, extraWs, name)
    }
  }
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  return buf
}

describe('parseExcel', () => {
  it('parses xlsx buffer into string[][] rows', () => {
    const data = [
      ['KP', 'Easting', 'Northing'],
      ['0.0', '500.1', '600.2'],
      ['1.0', '500.5', '600.6'],
    ]
    const buffer = createTestWorkbook(data)
    const result = parseExcel(buffer)
    // SheetJS with raw:false converts numbers to their string representation
    expect(result.rows[0]).toEqual(['KP', 'Easting', 'Northing'])
    expect(result.rows).toHaveLength(3)
    // Numeric values are stringified by SheetJS
    expect(result.rows[1][1]).toBe('500.1')
    expect(result.rows[2][1]).toBe('500.5')
  })

  it('returns sheet names and active sheet', () => {
    const data = [['A'], ['1']]
    const buffer = createTestWorkbook(data, 'Survey Data', {
      Summary: [['B'], ['2']],
    })
    const result = parseExcel(buffer)
    expect(result.sheetNames).toEqual(['Survey Data', 'Summary'])
    expect(result.activeSheet).toBe('Survey Data')
  })

  it('reads specific sheet when sheetName is provided', () => {
    const data = [['A'], ['1']]
    const buffer = createTestWorkbook(data, 'Sheet1', {
      Sheet2: [['B'], ['2']],
    })
    const result = parseExcel(buffer, 'Sheet2')
    expect(result.rows).toEqual([['B'], ['2']])
    expect(result.activeSheet).toBe('Sheet2')
  })

  it('defaults to first sheet when no sheetName given', () => {
    const data = [['KP'], ['0.0']]
    const buffer = createTestWorkbook(data, 'FirstSheet')
    const result = parseExcel(buffer)
    expect(result.activeSheet).toBe('FirstSheet')
  })

  it('returns empty cells as empty strings', () => {
    const data = [
      ['A', 'B', 'C'],
      ['1', '', '3'],
      ['', '5', ''],
    ]
    const buffer = createTestWorkbook(data)
    const result = parseExcel(buffer)
    expect(result.rows[1][1]).toBe('')
    expect(result.rows[2][0]).toBe('')
    expect(result.rows[2][2]).toBe('')
  })
})
