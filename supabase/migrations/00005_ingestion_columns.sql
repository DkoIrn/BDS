-- Add columns for file parsing metadata to the datasets table
ALTER TABLE public.datasets
  ADD COLUMN IF NOT EXISTS parsed_metadata JSONB,
  ADD COLUMN IF NOT EXISTS column_mappings JSONB,
  ADD COLUMN IF NOT EXISTS header_row_index INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_rows INTEGER,
  ADD COLUMN IF NOT EXISTS parse_warnings TEXT[];
