-- Migration: 00012_organisations.sql
-- Purpose: Multi-tenant foundation -- org tables, RLS rewrite, backfill existing users
-- Phase 25 Plan 01: Database migration for multi-user & roles

-- =============================================================================
-- 1. CREATE NEW TABLES
-- =============================================================================

-- Organisations table
CREATE TABLE public.organisations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Org members join table
CREATE TABLE public.org_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'reviewer', 'viewer')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

-- Org invites table
CREATE TABLE public.org_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'reviewer', 'viewer')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE(org_id, email)
);

-- Issue comments table
CREATE TABLE public.issue_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID REFERENCES public.validation_issues(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 2. ALTER EXISTING TABLES
-- =============================================================================

-- Add org_id to projects (will be set NOT NULL after backfill)
ALTER TABLE public.projects ADD COLUMN org_id UUID REFERENCES public.organisations(id);

-- Add approval_status to datasets
ALTER TABLE public.datasets ADD COLUMN approval_status TEXT DEFAULT 'draft'
  CHECK (approval_status IN ('draft', 'reviewed', 'approved', 'issued'));

-- Add default_org_id to profiles
ALTER TABLE public.profiles ADD COLUMN default_org_id UUID REFERENCES public.organisations(id);

-- Add org_id to validation_profiles
ALTER TABLE public.validation_profiles ADD COLUMN org_id UUID REFERENCES public.organisations(id);

-- =============================================================================
-- 3. SECURITY DEFINER HELPER FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_user_org_role(check_org_id UUID)
RETURNS TEXT AS $$
  SELECT role FROM public.org_members
  WHERE org_id = check_org_id AND user_id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- =============================================================================
-- 4. BACKFILL EXISTING USERS
-- =============================================================================

-- Create personal org for each existing user (using profile.id as org.id for easy mapping)
INSERT INTO public.organisations (id, name, owner_id)
SELECT id, COALESCE(full_name, email, 'User') || '''s Organisation', id
FROM public.profiles;

-- Create admin membership for each user in their personal org
INSERT INTO public.org_members (org_id, user_id, role)
SELECT id, id, 'admin'
FROM public.profiles;

-- Set default org on profiles
UPDATE public.profiles SET default_org_id = id;

-- Backfill org_id on existing projects (user_id maps to their personal org id)
UPDATE public.projects SET org_id = user_id;

-- Backfill org_id on existing validation_profiles
UPDATE public.validation_profiles SET org_id = (
  SELECT default_org_id FROM public.profiles WHERE profiles.id = validation_profiles.user_id
);

-- Now enforce NOT NULL on projects.org_id
ALTER TABLE public.projects ALTER COLUMN org_id SET NOT NULL;

-- =============================================================================
-- 5. ENABLE RLS ON NEW TABLES
-- =============================================================================

ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_comments ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 6. RLS POLICIES ON NEW TABLES
-- =============================================================================

-- Organisations: members can view, admin can update
CREATE POLICY "Org members can view organisation"
  ON public.organisations FOR SELECT
  USING (get_user_org_role(id) IS NOT NULL);

CREATE POLICY "Admins can update organisation"
  ON public.organisations FOR UPDATE
  USING (get_user_org_role(id) = 'admin');

CREATE POLICY "Authenticated users can create organisations"
  ON public.organisations FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- Org members: same-org members can view, admin can insert/delete
CREATE POLICY "Org members can view members"
  ON public.org_members FOR SELECT
  USING (get_user_org_role(org_id) IS NOT NULL);

CREATE POLICY "Admins can add members"
  ON public.org_members FOR INSERT
  WITH CHECK (get_user_org_role(org_id) = 'admin');

CREATE POLICY "Admins can remove members"
  ON public.org_members FOR DELETE
  USING (get_user_org_role(org_id) = 'admin');

CREATE POLICY "Admins can update member roles"
  ON public.org_members FOR UPDATE
  USING (get_user_org_role(org_id) = 'admin');

-- Org invites: admin can view/create/update
CREATE POLICY "Admins can view invites"
  ON public.org_invites FOR SELECT
  USING (get_user_org_role(org_id) = 'admin');

CREATE POLICY "Admins can create invites"
  ON public.org_invites FOR INSERT
  WITH CHECK (get_user_org_role(org_id) = 'admin');

CREATE POLICY "Admins can update invites"
  ON public.org_invites FOR UPDATE
  USING (get_user_org_role(org_id) = 'admin');

-- Issue comments: org members can view via issue chain, anyone can add, own can edit/delete
CREATE POLICY "Org members can view comments"
  ON public.issue_comments FOR SELECT
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

CREATE POLICY "Org members can add comments"
  ON public.issue_comments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.validation_issues vi
      JOIN public.datasets d ON d.id = vi.dataset_id
      JOIN public.jobs j ON j.id = d.job_id
      JOIN public.projects p ON p.id = j.project_id
      WHERE vi.id = issue_comments.issue_id
      AND get_user_org_role(p.org_id) IS NOT NULL
    )
  );

CREATE POLICY "Users can update own comments"
  ON public.issue_comments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
  ON public.issue_comments FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================================================
-- 7. REWRITE ALL EXISTING RLS POLICIES
-- =============================================================================

-- ---- PROFILES ----
-- Keep own-profile policies, add org member visibility
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM public.org_members om1
      JOIN public.org_members om2 ON om1.org_id = om2.org_id
      WHERE om1.user_id = auth.uid()
      AND om2.user_id = profiles.id
    )
  );
-- Keep update policy unchanged (own profile only)

-- ---- PROJECTS ----
DROP POLICY IF EXISTS "Users can view own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can create own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON public.projects;

CREATE POLICY "Org members can view projects"
  ON public.projects FOR SELECT
  USING (get_user_org_role(org_id) IS NOT NULL);

CREATE POLICY "Admins and reviewers can create projects"
  ON public.projects FOR INSERT
  WITH CHECK (get_user_org_role(org_id) IN ('admin', 'reviewer'));

CREATE POLICY "Admins and reviewers can update projects"
  ON public.projects FOR UPDATE
  USING (get_user_org_role(org_id) IN ('admin', 'reviewer'));

CREATE POLICY "Admins can delete projects"
  ON public.projects FOR DELETE
  USING (get_user_org_role(org_id) = 'admin');

-- ---- JOBS ----
DROP POLICY IF EXISTS "Users can view own jobs" ON public.jobs;
DROP POLICY IF EXISTS "Users can create own jobs" ON public.jobs;
DROP POLICY IF EXISTS "Users can update own jobs" ON public.jobs;
DROP POLICY IF EXISTS "Users can delete own jobs" ON public.jobs;

CREATE POLICY "Org members can view jobs"
  ON public.jobs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = jobs.project_id
      AND get_user_org_role(projects.org_id) IS NOT NULL
    )
  );

CREATE POLICY "Admins and reviewers can create jobs"
  ON public.jobs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = jobs.project_id
      AND get_user_org_role(projects.org_id) IN ('admin', 'reviewer')
    )
  );

CREATE POLICY "Admins and reviewers can update jobs"
  ON public.jobs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = jobs.project_id
      AND get_user_org_role(projects.org_id) IN ('admin', 'reviewer')
    )
  );

CREATE POLICY "Admins can delete jobs"
  ON public.jobs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = jobs.project_id
      AND get_user_org_role(projects.org_id) = 'admin'
    )
  );

-- ---- DATASETS ----
DROP POLICY IF EXISTS "Users can view own datasets" ON public.datasets;
DROP POLICY IF EXISTS "Users can create own datasets" ON public.datasets;
DROP POLICY IF EXISTS "Users can update own datasets" ON public.datasets;
DROP POLICY IF EXISTS "Users can delete own datasets" ON public.datasets;

CREATE POLICY "Org members can view datasets"
  ON public.datasets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs
      JOIN public.projects ON projects.id = jobs.project_id
      WHERE jobs.id = datasets.job_id
      AND get_user_org_role(projects.org_id) IS NOT NULL
    )
  );

CREATE POLICY "Admins and reviewers can create datasets"
  ON public.datasets FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.jobs
      JOIN public.projects ON projects.id = jobs.project_id
      WHERE jobs.id = datasets.job_id
      AND get_user_org_role(projects.org_id) IN ('admin', 'reviewer')
    )
  );

CREATE POLICY "Admins and reviewers can update datasets"
  ON public.datasets FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs
      JOIN public.projects ON projects.id = jobs.project_id
      WHERE jobs.id = datasets.job_id
      AND get_user_org_role(projects.org_id) IN ('admin', 'reviewer')
    )
  );

CREATE POLICY "Admins can delete datasets"
  ON public.datasets FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs
      JOIN public.projects ON projects.id = jobs.project_id
      WHERE jobs.id = datasets.job_id
      AND get_user_org_role(projects.org_id) = 'admin'
    )
  );

-- ---- VALIDATION_RUNS ----
DROP POLICY IF EXISTS "Users can view validation runs for their own datasets" ON public.validation_runs;

CREATE POLICY "Org members can view validation runs"
  ON public.validation_runs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.datasets
      JOIN public.jobs ON jobs.id = datasets.job_id
      JOIN public.projects ON projects.id = jobs.project_id
      WHERE datasets.id = validation_runs.dataset_id
      AND get_user_org_role(projects.org_id) IS NOT NULL
    )
  );

-- ---- VALIDATION_ISSUES ----
DROP POLICY IF EXISTS "Users can view validation issues for their own datasets" ON public.validation_issues;

CREATE POLICY "Org members can view validation issues"
  ON public.validation_issues FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.datasets
      JOIN public.jobs ON jobs.id = datasets.job_id
      JOIN public.projects ON projects.id = jobs.project_id
      WHERE datasets.id = validation_issues.dataset_id
      AND get_user_org_role(projects.org_id) IS NOT NULL
    )
  );

-- ---- VALIDATION_PROFILES ----
DROP POLICY IF EXISTS "Users can select own profiles" ON public.validation_profiles;
DROP POLICY IF EXISTS "Users can insert own profiles" ON public.validation_profiles;
DROP POLICY IF EXISTS "Users can update own profiles" ON public.validation_profiles;
DROP POLICY IF EXISTS "Users can delete own profiles" ON public.validation_profiles;

CREATE POLICY "Org members can view validation profiles"
  ON public.validation_profiles FOR SELECT
  USING (
    org_id IS NOT NULL AND get_user_org_role(org_id) IS NOT NULL
  );

CREATE POLICY "Admins and reviewers can create validation profiles"
  ON public.validation_profiles FOR INSERT
  WITH CHECK (
    org_id IS NOT NULL AND get_user_org_role(org_id) IN ('admin', 'reviewer')
  );

CREATE POLICY "Admins and reviewers can update validation profiles"
  ON public.validation_profiles FOR UPDATE
  USING (
    org_id IS NOT NULL AND get_user_org_role(org_id) IN ('admin', 'reviewer')
  );

CREATE POLICY "Admins can delete validation profiles"
  ON public.validation_profiles FOR DELETE
  USING (
    org_id IS NOT NULL AND get_user_org_role(org_id) = 'admin'
  );

-- ---- AUDIT_LOGS ----
DROP POLICY IF EXISTS "Users can view own audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Users can insert own audit logs" ON public.audit_logs;
-- Keep "Service role full access" policy

CREATE POLICY "Org members can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (
    -- Logs linked to a dataset entity can be viewed by org members
    (entity_type = 'dataset' AND EXISTS (
      SELECT 1 FROM public.datasets
      JOIN public.jobs ON jobs.id = datasets.job_id
      JOIN public.projects ON projects.id = jobs.project_id
      WHERE datasets.id::text = audit_logs.entity_id
      AND get_user_org_role(projects.org_id) IS NOT NULL
    ))
    OR
    -- Logs linked to a project entity
    (entity_type = 'project' AND EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id::text = audit_logs.entity_id
      AND get_user_org_role(projects.org_id) IS NOT NULL
    ))
    OR
    -- Own logs (fallback for non-entity logs)
    auth.uid() = user_id
  );

CREATE POLICY "Authenticated users can insert audit logs"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ---- STORAGE.OBJECTS (datasets bucket) ----
DROP POLICY IF EXISTS "Users can upload to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;

-- Allow org members to view files uploaded by any member of the same org
-- Files are stored in {user_id}/filename -- we check if file owner is in same org as current user
CREATE POLICY "Org members can view files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'datasets'
    AND EXISTS (
      SELECT 1 FROM public.org_members my_mem
      JOIN public.org_members file_owner_mem ON my_mem.org_id = file_owner_mem.org_id
      WHERE my_mem.user_id = auth.uid()
      AND file_owner_mem.user_id = (storage.foldername(name))[1]::uuid
    )
  );

-- Upload: user can upload to their own folder if they are an org member (admin or reviewer)
CREATE POLICY "Org members can upload files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'datasets'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.org_members
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'reviewer')
    )
  );

-- Update: same org member check
CREATE POLICY "Org members can update files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'datasets'
    AND EXISTS (
      SELECT 1 FROM public.org_members my_mem
      JOIN public.org_members file_owner_mem ON my_mem.org_id = file_owner_mem.org_id
      WHERE my_mem.user_id = auth.uid()
      AND file_owner_mem.user_id = (storage.foldername(name))[1]::uuid
      AND my_mem.role IN ('admin', 'reviewer')
    )
  );

-- Delete: admin only
CREATE POLICY "Admins can delete files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'datasets'
    AND EXISTS (
      SELECT 1 FROM public.org_members my_mem
      JOIN public.org_members file_owner_mem ON my_mem.org_id = file_owner_mem.org_id
      WHERE my_mem.user_id = auth.uid()
      AND file_owner_mem.user_id = (storage.foldername(name))[1]::uuid
      AND my_mem.role = 'admin'
    )
  );

-- =============================================================================
-- 8. INDEXES FOR RLS PERFORMANCE
-- =============================================================================

CREATE INDEX idx_org_members_org_user ON public.org_members(org_id, user_id);
CREATE INDEX idx_projects_org_id ON public.projects(org_id);
CREATE INDEX idx_org_invites_org_id ON public.org_invites(org_id);
CREATE INDEX idx_org_invites_email ON public.org_invites(email);
CREATE INDEX idx_issue_comments_issue_id ON public.issue_comments(issue_id);
CREATE INDEX idx_issue_comments_user_id ON public.issue_comments(user_id);
CREATE INDEX idx_validation_profiles_org_id ON public.validation_profiles(org_id);

-- =============================================================================
-- 9. INVITE ACCEPTANCE FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION public.accept_org_invite(invite_id UUID)
RETURNS void AS $$
DECLARE
  inv RECORD;
BEGIN
  SELECT * INTO inv FROM public.org_invites
  WHERE id = invite_id AND status = 'pending' AND expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invite';
  END IF;

  INSERT INTO public.org_members (org_id, user_id, role, invited_by)
  VALUES (inv.org_id, auth.uid(), inv.role, inv.invited_by)
  ON CONFLICT (org_id, user_id) DO NOTHING;

  UPDATE public.org_invites SET status = 'accepted' WHERE id = invite_id;

  UPDATE public.profiles SET default_org_id = inv.org_id
  WHERE id = auth.uid() AND default_org_id IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================================================
-- 10. UPDATE handle_new_user TRIGGER FOR NEW SIGNUPS
-- =============================================================================

-- When a new user signs up, auto-create their personal org
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  );

  -- Create personal organisation
  INSERT INTO public.organisations (id, name, owner_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, 'User') || '''s Organisation',
    NEW.id
  );

  -- Add as admin of personal org
  INSERT INTO public.org_members (org_id, user_id, role)
  VALUES (NEW.id, NEW.id, 'admin');

  -- Set default org
  UPDATE public.profiles SET default_org_id = NEW.id WHERE id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 11. UPDATED_AT TRIGGERS FOR NEW TABLES
-- =============================================================================

CREATE TRIGGER on_organisation_updated
  BEFORE UPDATE ON public.organisations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_issue_comment_updated
  BEFORE UPDATE ON public.issue_comments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
