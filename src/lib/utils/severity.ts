import { AlertTriangle, AlertCircle, Info } from 'lucide-react'
import type { ValidationSeverity, ValidationRun } from '@/lib/types/validation'

const severityColors: Record<ValidationSeverity, { badge: string; text: string; bg: string; border: string }> = {
  critical: {
    badge: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    text: 'text-red-700 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-500',
  },
  warning: {
    badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    text: 'text-yellow-700 dark:text-yellow-400',
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    border: 'border-yellow-500',
  },
  info: {
    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    text: 'text-blue-700 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-500',
  },
}

const severityIcons: Record<ValidationSeverity, typeof AlertTriangle> = {
  critical: AlertTriangle,
  warning: AlertCircle,
  info: Info,
}

export function getSeverityColor(severity: ValidationSeverity) {
  return severityColors[severity]
}

export function getSeverityIcon(severity: ValidationSeverity) {
  return severityIcons[severity]
}

export function getPassRateColor(rate: number): string {
  if (rate >= 90) return 'border-green-500'
  if (rate >= 70) return 'border-yellow-500'
  return 'border-red-500'
}

export function getVerdict(criticalCount: number): 'PASS' | 'FAIL' {
  return criticalCount > 0 ? 'FAIL' : 'PASS'
}

export function formatRunDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function getRunProfileName(run: ValidationRun): string {
  if (run.profile_id) return 'Custom profile'
  if (!run.config_snapshot) return 'Default'
  return 'Custom profile'
}
