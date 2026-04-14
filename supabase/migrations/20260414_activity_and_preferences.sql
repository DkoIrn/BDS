-- Phase 34: Notification Preferences + Activity Events
-- Migration: 20260414_activity_and_preferences.sql

-- ============================================================
-- notification_preferences: per-user toggle for in-app + email
-- ============================================================

CREATE TABLE public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  preferences JSONB NOT NULL DEFAULT '{
    "validation_complete": {"in_app": true, "email": true},
    "validation_failed": {"in_app": true, "email": true},
    "mention": {"in_app": true, "email": true},
    "comment_resolved": {"in_app": true, "email": true}
  }'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences"
  ON public.notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON public.notification_preferences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON public.notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- activity_events: project-scoped chronological feed
-- ============================================================

CREATE TABLE public.activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  org_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE NOT NULL,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'validation_run', 'validation_failed', 'cleaning_applied',
    'comment_added', 'comment_resolved', 'report_exported',
    'certificate_generated', 'dataset_uploaded'
  )),
  summary TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_events_project
  ON public.activity_events(project_id, created_at DESC);

ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view project activity"
  ON public.activity_events FOR SELECT
  USING (get_user_org_role(org_id) IS NOT NULL);

CREATE POLICY "Org members can insert activity"
  ON public.activity_events FOR INSERT
  WITH CHECK (get_user_org_role(org_id) IS NOT NULL);

-- Enable Realtime for live feed updates
ALTER PUBLICATION supabase_realtime ADD TABLE activity_events;
