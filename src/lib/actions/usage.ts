'use server'

import { createClient } from '@/lib/supabase/server'
import {
  TIER_LIMITS,
  getOrgUsage,
  getCurrentBillingPeriodStart,
  type TierLimits,
  type UsageData,
} from '@/lib/usage'
import { requireOrgRole } from '@/lib/permissions'

export interface UsageResponse {
  data?: UsageData & { plan: string; limits: TierLimits }
  error?: string
}

export async function getUsageData(): Promise<UsageResponse> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const orgResult = await requireOrgRole(supabase, user.id, 'viewer')
  if ('error' in orgResult) return { error: orgResult.error }
  const { orgId } = orgResult

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, billing_cycle_start')
    .eq('id', user.id)
    .single()

  const plan = profile?.plan ?? 'free'
  const limits = TIER_LIMITS[plan] ?? TIER_LIMITS['free']

  const billingCycleStart = profile?.billing_cycle_start
    ? getCurrentBillingPeriodStart(profile.billing_cycle_start)
    : getCurrentBillingPeriodStart(new Date().toISOString())

  const usage = await getOrgUsage(supabase, orgId, billingCycleStart)

  return {
    data: {
      ...usage,
      plan,
      limits,
    },
  }
}
