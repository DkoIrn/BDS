export type CertificateStatus = 'active' | 'revoked'

export interface Certificate {
  id: string
  dataset_name: string
  validation_date: string
  rules_applied: string[]
  total_issues: number
  pass_rate: number
  hmac_hash: string
  org_name: string
  status: CertificateStatus
  issued_by: string
  created_at: string
  revoked_at?: string
  revoked_by?: string
  revocation_reason?: string
}

export interface VerifyResponse {
  status: 'active' | 'revoked' | 'not_found'
  id?: string
  dataset_name?: string
  validation_date?: string
  rules_applied?: string[]
  total_issues?: number
  pass_rate?: number
  hmac_hash?: string
  org_name?: string
  revoked_at?: string
  revocation_reason?: string
}
