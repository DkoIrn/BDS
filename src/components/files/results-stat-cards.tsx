"use client"

import { CheckCircle2, XCircle, AlertTriangle, AlertCircle, Info, TrendingUp, Database } from "lucide-react"
import type { ValidationRun, ValidationSeverity } from "@/lib/types/validation"

interface ResultsStatCardsProps {
  run: ValidationRun
  onSeverityClick: (severity: ValidationSeverity | "all") => void
}

export function ResultsStatCards({ run, onSeverityClick }: ResultsStatCardsProps) {
  const isPassing = run.critical_count === 0
  const passRate = run.pass_rate ?? 0

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      {/* Verdict card - featured dark */}
      <div
        className={`relative overflow-hidden rounded-2xl p-5 ${
          isPassing
            ? "bg-emerald-600 text-white"
            : "bg-red-600 text-white"
        }`}
      >
        <div className="absolute -right-4 -top-4 size-20 rounded-full bg-white/[0.08]" />
        <div className="relative">
          <div className="flex items-center gap-2">
            {isPassing ? (
              <CheckCircle2 className="size-5" />
            ) : (
              <XCircle className="size-5" />
            )}
            <span className="text-sm font-semibold text-white/70">Verdict</span>
          </div>
          <p className="mt-2 text-3xl font-extrabold tracking-tighter">
            {isPassing ? "PASS" : "FAIL"}
          </p>
          <p className="mt-1 text-xs text-white/60">
            {run.total_issues} issue{run.total_issues !== 1 ? "s" : ""} found
          </p>
        </div>
      </div>

      {/* Severity breakdown card */}
      <div className="rounded-2xl border bg-card p-5">
        <p className="text-xs font-medium text-muted-foreground">Issues by Severity</p>
        <div className="mt-3 space-y-2">
          <SeverityRow
            icon={AlertTriangle}
            label="Critical"
            count={run.critical_count}
            color="text-red-600 bg-red-50"
            onClick={() => onSeverityClick("critical")}
          />
          <SeverityRow
            icon={AlertCircle}
            label="Warning"
            count={run.warning_count}
            color="text-amber-600 bg-amber-50"
            onClick={() => onSeverityClick("warning")}
          />
          <SeverityRow
            icon={Info}
            label="Info"
            count={run.info_count}
            color="text-blue-600 bg-blue-50"
            onClick={() => onSeverityClick("info")}
          />
        </div>
      </div>

      {/* Pass rate */}
      <div className="rounded-2xl border bg-card p-5">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-50">
            <TrendingUp className="size-3.5 text-emerald-600" />
          </div>
          <p className="text-xs font-medium text-muted-foreground">Pass Rate</p>
        </div>
        <p className="mt-3 text-3xl font-extrabold tracking-tighter text-foreground">
          {passRate.toFixed(1)}%
        </p>
        <div className="mt-2 h-1.5 w-full rounded-full bg-muted">
          <div
            className={`h-1.5 rounded-full transition-all duration-500 ${
              passRate >= 90 ? "bg-emerald-500" : passRate >= 70 ? "bg-amber-500" : "bg-red-500"
            }`}
            style={{ width: `${Math.min(passRate, 100)}%` }}
          />
        </div>
      </div>

      {/* Completeness */}
      <div className="rounded-2xl border bg-card p-5">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-blue-50">
            <Database className="size-3.5 text-blue-600" />
          </div>
          <p className="text-xs font-medium text-muted-foreground">Completeness</p>
        </div>
        <p className="mt-3 text-3xl font-extrabold tracking-tighter text-foreground">
          {run.completeness_score != null ? `${run.completeness_score.toFixed(1)}%` : "N/A"}
        </p>
        {run.completeness_score != null && (
          <div className="mt-2 h-1.5 w-full rounded-full bg-muted">
            <div
              className="h-1.5 rounded-full bg-blue-500 transition-all duration-500"
              style={{ width: `${Math.min(run.completeness_score, 100)}%` }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function SeverityRow({
  icon: Icon,
  label,
  count,
  color,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  count: number
  color: string
  onClick: () => void
}) {
  const [bg, text] = color.split(" ")
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-muted/60"
    >
      <div className={`flex size-6 items-center justify-center rounded-lg ${bg}`}>
        <Icon className={`size-3 ${text}`} />
      </div>
      <span className="flex-1 text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-sm font-bold tabular-nums text-foreground">{count}</span>
    </button>
  )
}
