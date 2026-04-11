-- Dataset versioning infrastructure for TruQC
-- Creates version snapshots after each validation run with auto-pruning at 10 versions.

CREATE TABLE public.dataset_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID REFERENCES datasets(id) ON DELETE CASCADE NOT NULL,
  version_number INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  row_count INTEGER NOT NULL,
  column_count INTEGER NOT NULL,
  file_size BIGINT NOT NULL,
  validation_run_id UUID REFERENCES validation_runs(id) ON DELETE SET NULL,
  issue_count INTEGER NOT NULL DEFAULT 0,
  severity_breakdown JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(dataset_id, version_number)
);

-- Fast lookup: versions for a dataset, newest first
CREATE INDEX idx_dataset_versions_dataset ON dataset_versions(dataset_id, version_number DESC);

-- Enable Realtime for live UI updates
ALTER PUBLICATION supabase_realtime ADD TABLE dataset_versions;

-- RLS
ALTER TABLE public.dataset_versions ENABLE ROW LEVEL SECURITY;

-- Users can read versions for datasets in their org's projects
CREATE POLICY "Users can view versions for their org datasets"
  ON public.dataset_versions FOR SELECT
  USING (
    dataset_id IN (
      SELECT d.id FROM datasets d
      JOIN jobs j ON j.id = d.job_id
      JOIN projects p ON p.id = j.project_id
      JOIN org_members om ON om.org_id = p.org_id
      WHERE om.user_id = auth.uid()
    )
  );

-- Service role has full access (worker writes versions)
CREATE POLICY "Service role has full access to dataset_versions"
  ON public.dataset_versions FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
