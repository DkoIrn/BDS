import Papa from 'papaparse'
import type { ParsedFileData, ParseWarning } from './types'

export function parseCSV(text: string): ParsedFileData {
  const warnings: ParseWarning[] = []

  // Strip BOM if present
  let cleaned = text
  if (cleaned.charCodeAt(0) === 0xfeff) {
    cleaned = cleaned.slice(1)
    warnings.push({
      type: 'bom_removed',
      message: 'UTF-8 BOM character was removed from the beginning of the file',
    })
  }

  const result = Papa.parse<string[]>(cleaned, {
    header: false,
    skipEmptyLines: 'greedy',
    dynamicTyping: false,
  })

  const errors = result.errors.map((e) => ({
    message: e.message,
    row: e.row !== undefined ? e.row : undefined,
  }))

  return {
    rows: result.data,
    errors,
    meta: {
      delimiter: result.meta.delimiter,
      linebreak: result.meta.linebreak,
      truncated: result.meta.truncated,
    },
    warnings,
  }
}
