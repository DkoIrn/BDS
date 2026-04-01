// Data health score computation
// Combines pass rate, issue severity, and completeness into a 0-100 score

export interface HealthScore {
  score: number
  label: "Excellent" | "Good" | "Fair" | "Poor" | "Critical"
  color: "green" | "emerald" | "amber" | "orange" | "red"
}

/**
 * Compute a health score from validation run data.
 * Returns 0-100 score with label and color.
 */
export function computeHealthScore(data: {
  passRate: number | null
  totalIssues: number
  criticalCount: number
  warningCount?: number
  totalRows?: number
}): HealthScore {
  // If no validation has been run, return neutral
  if (data.passRate === null) {
    return { score: -1, label: "Good", color: "green" }
  }

  // Base score from pass rate (0-100)
  let score = Math.round((data.passRate ?? 1) * 100)

  // Penalize critical issues heavily
  if (data.criticalCount > 0) {
    score = Math.max(0, score - data.criticalCount * 10)
  }

  // Penalize warnings lightly
  if (data.warningCount && data.warningCount > 0) {
    score = Math.max(0, score - data.warningCount * 2)
  }

  // Clamp
  score = Math.max(0, Math.min(100, score))

  return {
    score,
    ...getScoreLabel(score),
  }
}

function getScoreLabel(score: number): { label: HealthScore["label"]; color: HealthScore["color"] } {
  if (score >= 95) return { label: "Excellent", color: "green" }
  if (score >= 80) return { label: "Good", color: "emerald" }
  if (score >= 60) return { label: "Fair", color: "amber" }
  if (score >= 40) return { label: "Poor", color: "orange" }
  return { label: "Critical", color: "red" }
}

/** CSS classes for each health color */
export const healthColors: Record<HealthScore["color"], {
  bg: string
  text: string
  fill: string
  badge: string
}> = {
  green: {
    bg: "bg-green-50 dark:bg-green-950/30",
    text: "text-green-700 dark:text-green-300",
    fill: "bg-green-500",
    badge: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
  },
  emerald: {
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    text: "text-emerald-700 dark:text-emerald-300",
    fill: "bg-emerald-500",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  },
  amber: {
    bg: "bg-amber-50 dark:bg-amber-950/30",
    text: "text-amber-700 dark:text-amber-300",
    fill: "bg-amber-500",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  },
  orange: {
    bg: "bg-orange-50 dark:bg-orange-950/30",
    text: "text-orange-700 dark:text-orange-300",
    fill: "bg-orange-500",
    badge: "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300",
  },
  red: {
    bg: "bg-red-50 dark:bg-red-950/30",
    text: "text-red-700 dark:text-red-300",
    fill: "bg-red-500",
    badge: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
  },
}
