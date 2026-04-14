-- Phase 31: QC Validation Certificates
-- Stores certificate records for tamper-evident QC validation proofs.

CREATE TABLE public.certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES validation_runs(id) ON DELETE CASCADE NOT NULL,
  dataset_id UUID REFERENCES datasets(id) ON DELETE CASCADE NOT NULL,
  org_id UUID REFERENCES organisations(id) ON DELETE CASCADE NOT NULL,
  generated_by UUID REFERENCES auth.users(id) NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  dataset_name TEXT NOT NULL,
  validation_date TIMESTAMPTZ NOT NULL,
  rules_applied JSONB NOT NULL,
  verdict TEXT NOT NULL,
  pass_rate REAL NOT NULL,
  total_issues INTEGER NOT NULL DEFAULT 0,
  critical_count INTEGER NOT NULL DEFAULT 0,
  warning_count INTEGER NOT NULL DEFAULT 0,
  info_count INTEGER NOT NULL DEFAULT 0,
  hmac_hash TEXT NOT NULL,
  -- Phase 33 extensions
  status TEXT NOT NULL DEFAULT 'active',
  verification_url TEXT,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES auth.users(id),
  revocation_reason TEXT,
  UNIQUE(run_id)
);

ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view certificates for their org"
  ON public.certificates FOR SELECT
  USING (org_id IN (SELECT om.org_id FROM org_members om WHERE om.user_id = auth.uid()));

CREATE POLICY "Service role full access to certificates"
  ON public.certificates FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX idx_certificates_run_id ON public.certificates(run_id);
CREATE INDEX idx_certificates_org_id ON public.certificates(org_id);
