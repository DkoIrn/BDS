import type { ValidationSeverity } from '@/lib/types/validation'
import type { ClusterInput, IssueCluster } from './types'
import type { ValidationIssue as ServerValidationIssue } from '@/lib/types/validation'
import type { ValidationIssue as PipelineValidationIssue } from '@/app/(dashboard)/pipeline/lib/client-validate'

/** Weight multiplier per severity level for priority scoring */
const SEVERITY_WEIGHT: Record<ValidationSeverity, number> = {
  critical: 10,
  warning: 3,
  info: 1,
}

/** Human-readable labels for rule types */
const RULE_LABELS: Record<string, string> = {
  missing_data: 'missing data',
  duplicate_rows: 'duplicate row',
  near_duplicate_kp: 'near-duplicate KP',
  outliers_zscore: 'z-score outlier',
  outliers_iqr: 'IQR outlier',
  kp_gaps: 'KP gap',
  monotonicity: 'monotonicity violation',
  range_check: 'range violation',
  cross_column: 'cross-column mismatch',
  spike_detection: 'spike',
  coordinate_sanity: 'coordinate issue',
  event_listing: 'event mismatch',
  position_consistency: 'position inconsistency',
  kp_drift: 'KP drift',
  segment_continuity: 'segment discontinuity',
  // Pipeline-specific rule types
  missing: 'missing data',
  duplicate: 'duplicate row',
  outlier: 'outlier',
  kp_gap: 'KP gap',
  kp_monotonicity: 'monotonicity violation',
}

/**
 * Generate a human-readable label for a cluster.
 * Examples:
 *   "5 KP gaps in "DOB" between KP 10.0-50.0"
 *   "3 missing data in "DOC""
 *   "1 z-score outlier in "Depth""
 */
function generateClusterLabel(
  ruleType: string,
  columnName: string,
  count: number,
  kpRange: { min: number; max: number } | null,
): string {
  const ruleLabel = RULE_LABELS[ruleType] || ruleType
  // Pluralise: add 's' for count > 1 unless label already ends in 's' or contains 'data'
  const label = count > 1 && !ruleLabel.endsWith('s') && !ruleLabel.includes('data')
    ? `${ruleLabel}s`
    : ruleLabel
  const base = `${count} ${label} in "${columnName}"`
  if (kpRange) {
    return `${base} between KP ${kpRange.min.toFixed(1)}-${kpRange.max.toFixed(1)}`
  }
  return base
}

/**
 * Determine the highest severity in a group of issues.
 */
function maxSeverity(issues: ClusterInput[]): ValidationSeverity {
  const order: ValidationSeverity[] = ['critical', 'warning', 'info']
  for (const sev of order) {
    if (issues.some((i) => i.severity === sev)) return sev
  }
  return 'info'
}

/**
 * Group issues by rule_type + column_name, compute priority scores,
 * and return sorted clusters (highest priority first).
 */
export function clusterIssues(issues: ClusterInput[]): IssueCluster[] {
  if (issues.length === 0) return []

  // Group by composite key
  const groups = new Map<string, ClusterInput[]>()
  for (const issue of issues) {
    const key = `${issue.rule_type}::${issue.column_name}`
    const group = groups.get(key)
    if (group) {
      group.push(issue)
    } else {
      groups.set(key, [issue])
    }
  }

  const clusters: IssueCluster[] = []
  for (const [, groupIssues] of groups) {
    const first = groupIssues[0]
    const severity = maxSeverity(groupIssues)
    const count = groupIssues.length

    // Compute KP range (only if at least one issue has a kp_value)
    const kpValues = groupIssues
      .map((i) => i.kp_value)
      .filter((v): v is number => v !== null)
    const kpRange = kpValues.length > 0
      ? { min: Math.min(...kpValues), max: Math.max(...kpValues) }
      : null

    // Compute row range
    const rowNumbers = groupIssues.map((i) => i.row_number)
    const rowRange = { min: Math.min(...rowNumbers), max: Math.max(...rowNumbers) }

    const priorityScore = SEVERITY_WEIGHT[severity] * count
    const label = generateClusterLabel(first.rule_type, first.column_name, count, kpRange)

    clusters.push({
      id: `${first.rule_type}::${first.column_name}`,
      rule_type: first.rule_type,
      column_name: first.column_name,
      severity,
      count,
      label,
      kp_range: kpRange,
      row_range: rowRange,
      issues: groupIssues,
      priorityScore,
    })
  }

  // Sort by priority score descending
  clusters.sort((a, b) => b.priorityScore - a.priorityScore)
  return clusters
}

/**
 * Return the top N clusters (blockers) from a sorted cluster list.
 */
export function getTopBlockers(clusters: IssueCluster[], n = 3): IssueCluster[] {
  return clusters.slice(0, n)
}

/**
 * Adapt Supabase ValidationIssue records to ClusterInput format.
 */
export function adaptServerIssues(issues: ServerValidationIssue[]): ClusterInput[] {
  return issues.map((issue) => ({
    id: issue.id,
    rule_type: issue.rule_type,
    severity: issue.severity,
    row_number: issue.row_number,
    column_name: issue.column_name,
    message: issue.message,
    kp_value: issue.kp_value,
  }))
}

/**
 * Adapt pipeline ValidationIssue records to ClusterInput format.
 * Maps type -> rule_type, handles optional row/column fields.
 */
export function adaptPipelineIssues(issues: PipelineValidationIssue[]): ClusterInput[] {
  return issues.map((issue, index) => ({
    id: `pipeline-${index}`,
    rule_type: issue.type,
    severity: issue.severity,
    row_number: issue.row ?? 0,
    column_name: issue.column ?? 'unknown',
    message: issue.message,
    kp_value: null,
  }))
}
