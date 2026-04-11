# Phase 21: Usage Tracking & Tier Enforcement - Research

**Researched:** 2026-04-10
**Domain:** Usage metering, subscription enforcement, Supabase RPC/queries
**Confidence:** HIGH

## Summary

Phase 21 adds usage tracking and tier enforcement to TruQC. The platform already has Stripe integration (checkout, webhooks, plan field on profiles), pricing tiers defined in `src/lib/pricing-tiers.ts`, and the settings page showing current plan with upgrade buttons. What's missing is: (1) counting usage metrics (projects, QC checks, storage), (2) enforcing limits at action boundaries, and (3) displaying usage progress to users.

The approach is straightforward: add a `usage_tracking` table (or columns on profiles) to store counters, create a shared `checkUsageLimit` utility, and inject enforcement checks into the 3 critical paths (project creation, QC validation trigger, file upload). The monthly reset for QC checks uses a `billing_cycle_start` date on the profile to determine the current period window. No new libraries are needed -- this is pure Supabase queries + Next.js logic.

**Primary recommendation:** Use a centralized `src/lib/usage.ts` module that fetches live counts from existing tables (projects, validation_runs, datasets) rather than maintaining separate counters -- simpler, always accurate, no sync issues.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | ^2.99.0 | DB queries for usage counts | Already in project |
| Next.js | 16.1.6 | Server actions for enforcement | Already in project |
| Stripe | ^22.0.1 | Subscription period data | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | ^0.577.0 | Icons for usage UI | Progress bars, limit warnings |
| sonner | ^2.0.7 | Toast notifications for limit hits | Already used throughout |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Live count queries | Separate counters table | Counters can drift; live queries always accurate for this scale |
| DB-level enforcement (triggers) | App-level enforcement | App-level is simpler, gives better UX with custom messages |
| Stripe Usage Records API | Local tracking | Overkill -- Stripe usage records are for metered billing, not limit enforcement |

## Architecture Patterns

### Recommended Project Structure
```
src/
  lib/
    usage.ts              # Tier limits config + getUsage() + checkLimit()
  lib/actions/
    projects.ts           # Add enforcement before insert
    files.ts              # Add enforcement before upload
  app/api/
    validate/route.ts     # Add enforcement before proxying to FastAPI
  components/
    usage/
      usage-progress.tsx  # Progress bar component for each metric
      limit-reached.tsx   # Modal/banner when limit hit
supabase/
  migrations/
    00010_usage_tracking.sql  # billing_cycle_start on profiles
```

### Pattern 1: Live Count Queries (not separate counters)
**What:** Query existing tables to compute usage rather than maintaining a separate counters table.
**When to use:** When data volume is small (< thousands of rows per user) and queries are fast.
**Example:**
```typescript
// src/lib/usage.ts
export async function getUserUsage(supabase: SupabaseClient, userId: string) {
  const [projects, qcChecks, storage] = await Promise.all([
    // Count projects
    supabase.from('projects').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    // Count QC runs this billing period
    supabase.from('validation_runs')
      .select('id', { count: 'exact', head: true })
      .in('dataset_id',
        supabase.from('datasets').select('id').eq('user_id', userId)
      )
      .gte('created_at', billingPeriodStart),
    // Sum file sizes
    supabase.from('datasets').select('file_size').eq('user_id', userId),
  ])
  return { projectCount, qcCheckCount, storageBytes }
}
```

### Pattern 2: Enforcement at Action Boundary
**What:** Check limits before performing the action, return descriptive error if exceeded.
**When to use:** Every gated action (create project, run QC, upload file).
**Example:**
```typescript
// In createProject server action
const usage = await getUserUsage(supabase, user.id)
const limits = getTierLimits(profile.plan)
if (limits.maxProjects !== null && usage.projectCount >= limits.maxProjects) {
  return { error: 'limit_reached', limitType: 'projects', current: usage.projectCount, max: limits.maxProjects }
}
```

### Pattern 3: Billing Cycle Date for Monthly Resets
**What:** Store a `billing_cycle_start` date on the profile. QC check counts are filtered to `>= billing_cycle_start` of the current period.
**When to use:** For the monthly QC check limit.
**Example:**
```typescript
function getCurrentBillingPeriodStart(billingCycleStart: string): Date {
  const anchor = new Date(billingCycleStart)
  const now = new Date()
  const day = anchor.getDate()
  // Find the most recent occurrence of billing day
  const candidate = new Date(now.getFullYear(), now.getMonth(), day)
  if (candidate > now) {
    candidate.setMonth(candidate.getMonth() - 1)
  }
  return candidate
}
```

### Anti-Patterns to Avoid
- **Separate counters table with increment/decrement:** Counters can drift if a delete happens without decrementing. Live queries from source tables are always accurate.
- **Client-side-only enforcement:** Must enforce server-side. Client-side is UX sugar only.
- **Blocking webhook for billing cycle:** Use the Stripe subscription `current_period_start` from webhook events when available, but default to profile creation date for free users.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Billing period calculation | Custom date math | Stripe `subscription.current_period_start` from webhook | Stripe is the source of truth for paid plans |
| Storage size tracking | Manual sum on every upload | Supabase `SELECT SUM(file_size)` query | Always accurate, includes deleted file adjustments |
| Rate limiting | Custom token bucket | Simple count query per billing period | Not high-throughput; simple count is sufficient |

**Key insight:** At TruQC's scale (small survey companies, < 500 checks/month max), live queries are fast enough and eliminate the entire class of counter-sync bugs.

## Common Pitfalls

### Pitfall 1: Race Condition on Limit Check
**What goes wrong:** Two simultaneous requests both pass the limit check, both execute, exceeding the limit by 1.
**Why it happens:** Check-then-act without a lock.
**How to avoid:** Acceptable for this use case -- off-by-one is not critical. The next request will be blocked. If strict enforcement is needed later, use a Postgres advisory lock or transaction.
**Warning signs:** N/A at current scale.

### Pitfall 2: Counting QC Checks Incorrectly
**What goes wrong:** Counting validation_runs rows instead of successful completions, or counting per-dataset instead of per-user.
**Why it happens:** validation_runs are per dataset, but the limit is per user per month.
**How to avoid:** Join through datasets to get user_id, filter by billing period, count only completed runs (status = 'completed').
**Warning signs:** Count seems too high or too low compared to user activity.

### Pitfall 3: Storage Calculation Missing Deleted Files
**What goes wrong:** Tracking total uploaded bytes but not subtracting deleted files.
**Why it happens:** Using a counter instead of live SUM query.
**How to avoid:** Use `SELECT SUM(file_size) FROM datasets WHERE user_id = $1` -- automatically reflects deletions.

### Pitfall 4: Free Trial Users Have No Stripe Subscription
**What goes wrong:** Trying to get billing period from Stripe for free users who never subscribed.
**Why it happens:** Free trial users have no `stripe_subscription_id`.
**How to avoid:** For free users, use `profiles.created_at` as the billing anchor date. Only use Stripe period data for paid subscribers.

### Pitfall 5: Billing Cycle Day Edge Case (31st)
**What goes wrong:** User subscribes on Jan 31, February has no 31st.
**Why it happens:** Naive date math.
**How to avoid:** Use `Math.min(anchorDay, daysInMonth)` to clamp to valid dates. Stripe handles this automatically for paid plans.

## Code Examples

### Tier Limits Configuration
```typescript
// src/lib/usage.ts
export interface TierLimits {
  maxProjects: number | null    // null = unlimited
  maxQcChecksPerMonth: number | null
  maxStorageBytes: number | null
}

export const TIER_LIMITS: Record<string, TierLimits> = {
  free: { maxProjects: 3, maxQcChecksPerMonth: 5, maxStorageBytes: 10 * 1024 * 1024 },
  pro: { maxProjects: 15, maxQcChecksPerMonth: 50, maxStorageBytes: 50 * 1024 * 1024 },
  max: { maxProjects: null, maxQcChecksPerMonth: 500, maxStorageBytes: 200 * 1024 * 1024 },
  enterprise: { maxProjects: null, maxQcChecksPerMonth: null, maxStorageBytes: null },
}
```

### Usage Query Function
```typescript
export async function getUserUsage(supabase: SupabaseClient, userId: string, plan: string) {
  const periodStart = await getBillingPeriodStart(supabase, userId, plan)

  const [projectsRes, storageRes, checksRes] = await Promise.all([
    supabase.from('projects').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('datasets').select('file_size').eq('user_id', userId),
    supabase.rpc('count_user_qc_checks', { p_user_id: userId, p_since: periodStart.toISOString() }),
  ])

  return {
    projectCount: projectsRes.count ?? 0,
    storageBytes: (storageRes.data ?? []).reduce((sum, d) => sum + (d.file_size || 0), 0),
    qcCheckCount: checksRes.data ?? 0,
  }
}
```

### Supabase RPC for QC Check Count
```sql
-- Counts validation runs for a user since a given date
CREATE OR REPLACE FUNCTION count_user_qc_checks(p_user_id UUID, p_since TIMESTAMPTZ)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM validation_runs vr
  JOIN datasets d ON d.id = vr.dataset_id
  WHERE d.user_id = p_user_id
    AND vr.created_at >= p_since
    AND vr.status = 'completed';
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

### Enforcement in Server Action
```typescript
// In createProject (src/lib/actions/projects.ts)
const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).single()
const limits = TIER_LIMITS[profile?.plan ?? 'free']
if (limits.maxProjects !== null) {
  const { count } = await supabase.from('projects').select('*', { count: 'exact', head: true }).eq('user_id', user.id)
  if ((count ?? 0) >= limits.maxProjects) {
    return { error: `You've reached the ${limits.maxProjects} project limit on your ${profile?.plan} plan. Upgrade to create more projects.` }
  }
}
```

### Usage Progress Bar Component
```typescript
// src/components/usage/usage-progress.tsx
interface UsageBarProps {
  label: string
  current: number
  max: number | null
  unit: string
  icon: React.ReactNode
}

function UsageBar({ label, current, max, unit, icon }: UsageBarProps) {
  if (max === null) return <div>{label}: Unlimited</div>
  const pct = Math.min((current / max) * 100, 100)
  const isNearLimit = pct >= 80
  const isAtLimit = pct >= 100
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span>{icon} {label}</span>
        <span>{current} / {max} {unit}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isAtLimit ? 'bg-red-500' : isNearLimit ? 'bg-amber-500' : 'bg-teal-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate usage_metrics table | Live queries from source tables | Common pattern | No sync bugs, simpler schema |
| Client-side enforcement only | Server-side enforcement with client UX | Always | Prevents circumvention |
| Cron-based monthly reset | Billing period window query | Always | No cron needed, always accurate |

**Deprecated/outdated:**
- Maintaining counter columns (increment/decrement pattern) is fragile for this use case -- prefer live queries.

## Open Questions

1. **Pipeline workflow QC checks -- do they count toward the limit?**
   - What we know: Pipeline has client-side validation (`client-validate.ts`) that runs in-browser without hitting the backend.
   - What's unclear: Should client-side pipeline validation count as a "QC check"?
   - Recommendation: Only count server-side validation runs (POST `/api/validate`) toward the limit. Client-side pipeline validation is free -- it's a preview, not a billable action.

2. **Billing cycle anchor for existing free users**
   - What we know: Existing users have `profiles.created_at` but no `billing_cycle_start` column.
   - What's unclear: Should we add a column or derive from `created_at`?
   - Recommendation: Add `billing_cycle_start` column defaulting to `created_at`. Stripe webhook updates it to `subscription.current_period_start` on plan changes.

3. **Soft vs hard limits**
   - What we know: Requirements say "blocked" for Free Trial users.
   - What's unclear: Should Pro/Max users get a grace period or hard block?
   - Recommendation: Hard block for all tiers with clear upgrade prompt. Consistent behavior, simpler implementation.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (frontend) + pytest (backend) |
| Config file | `vitest.config.ts` (frontend), `backend/pytest.ini` or default (backend) |
| Quick run command | `npx vitest run tests/usage` |
| Full suite command | `npx vitest run && cd backend && python -m pytest` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SUBS-03 | Tier limits enforced (projects, QC checks, storage) | unit | `npx vitest run tests/usage/usage-limits.test.ts -t "enforces tier limits"` | No - Wave 0 |
| SUBS-04 | Payment processing via Stripe (already done) | integration | Manual - Stripe test mode checkout | Existing |
| SUBS-05 | API access for Enterprise (deferred -- out of phase scope) | N/A | N/A | N/A |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/usage`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/usage/usage-limits.test.ts` -- covers SUBS-03 (tier limit config, enforcement logic)
- [ ] `tests/usage/billing-cycle.test.ts` -- covers billing period calculation edge cases

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `src/lib/pricing-tiers.ts`, `src/lib/stripe.ts`, `src/app/api/stripe/webhook/route.ts`, `src/app/api/stripe/checkout/route.ts`
- Codebase inspection: `supabase/migrations/00009_stripe_billing.sql`, `00001_profiles.sql`, `00006_validation_tables.sql`, `00003_datasets.sql`
- Codebase inspection: `src/lib/actions/projects.ts`, `src/lib/actions/files.ts`, `src/app/api/validate/route.ts`
- Supabase JS v2 documentation: `select('*', { count: 'exact', head: true })` for count-only queries

### Secondary (MEDIUM confidence)
- Stripe subscription lifecycle: `current_period_start` available on subscription objects via webhook events

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new libraries needed, all patterns verified in codebase
- Architecture: HIGH - live query pattern is proven, enforcement points clearly identified
- Pitfalls: HIGH - common patterns, well-understood edge cases

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stable domain, no fast-moving dependencies)
