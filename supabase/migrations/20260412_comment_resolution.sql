-- Migration: 20260412_comment_resolution.sql
-- Purpose: Add comment resolution columns to issue_comments
-- Phase 32 Plan 01: Collaboration core data layer

-- =============================================================================
-- 1. ADD RESOLUTION COLUMNS
-- =============================================================================

ALTER TABLE public.issue_comments
  ADD COLUMN resolved_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT NULL;

-- =============================================================================
-- 2. INDEX FOR UNRESOLVED COMMENTS
-- =============================================================================

-- Fast lookup for unresolved comments per issue
CREATE INDEX idx_issue_comments_resolved
  ON public.issue_comments(issue_id, resolved_at)
  WHERE resolved_at IS NULL;

-- =============================================================================
-- 3. RLS POLICY FOR ORG-WIDE RESOLUTION
-- =============================================================================

-- Any org member can resolve/reopen comments (not just the author)
-- This coexists with the existing "Users can update own comments" policy
CREATE POLICY "Org members can resolve comments"
  ON public.issue_comments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.validation_issues vi
      JOIN public.datasets d ON d.id = vi.dataset_id
      JOIN public.jobs j ON j.id = d.job_id
      JOIN public.projects p ON p.id = j.project_id
      WHERE vi.id = issue_comments.issue_id
      AND get_user_org_role(p.org_id) IS NOT NULL
    )
  );
