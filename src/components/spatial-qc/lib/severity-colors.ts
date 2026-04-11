import type { ValidationSeverity } from '@/lib/types/validation'

/** Marker fill and stroke colors for each severity level */
export const SEVERITY_MARKER_COLORS: Record<
  ValidationSeverity,
  { fill: string; stroke: string }
> = {
  critical: { fill: '#ef4444', stroke: '#991b1b' },
  warning: { fill: '#f59e0b', stroke: '#b45309' },
  info: { fill: '#3b82f6', stroke: '#1d4ed8' },
}

/** Heatmap intensity values for each severity level (0-1) */
export const SEVERITY_HEAT_INTENSITY: Record<ValidationSeverity, number> = {
  critical: 1.0,
  warning: 0.6,
  info: 0.3,
}

/** Get marker fill and stroke colors for a severity level */
export function getSeverityColor(severity: ValidationSeverity): {
  fill: string
  stroke: string
} {
  return SEVERITY_MARKER_COLORS[severity]
}
