/**
 * Detect the header row index in a parsed file.
 * Handles messy files with metadata preamble rows, empty rows, and key:value pairs.
 */
export function detectHeaderRow(rows: string[][]): number {
  if (rows.length === 0) return 0

  const scanLimit = Math.min(rows.length, 20)

  for (let i = 0; i < scanLimit; i++) {
    const row = rows[i]
    if (!row || row.length === 0) continue

    // Count non-empty cells
    const nonEmpty = row.filter((cell) => cell.trim() !== '')
    const totalCells = row.length

    // Skip mostly-empty rows (>70% empty)
    if (nonEmpty.length / totalCells < 0.3) continue

    // Skip single non-empty cell rows (metadata like "Company: ACME")
    if (nonEmpty.length === 1) continue

    // Skip key:value pattern rows (e.g., "Client: BigCorp,,")
    if (nonEmpty.length === 1 && nonEmpty[0].includes(':')) continue

    // Check if this looks like a header row:
    // - Most cells have text content (not pure numbers)
    // - At least 3 non-empty cells
    // - Cell count is consistent with subsequent rows
    const textCells = nonEmpty.filter((cell) => {
      const trimmed = cell.trim()
      // Not a pure number (header names are text)
      return isNaN(Number(trimmed)) || trimmed === ''
    })

    const isLikelyHeader = textCells.length >= Math.ceil(nonEmpty.length * 0.5)
      && nonEmpty.length >= 2

    if (isLikelyHeader) {
      // Verify subsequent rows exist and have similar column count
      if (i + 1 < rows.length) {
        const nextRow = rows[i + 1]
        if (nextRow && nextRow.length > 0) {
          return i
        }
      }
      return i
    }
  }

  // Default to 0 if no clear header found
  return 0
}
