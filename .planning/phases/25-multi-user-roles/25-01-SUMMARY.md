---
phase: 25-multi-user-roles
plan: 01
subsystem: database
tags: [supabase, rls, multi-tenant, organisations, permissions, postgres]

requires:
  - phase: 01-foundation-auth
    provides: profiles table, auth trigger, RLS pattern
  - phase: 02-project-structure
    provides: projects and jobs tables with user_id RLS
provides:
  - organisations, org_members, org_invites, issue_comments tables
  - get_user_org_role() SECURITY DEFINER function for all RLS policies
  - Org-scoped RLS on all 9 tables + storage bucket
  - TypeScript Organisation/OrgMember/OrgInvite/IssueComment types
  - hasPermission() and requireOrgRole() permission helpers
  - ApprovalStatus state machine with transition rules
affects: [25-02, 25-03, server-actions, api-routes, usage-tracking]

tech-stack:
  added: []
  patterns: [SECURITY DEFINER for RLS org scoping, role hierarchy numeric comparison, approval state machine]

key-files:
  created:
    - supabase/migrations/00012_organisations.sql
    - src/lib/types/organisations.ts
    - src/lib/permissions.ts
  modified:
    - src/lib/types/projects.ts
    - src/lib/types/files.ts

key-decisions:
  - "SECURITY DEFINER function get_user_org_role() used by all RLS policies to avoid recursive policy references"
  - "Personal orgs use profile.id as org.id for simple backfill mapping (UPDATE projects SET org_id = user_id)"
  - "Storage keeps user-folder paths but RLS checks org membership across folders for team file access"
  - "Audit logs use entity_type+entity_id join pattern for org-scoped visibility (not a direct org_id column)"

patterns-established:
  - "Org-scoped RLS: all table policies use get_user_org_role(org_id) instead of auth.uid() = user_id"
  - "Role hierarchy: viewer=0, reviewer=1, admin=2 for numeric comparison in hasPermission()"
  - "requireOrgRole() server helper: profile -> org_members chain for auth checks in server actions"

requirements-completed: [TEAM-01, TEAM-03]

duration: 3min
completed: 2026-04-11
---

# Phase 25 Plan 01: Multi-Tenant Foundation Summary

**Org tables with SECURITY DEFINER RLS rewrite across all 9 tables + storage, TypeScript permission matrix with 11 role-gated actions**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-11T00:41:56Z
- **Completed:** 2026-04-11T00:45:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created organisations, org_members, org_invites, and issue_comments tables with full RLS
- Rewrote all existing RLS policies on 9 tables + storage bucket to use org-scoped access via get_user_org_role()
- Backfill migration creates personal orgs for existing users (invisible to them)
- TypeScript permission system with hasPermission() covering 11 actions across 3 roles

## Task Commits

Each task was committed atomically:

1. **Task 1: Database migration -- org tables, RLS rewrite, backfill** - `257ec0c` (feat)
2. **Task 2: TypeScript types and permission library** - `ff8ef47` (feat)

## Files Created/Modified
- `supabase/migrations/00012_organisations.sql` - Full migration: 4 new tables, 3 ALTER TABLEs, SECURITY DEFINER function, backfill, RLS rewrite for all tables + storage, invite acceptance function, updated signup trigger
- `src/lib/types/organisations.ts` - Organisation, OrgMember, OrgInvite, IssueComment types with OrgRole and ApprovalStatus
- `src/lib/permissions.ts` - hasPermission() pure function + requireOrgRole() server helper
- `src/lib/types/projects.ts` - Added org_id field to Project interface
- `src/lib/types/files.ts` - Added optional approval_status field to Dataset interface

## Decisions Made
- SECURITY DEFINER function used by all RLS policies to avoid recursive policy references on org_members
- Personal orgs use profile.id as org.id for simple backfill (existing projects get org_id = user_id)
- Storage keeps user-folder paths but RLS checks org membership across folders for team access
- Audit logs use entity_type+entity_id join pattern for org visibility (no direct org_id column needed)
- handle_new_user trigger updated to auto-create personal org + membership on signup

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - database migration will be applied via `supabase db push` or deployment. No external service configuration required.

## Next Phase Readiness
- Org tables and RLS policies ready for Plans 02 (server actions/API migration) and 03 (team UI)
- Permission library ready for role-gating in server actions and frontend components
- Existing users will have personal orgs created automatically on migration

---
*Phase: 25-multi-user-roles*
*Completed: 2026-04-11*
