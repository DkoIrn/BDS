-- Migration: 20260412_notifications.sql
-- Purpose: Notifications table for in-app notification system
-- Phase 32 Plan 01: Collaboration core data layer

-- =============================================================================
-- 1. CREATE NOTIFICATIONS TABLE
-- =============================================================================

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  org_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('validation_complete', 'validation_failed', 'mention', 'comment_resolved')),
  title TEXT NOT NULL,
  body TEXT,
  read BOOLEAN DEFAULT FALSE NOT NULL,
  resource_type TEXT, -- 'dataset', 'issue', 'comment'
  resource_id UUID,
  link_url TEXT,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Deduplication constraint: one notification per user per type per resource
  CONSTRAINT uq_notifications_dedup UNIQUE (user_id, type, resource_type, resource_id)
);

-- =============================================================================
-- 2. INDEXES
-- =============================================================================

-- Fast lookup for unread notifications badge count
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, read) WHERE read = FALSE;

-- Chronological feed for notification list
CREATE INDEX idx_notifications_user_created ON public.notifications(user_id, created_at DESC);

-- =============================================================================
-- 3. ENABLE REALTIME
-- =============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- =============================================================================
-- 4. ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only read their own notifications
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only update their own notifications (mark read)
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Org members can insert notifications for other members in the same org
CREATE POLICY "Org members can create notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (
    get_user_org_role(org_id) IS NOT NULL
  );
