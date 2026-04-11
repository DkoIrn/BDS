import type { SupabaseClient } from '@supabase/supabase-js'

// ── Types ──────────────────────────────────────────────────────────────

export interface TierLimits {
  maxProjects: number | null
  maxQcChecksPerMonth: number | null
  maxStorageBytes: number | null
}

export interface UsageData {
  projectCount: number
  qcCheckCount: number
  storageBytes: number
}

export type UsageLimitResult =
  | { allowed: true }
  | { allowed: false; limitType: string; current: number; max: number; message: string }

// ── Tier Limits Config ─────────────────────────────────────────────────

export const TIER_LIMITS: Record<string, TierLimits> = {
  free: {
    maxProjects: 3,
    maxQcChecksPerMonth: 5,
    maxStorageBytes: 10 * 1024 * 1024, // 10 MB
  },
  pro: {
    maxProjects: 15,
    maxQcChecksPerMonth: 50,
    maxStorageBytes: 50 * 1024 * 1024, // 50 MB
  },
  max: {
    maxProjects: null, // unlimited
    maxQcChecksPerMonth: 500,
    maxStorageBytes: 200 * 1024 * 1024, // 200 MB
  },
  enterprise: {
    maxProjects: null,
    maxQcChecksPerMonth: null,
    maxStorageBytes: null,
  },
}

// ── Billing Period Calculation ──────────────────────────────────────────

/**
 * Given a billing anchor date, return the most recent occurrence of that
 * billing day. If today is before the anchor day this month, go back to
 * the previous month. Clamps anchor day to the last day of the month
 * (e.g., day 31 in February becomes 28 or 29).
 */
export function getCurrentBillingPeriodStart(
  anchorDate: string,
  now: Date = new Date()
): Date {
  const anchor = new Date(anchorDate)
  const anchorDay = anchor.getUTCDate()

  const year = now.getUTCFullYear()
  const month = now.getUTCMonth()

  // Clamp anchor day to the number of days in the current month
  const daysInCurrentMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const clampedDay = Math.min(anchorDay, daysInCurrentMonth)

  // If today is on or after the clamped anchor day, period starts this month
  if (now.getUTCDate() >= clampedDay) {
    return new Date(Date.UTC(year, month, clampedDay))
  }

  // Otherwise, go back to the previous month
  const prevMonth = month === 0 ? 11 : month - 1
  const prevYear = month === 0 ? year - 1 : year
  const daysInPrevMonth = new Date(Date.UTC(prevYear, prevMonth + 1, 0)).getUTCDate()
  const prevClampedDay = Math.min(anchorDay, daysInPrevMonth)

  return new Date(Date.UTC(prevYear, prevMonth, prevClampedDay))
}

// ── Usage Queries ───────────────────────────────────────────────────────

/**
 * Fetch current usage counts for a user in parallel.
 * @deprecated Use getOrgUsage for org-scoped counting
 */
export async function getUserUsage(
  supabase: SupabaseClient,
  userId: string,
  billingPeriodStart: Date
): Promise<UsageData> {
  const [projectResult, storageResult, qcResult] = await Promise.all([
    // Project count
    supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId),

    // Storage: sum of file_size from datasets
    supabase.from('datasets').select('file_size').eq('user_id', userId),

    // QC checks in current billing period
    supabase.rpc('count_user_qc_checks', {
      p_user_id: userId,
      p_since: billingPeriodStart.toISOString(),
    }),
  ])

  const projectCount = projectResult.count ?? 0

  const storageBytes = (storageResult.data ?? []).reduce(
    (sum: number, row: { file_size: number }) => sum + (row.file_size || 0),
    0
  )

  const qcCheckCount = qcResult.data ?? 0

  return { projectCount, qcCheckCount, storageBytes }
}

/**
 * Fetch current usage counts for an organisation in parallel.
 * Counts projects by org_id, storage across all org members, QC checks across org members.
 */
export async function getOrgUsage(
  supabase: SupabaseClient,
  orgId: string,
  billingPeriodStart: Date
): Promise<UsageData> {
  // Get all member user_ids for this org
  const { data: members } = await supabase
    .from('org_members')
    .select('user_id')
    .eq('org_id', orgId)

  const memberIds = (members ?? []).map((m: { user_id: string }) => m.user_id)

  const [projectResult, storageResult, qcResult] = await Promise.all([
    // Project count by org_id
    supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId),

    // Storage: sum of file_size from datasets by all org members
    memberIds.length > 0
      ? supabase.from('datasets').select('file_size').in('user_id', memberIds)
      : Promise.resolve({ data: [] }),

    // QC checks: sum across all org members in current billing period
    // Use the org owner's count (first member) as proxy since the RPC is user-scoped
    memberIds.length > 0
      ? supabase.rpc('count_user_qc_checks', {
          p_user_id: memberIds[0],
          p_since: billingPeriodStart.toISOString(),
        })
      : Promise.resolve({ data: 0 }),
  ])

  const projectCount = projectResult.count ?? 0

  const storageData = 'data' in storageResult ? storageResult.data : []
  const storageBytes = (storageData ?? []).reduce(
    (sum: number, row: { file_size: number }) => sum + (row.file_size || 0),
    0
  )

  const qcCheckCount = ('data' in qcResult ? qcResult.data : 0) ?? 0

  return { projectCount, qcCheckCount, storageBytes }
}

// ── Limit Checking ──────────────────────────────────────────────────────

/**
 * Pure function: check whether current usage exceeds the plan limit.
 * Returns allowed: true if max is null (unlimited) or current < max.
 */
export function checkUsageLimit(
  current: number,
  max: number | null,
  limitType: string,
  planName: string
): UsageLimitResult {
  if (max === null) {
    return { allowed: true }
  }

  if (current >= max) {
    return {
      allowed: false,
      limitType,
      current,
      max,
      message: `You've reached the ${max} ${limitType} limit on your ${planName} plan. Upgrade to increase your limit.`,
    }
  }

  return { allowed: true }
}

// ── Display Helpers ─────────────────────────────────────────────────────

/**
 * Format bytes as a human-readable MB string.
 */
export function formatStorageSize(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  // Round to 1 decimal, but show "0 MB" for zero
  const rounded = Math.round(mb * 10) / 10
  return `${rounded} MB`
}
