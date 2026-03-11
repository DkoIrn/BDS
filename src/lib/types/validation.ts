/** Severity levels for validation issues */
export type ValidationSeverity = 'critical' | 'warning' | 'info'

/** A single validation run record from the validation_runs table */
export interface ValidationRun {
  id: string
  dataset_id: string
  run_at: string
  total_issues: number
  critical_count: number
  warning_count: number
  info_count: number
  pass_rate: number | null
  completeness_score: number | null
  status: string
  created_at: string
}

/** A single validation issue record from the validation_issues table */
export interface ValidationIssue {
  id: string
  run_id: string
  dataset_id: string
  row_number: number
  column_name: string
  rule_type: string
  severity: ValidationSeverity
  message: string
  expected: string | null
  actual: string | null
  kp_value: number | null
  created_at: string
}
