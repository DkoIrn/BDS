// Type definitions for one-click data fix engine

export type FixType = "fill_missing" | "remove_duplicates" | "smooth_spikes"

export interface FixPreview {
  type: FixType
  affectedRows: {
    rowIndex: number // 1-indexed (matches ValidationIssue.row)
    column?: string
    before: string
    after: string
    explanation: string
  }[]
  totalAffected: number
}

export interface FixResult {
  /** Full dataset after fix (header + rows) */
  data: string[][]
  /** What changed */
  preview: FixPreview
  /** Data before fix (for undo) */
  undoSnapshot: string[][]
}

export interface UndoEntry {
  data: string[][]
  label: string // e.g. "Fill Missing (3 values)"
  timestamp: number
}
