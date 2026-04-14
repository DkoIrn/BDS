export interface Certificate {
  id: string
  run_id: string
  dataset_id: string
  org_id: string
  generated_by: string
  generated_at: string
  dataset_name: string
  validation_date: string
  rules_applied: Record<string, unknown>[]
  verdict: "PASS" | "FAIL"
  pass_rate: number
  total_issues: number
  critical_count: number
  warning_count: number
  info_count: number
  hmac_hash: string
  verification_url: string | null
  revoked_at: string | null
  revoked_reason: string | null
}
