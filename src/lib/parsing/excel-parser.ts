import * as XLSX from 'xlsx'
import type { ExcelParseResult } from './types'

export function parseExcel(
  buffer: ArrayBuffer,
  sheetName?: string
): ExcelParseResult {
  const workbook = XLSX.read(buffer, { type: 'array' })

  const sheetNames = workbook.SheetNames
  const activeSheet = sheetName && sheetNames.includes(sheetName)
    ? sheetName
    : sheetNames[0]

  const worksheet = workbook.Sheets[activeSheet]

  // Get rows as array of arrays, with all values as strings
  const rawRows: (string | number | boolean | null | undefined)[][] =
    XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      raw: false,
      defval: '',
    })

  // Ensure all values are strings
  const rows: string[][] = rawRows.map((row) =>
    row.map((cell) => (cell == null ? '' : String(cell)))
  )

  return {
    rows,
    sheetNames,
    activeSheet,
  }
}
