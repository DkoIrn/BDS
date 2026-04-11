-- Job tracking infrastructure for TruQC
-- Adds progress tracking to datasets and a job history table.

-- Add progress tracking column to datasets
ALTER TABLE public.datasets
  ADD COLUMN IF NOT EXISTS validation_progress JSONB DEFAULT NULL;

-- Job history table for UI display and audit trail
CREATE TABLE public.job_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID REFERENCES datasets(id) ON DELETE CASCADE NOT NULL,
  job_type TEXT NOT NULL DEFAULT 'validation',
  procrastinate_job_id BIGINT,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  attempt_number INTEGER DEFAULT 1,
  max_attempts INTEGER DEFAULT 3,
  error_summary TEXT,
  error_detail TEXT,
  config_snapshot JSONB,
  result_summary JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for per-dataset job history (most recent first)
CREATE INDEX idx_job_runs_dataset ON job_runs(dataset_id, created_at DESC);

-- Index for finding active jobs
CREATE INDEX idx_job_runs_status ON job_runs(status)
  WHERE status IN ('queued', 'running');

-- Enable Realtime for live dashboard updates
ALTER PUBLICATION supabase_realtime ADD TABLE job_runs;

-- RLS policies for job_runs (org-scoped read access)
ALTER TABLE public.job_runs ENABLE ROW LEVEL SECURITY;

-- Users can read job_runs for datasets in their org's projects
CREATE POLICY "Users can view job_runs for their org datasets"
  ON public.job_runs FOR SELECT
  USING (
    dataset_id IN (
      SELECT d.id FROM datasets d
      JOIN jobs j ON j.id = d.job_id
      JOIN projects p ON p.id = j.project_id
      JOIN org_members om ON om.org_id = p.org_id
      WHERE om.user_id = auth.uid()
    )
  );

-- Service role has full access (worker writes job_runs)
CREATE POLICY "Service role has full access to job_runs"
  ON public.job_runs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
