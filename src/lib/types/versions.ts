export interface DatasetVersion {
  id: string
  dataset_id: string
  version_number: number
  storage_path: string
  row_count: number
  column_count: number
  file_size: number
  validation_run_id: string | null
  issue_count: number
  severity_breakdown: {
    critical: number
    warning: number
    info: number
  }
  created_at: string
}

export interface DiffSummary {
  rows_before: number
  rows_after: number
  added_count: number
  removed_count: number
  modified_count: number
  columns_before: number
  columns_after: number
}

export interface DiffRow {
  row: number
  values: Record<string, string>
}

export interface ModifiedRow {
  row: number
  changes: Record<string, { old: string; new: string }>
}

export interface VersionDiff {
  summary: DiffSummary
  added: DiffRow[]
  removed: DiffRow[]
  modified: ModifiedRow[]
  pagination: {
    page: number
    page_size: number
    total_added: number
    total_removed: number
    total_modified: number
    has_more: boolean
  }
}
