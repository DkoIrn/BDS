-- Usage tracking: billing cycle start and QC check counting
-- Phase 21: Usage Tracking & Tier Enforcement

-- Add billing_cycle_start to profiles for per-user billing period tracking
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS billing_cycle_start TIMESTAMPTZ DEFAULT NOW();

-- RPC function to count completed QC checks for a user since a given date.
-- Used by tier enforcement to check monthly QC check limits.
CREATE OR REPLACE FUNCTION count_user_qc_checks(p_user_id UUID, p_since TIMESTAMPTZ)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM validation_runs vr
  JOIN datasets d ON d.id = vr.dataset_id
  WHERE d.user_id = p_user_id
    AND vr.created_at >= p_since
    AND vr.status = 'completed';
$$ LANGUAGE sql STABLE SECURITY DEFINER;
