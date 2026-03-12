-- Migration: 00007_validation_profiles.sql
-- Purpose: Create validation_profiles table and add config_snapshot to validation_runs

-- =============================================================================
-- validation_profiles: User-defined validation configuration profiles
-- =============================================================================
CREATE TABLE public.validation_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  survey_type TEXT,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_validation_profiles_user_id ON validation_profiles(user_id);
CREATE UNIQUE INDEX idx_validation_profiles_user_name ON validation_profiles(user_id, name);

ALTER TABLE validation_profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profiles
CREATE POLICY "Users can select own profiles"
  ON validation_profiles FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own profiles
CREATE POLICY "Users can insert own profiles"
  ON validation_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own profiles
CREATE POLICY "Users can update own profiles"
  ON validation_profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own profiles
CREATE POLICY "Users can delete own profiles"
  ON validation_profiles FOR DELETE
  USING (auth.uid() = user_id);

-- Updated_at trigger (reuses existing handle_updated_at function)
CREATE TRIGGER set_validation_profiles_updated_at
  BEFORE UPDATE ON validation_profiles
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- =============================================================================
-- Add config_snapshot and profile_id to validation_runs
-- =============================================================================
ALTER TABLE validation_runs ADD COLUMN config_snapshot JSONB;
ALTER TABLE validation_runs ADD COLUMN profile_id UUID REFERENCES validation_profiles(id) ON DELETE SET NULL;
