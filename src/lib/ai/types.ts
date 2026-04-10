import type { ValidationSeverity } from '@/lib/types/validation'

/** Normalised input for the clustering engine */
export interface ClusterInput {
  id: string
  rule_type: string
  severity: ValidationSeverity
  row_number: number
  column_name: string
  message: string
  kp_value: number | null
}

/** A cluster of related validation issues */
export interface IssueCluster {
  id: string
  rule_type: string
  column_name: string
  severity: ValidationSeverity
  count: number
  label: string
  kp_range: { min: number; max: number } | null
  row_range: { min: number; max: number }
  issues: ClusterInput[]
  priorityScore: number
}

/** Response shape from the AI summary endpoint */
export interface AISummaryResponse {
  summary: string
  topBlockers: string[]
  recommendation: 'accept' | 'reject'
  confidence: number
  reasoning: string
}
