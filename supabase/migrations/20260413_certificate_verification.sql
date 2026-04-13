-- Phase 33: Certificate Verification & Revocation
-- Adds revocation support columns and RLS policies for certificate management.
-- Uses ALTER TABLE ADD COLUMN IF NOT EXISTS to be resilient to execution order.

-- ── Revocation columns ──────────────────────────────────────────────
-- status: 'active' (default) or 'revoked'
ALTER TABLE public.certificates
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'revoked'));

ALTER TABLE public.certificates
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

ALTER TABLE public.certificates
  ADD COLUMN IF NOT EXISTS revoked_by UUID REFERENCES auth.users(id);

ALTER TABLE public.certificates
  ADD COLUMN IF NOT EXISTS revocation_reason TEXT;

-- ── Indexes ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_certificates_id_status
  ON public.certificates(id, status);

-- ── RLS policies ────────────────────────────────────────────────────
-- Org members can view certificates in their org
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'certificates'
      AND policyname = 'Org members can view certificates'
  ) THEN
    CREATE POLICY "Org members can view certificates"
      ON public.certificates FOR SELECT
      USING (get_user_org_role(org_id) IS NOT NULL);
  END IF;
END $$;

-- Admins can update certificates (for revocation)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'certificates'
      AND policyname = 'Admins can update certificates'
  ) THEN
    CREATE POLICY "Admins can update certificates"
      ON public.certificates FOR UPDATE
      USING (get_user_org_role(org_id) = 'admin')
      WITH CHECK (get_user_org_role(org_id) = 'admin');
  END IF;
END $$;
