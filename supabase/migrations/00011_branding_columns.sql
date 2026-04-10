-- Add branding columns to profiles for client-branded PDF reports
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS logo_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS brand_color TEXT DEFAULT '#14B8A6';
