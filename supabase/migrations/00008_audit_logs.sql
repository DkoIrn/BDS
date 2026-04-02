-- Audit trail for tracking all significant user actions
-- Supports: validation runs, data fixes, profile changes, exports

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,  -- e.g., 'validation.run', 'clean.auto', 'clean.ai_fix', 'export.download', 'dataset.upload'
  entity_type text not null,  -- e.g., 'dataset', 'project', 'validation_run', 'profile'
  entity_id text,  -- UUID of the affected entity (nullable for bulk actions)
  metadata jsonb default '{}',  -- action-specific data (before/after values, config, counts)
  ip_address text,
  created_at timestamptz not null default now()
);

-- Index for querying by user
create index if not exists idx_audit_logs_user_id on public.audit_logs(user_id);

-- Index for querying by entity
create index if not exists idx_audit_logs_entity on public.audit_logs(entity_type, entity_id);

-- Index for time-range queries
create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at desc);

-- RLS: users can only see their own audit logs
alter table public.audit_logs enable row level security;

create policy "Users can view own audit logs"
  on public.audit_logs for select
  using (auth.uid() = user_id);

create policy "Users can insert own audit logs"
  on public.audit_logs for insert
  with check (auth.uid() = user_id);

-- Service role can insert on behalf of users (for backend operations)
create policy "Service role full access"
  on public.audit_logs for all
  using (auth.role() = 'service_role');
