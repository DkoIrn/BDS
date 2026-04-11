---
phase: 25-multi-user-roles
plan: 02
subsystem: api
tags: [multi-tenant, org-scoping, team-management, rbac, server-actions, api-routes]

requires:
  - phase: 25-multi-user-roles
    provides: org tables, RLS policies, requireOrgRole, hasPermission, TypeScript types
provides:
  - Org-scoped server actions (projects, files, validation, profiles, audit, usage)
  - Org-scoped API routes (validate, parse, reports, pipeline-validation, audit)
  - Team management server actions (invite, list, remove, role change, cancel invite)
  - Team management UI components (member list, invite dialog, team settings tab)
  - Org-level usage counting (getOrgUsage)
affects: [25-03, frontend-components, usage-dashboard]

tech-stack:
  added: []
  patterns: [requireOrgRole guard pattern for server actions, RLS-first access control with server-side org validation]

key-files:
  created:
    - src/lib/actions/team.ts
    - src/components/team/team-management.tsx
    - src/components/team/invite-dialog.tsx
    - src/components/team/member-list.tsx
  modified:
    - src/lib/actions/projects.ts
    - src/lib/actions/files.ts
    - src/lib/actions/validation.ts
    - src/lib/actions/profiles.ts
    - src/lib/actions/audit-read.ts
    - src/lib/actions/usage.ts
    - src/lib/usage.ts
    - src/app/api/validate/route.ts
    - src/app/api/parse/route.ts
    - src/app/api/reports/pdf/route.ts
    - src/app/api/reports/export/route.ts
    - src/app/api/pipeline-validation/route.ts
    - src/app/api/audit/route.ts
    - src/components/realtime-provider.tsx
    - src/app/(dashboard)/settings/page.tsx

key-decisions:
  - "RLS-first access control: remove explicit .eq('user_id') filters, let RLS handle org-scoped visibility"
  - "Keep user_id in inserts for attribution (who created/uploaded) while using org_id for access scoping"
  - "Org-level usage counting via getOrgUsage replaces per-user getUserUsage for tier enforcement"
  - "Team invite uses Supabase admin.inviteUserByEmail for new users, record-only for existing users"
  - "RealtimeProvider removes user_id filter since RLS on Realtime handles org-scoped visibility"

patterns-established:
  - "requireOrgRole guard: every server action/API route starts with auth + requireOrgRole(supabase, user.id, minRole)"
  - "RLS delegation: after requireOrgRole confirms membership, rely on RLS for row-level filtering"
  - "Admin-gated team actions: invite, remove, role change all require admin role"

requirements-completed: [TEAM-01, TEAM-03, TEAM-04]

duration: 9min
completed: 2026-04-11
---

# Phase 25 Plan 02: Org-Scoped Access & Team Management Summary

**Migrated all 14 server actions and 6 API routes from user_id access control to org-scoped requireOrgRole + RLS, built team management UI with invite flow, member list, and role management**

## Performance

- **Duration:** 9 min
- **Started:** 2026-04-11T11:38:37Z
- **Completed:** 2026-04-11T11:47:36Z
- **Tasks:** 2
- **Files modified:** 19

## Accomplishments
- Systematically replaced .eq('user_id', user.id) access control with requireOrgRole + RLS across all server actions and API routes
- Built complete team management UI with member list (role badges, role change dropdown, remove with confirmation)
- Created invite dialog with email input, role selection grid, and pending invites management
- Added org-level usage counting so tier limits apply to the whole organisation

## Task Commits

Each task was committed atomically:

1. **Task 1: Update server actions and API routes to org-scoped access** - `926c861` (feat)
2. **Task 2: Team management UI in settings** - `9ac7fa0` (feat)

## Files Created/Modified
- `src/lib/actions/team.ts` - Team CRUD: invite, list, remove, role change, cancel invite, getUserOrgRole
- `src/components/team/team-management.tsx` - Team settings wrapper with data fetching and admin controls
- `src/components/team/invite-dialog.tsx` - Invite form with email, role selection, pending invites list
- `src/components/team/member-list.tsx` - Member table with role badges, dropdown role change, remove confirmation
- `src/lib/actions/projects.ts` - Org-scoped project CRUD with requireOrgRole
- `src/lib/actions/files.ts` - Org-scoped file operations, org-level storage counting
- `src/lib/actions/validation.ts` - Org-scoped validation access via RLS
- `src/lib/actions/profiles.ts` - Org-scoped validation profiles with org_id
- `src/lib/actions/audit-read.ts` - Org-scoped audit log reads via RLS
- `src/lib/actions/usage.ts` - Org-level usage data via getOrgUsage
- `src/lib/usage.ts` - Added getOrgUsage for org-scoped project/storage/QC counting
- `src/app/api/validate/route.ts` - requireOrgRole('reviewer') + RLS
- `src/app/api/parse/route.ts` - requireOrgRole('reviewer') + RLS
- `src/app/api/reports/pdf/route.ts` - requireOrgRole('viewer') for both GET and POST
- `src/app/api/reports/export/route.ts` - requireOrgRole('viewer') + RLS
- `src/app/api/pipeline-validation/route.ts` - requireOrgRole('reviewer') + RLS
- `src/app/api/audit/route.ts` - requireOrgRole('viewer') + silent fail
- `src/components/realtime-provider.tsx` - Removed user_id filter (RLS handles org scoping)
- `src/app/(dashboard)/settings/page.tsx` - Added Team section with TeamManagement component

## Decisions Made
- RLS-first access control: after requireOrgRole confirms org membership, rely on database RLS for row-level filtering instead of explicit user_id equality checks
- Keep user_id in inserts for attribution while using org_id/RLS for access scoping
- Org-level usage counting replaces per-user counting for fair tier enforcement across teams
- Team invite creates record + optionally sends Supabase admin invite email for new users
- RealtimeProvider drops the user_id channel filter since Supabase Realtime RLS handles org visibility
- comments.ts .eq('user_id') retained correctly -- it's "delete own comment" attribution, not access control

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

SUPABASE_SERVICE_ROLE_KEY environment variable is needed for the admin invite flow (inviting new users by email). If not set, the invite record is still created but the email won't be sent automatically.

## Next Phase Readiness
- All server actions and API routes use org-scoped access -- ready for Plan 03 (frontend role-gating)
- Team management UI complete with full CRUD operations
- getUserOrgRole() available for frontend components to conditionally render based on role

---
*Phase: 25-multi-user-roles*
*Completed: 2026-04-11*
