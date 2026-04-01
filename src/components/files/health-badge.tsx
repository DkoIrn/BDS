"use client"

import { computeHealthScore, healthColors, type HealthScore } from "@/lib/health-score"

interface HealthBadgeProps {
  passRate: number | null
  totalIssues: number
  criticalCount: number
  compact?: boolean
}

export function HealthBadge({
  passRate,
  totalIssues,
  criticalCount,
  compact,
}: HealthBadgeProps) {
  const health = computeHealthScore({ passRate, totalIssues, criticalCount })

  // Not validated yet
  if (health.score === -1) return null

  const colors = healthColors[health.color]

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${colors.badge}`}>
        {health.score}%
      </span>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-12 rounded-full bg-muted">
        <div
          className={`h-1.5 rounded-full transition-all ${colors.fill}`}
          style={{ width: `${health.score}%` }}
        />
      </div>
      <span className={`text-[10px] font-semibold ${colors.text}`}>
        {health.score}%
      </span>
    </div>
  )
}

export function HealthScoreCard({
  passRate,
  totalIssues,
  criticalCount,
  warningCount,
  infoCount,
  totalRows,
  cleanActions,
}: {
  passRate: number | null
  totalIssues: number
  criticalCount: number
  warningCount?: number
  infoCount?: number
  totalRows?: number
  cleanActions?: number
}) {
  const health = computeHealthScore({
    passRate,
    totalIssues,
    criticalCount,
    warningCount,
  })

  if (health.score === -1) return null

  const colors = healthColors[health.color]

  return (
    <div className={`rounded-2xl border p-5 ${colors.bg}`}>
      {/* Score header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Data Health</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className={`text-3xl font-extrabold tracking-tighter ${colors.text}`}>
              {health.score}%
            </span>
            <span className={`text-sm font-semibold ${colors.text}`}>
              {health.label}
            </span>
          </div>
        </div>
        {/* Circular score indicator */}
        <div className="relative flex size-14 items-center justify-center">
          <svg className="size-14 -rotate-90" viewBox="0 0 56 56">
            <circle
              cx="28"
              cy="28"
              r="24"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              className="text-muted/50"
            />
            <circle
              cx="28"
              cy="28"
              r="24"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              strokeDasharray={`${(health.score / 100) * 150.8} 150.8`}
              strokeLinecap="round"
              className={colors.text}
            />
          </svg>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-2 w-full rounded-full bg-background/50">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${colors.fill}`}
          style={{ width: `${health.score}%` }}
        />
      </div>

      {/* Stats grid */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <StatCell
          label="Issues"
          value={totalIssues}
          sub={
            criticalCount > 0
              ? `${criticalCount} critical`
              : "None critical"
          }
          alert={criticalCount > 0}
        />
        <StatCell
          label="Pass Rate"
          value={passRate !== null ? `${Math.round(passRate > 1 ? passRate : passRate * 100)}%` : "--"}
          sub={totalRows ? `${totalRows.toLocaleString()} rows` : undefined}
        />
        <StatCell
          label="Cleaned"
          value={cleanActions ?? 0}
          sub={cleanActions && cleanActions > 0 ? "fixes applied" : "No fixes needed"}
        />
      </div>
    </div>
  )
}

function StatCell({
  label,
  value,
  sub,
  alert,
}: {
  label: string
  value: number | string
  sub?: string
  alert?: boolean
}) {
  return (
    <div className="rounded-xl bg-background/60 p-2.5">
      <p className="text-[10px] font-medium text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-lg font-bold ${alert ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>
        {value}
      </p>
      {sub && (
        <p className="text-[10px] text-muted-foreground">{sub}</p>
      )}
    </div>
  )
}
