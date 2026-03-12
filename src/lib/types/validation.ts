/** Severity levels for validation issues */
export type ValidationSeverity = 'critical' | 'warning' | 'info'

/** Enabled checks configuration for a validation profile */
export interface EnabledChecks {
  range_check: boolean
  missing_data: boolean
  duplicate_rows: boolean
  near_duplicate_kp: boolean
  outliers_zscore: boolean
  outliers_iqr: boolean
  kp_gaps: boolean
  monotonicity: boolean
}

/** Full configuration for a validation profile -- mirrors Python ProfileConfig */
export interface ProfileConfig {
  ranges: Record<string, { min: number; max: number }>
  zscore_threshold: number
  iqr_multiplier: number
  kp_gap_max: number | null
  duplicate_kp_tolerance: number
  monotonicity_check: boolean
  enabled_checks: EnabledChecks
}

/** A system-provided default validation template (read-only) */
export interface ValidationTemplate {
  id: string
  name: string
  survey_type: string
  description: string
  config: ProfileConfig
  is_default: true
}

/** A user-saved custom validation profile */
export interface ValidationProfile {
  id: string
  user_id: string
  name: string
  survey_type: string | null
  config: ProfileConfig
  created_at: string
  updated_at: string
}

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
  config_snapshot: ProfileConfig | null
  profile_id: string | null
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
