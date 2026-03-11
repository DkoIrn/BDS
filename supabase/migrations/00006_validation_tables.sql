-- Migration: 00006_validation_tables.sql
-- Purpose: Create validation_runs and validation_issues tables for storing QC results

-- =============================================================================
-- validation_runs: One row per validation execution on a dataset
-- =============================================================================
CREATE TABLE validation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID REFERENCES datasets(id) ON DELETE CASCADE NOT NULL,
  run_at TIMESTAMPTZ DEFAULT NOW(),
  total_issues INTEGER NOT NULL DEFAULT 0,
  critical_count INTEGER NOT NULL DEFAULT 0,
  warning_count INTEGER NOT NULL DEFAULT 0,
  info_count INTEGER NOT NULL DEFAULT 0,
  pass_rate REAL,
  completeness_score REAL,
  status TEXT NOT NULL DEFAULT 'running',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_validation_runs_dataset_id ON validation_runs(dataset_id);

ALTER TABLE validation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view validation runs for their own datasets"
  ON validation_runs FOR SELECT
  USING (
    dataset_id IN (
      SELECT id FROM datasets WHERE user_id = auth.uid()
    )
  );

-- =============================================================================
-- validation_issues: Individual issues found during validation
-- =============================================================================
CREATE TABLE validation_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES validation_runs(id) ON DELETE CASCADE NOT NULL,
  dataset_id UUID REFERENCES datasets(id) ON DELETE CASCADE NOT NULL,
  row_number INTEGER NOT NULL,
  column_name TEXT NOT NULL,
  rule_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  message TEXT NOT NULL,
  expected TEXT,
  actual TEXT,
  kp_value REAL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_validation_issues_run_id ON validation_issues(run_id);
CREATE INDEX idx_validation_issues_dataset_id ON validation_issues(dataset_id);
CREATE INDEX idx_validation_issues_severity ON validation_issues(severity);

ALTER TABLE validation_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view validation issues for their own datasets"
  ON validation_issues FOR SELECT
  USING (
    dataset_id IN (
      SELECT id FROM datasets WHERE user_id = auth.uid()
    )
  );
