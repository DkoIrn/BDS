-- Cross-dataset validation: extend validation_runs for two-dataset comparisons

-- Add secondary dataset reference (nullable for backward compatibility)
ALTER TABLE validation_runs
ADD COLUMN IF NOT EXISTS secondary_dataset_id UUID REFERENCES datasets(id);

-- Add cross-validation config snapshot
ALTER TABLE validation_runs
ADD COLUMN IF NOT EXISTS cross_validation_config JSONB;

-- Index for querying cross-validation runs by secondary dataset
CREATE INDEX IF NOT EXISTS idx_validation_runs_secondary_dataset_id
ON validation_runs(secondary_dataset_id)
WHERE secondary_dataset_id IS NOT NULL;
