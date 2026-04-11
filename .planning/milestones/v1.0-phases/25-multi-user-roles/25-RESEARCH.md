# Phase 25: Multi-User & Roles - Research

**Researched:** 2026-04-10
**Domain:** Supabase multi-tenancy, RLS organisation scoping, role-based access control
**Confidence:** HIGH

## Summary

Phase 25 transforms TruQC from a single-user product into a team-capable platform. The core challenge is migrating from `auth.uid() = user_id` RLS policies on every table to organisation-scoped access with role differentiation. This requires: (1) an `organisations` table with membership join table, (2) rewriting ALL RLS policies to check membership via a SECURITY DEFINER helper function, (3) adding invite flow using Supabase Admin API + Resend emails, (4) a comments table for validation issue discussion, and (5) an approval workflow status field on datasets.

The current codebase has 8 tables with `user_id` columns and direct ownership RLS policies (profiles, projects, jobs, datasets, validation_profiles, validation_runs, validation_issues, audit_logs). Storage bucket policies also use folder-based user isolation. Every one of these must be updated. Server actions and API routes also perform explicit `user_id` ownership checks that need conversion to organisation membership checks.

**Primary recommendation:** Use the standard Supabase multi-tenant pattern: `organisations` table, `org_members` join table with role enum, a single `get_user_org_role()` SECURITY DEFINER function for all RLS policies, and `org_id` foreign key added to projects (only projects need it -- jobs/datasets inherit via project cascade).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TEAM-01 | Multi-user accounts with role-based access | Organisations table + org_members join table + role enum (admin/reviewer/viewer) + RLS rewrite |
| TEAM-03 | Admin/Reviewer/Viewer roles with permissions | Permission matrix enforced via SECURITY DEFINER function + frontend role checks |
| TEAM-04 | Team invites and member management | Supabase Admin API inviteUserByEmail + pending_invites table + Resend email + settings team tab |
| TEAM-05 | Issue comments and approval workflow | issue_comments table + dataset approval_status column (draft/reviewed/approved/issued) |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Supabase (existing) | current | Auth, DB, RLS, Storage, Realtime | Already in use; RLS is the correct enforcement layer |
| Resend (existing) | current | Transactional email for invites | Already configured as SMTP provider for this project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Supabase Admin Client | current | Server-side invite via `inviteUserByEmail` | When admin invites a new user who doesn't have an account yet |
| sonner (existing) | current | Toast notifications | Role-change confirmation, invite sent feedback |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom invite tokens | Supabase `inviteUserByEmail` | Custom tokens = more code, Supabase admin API handles token lifecycle |
| JWT custom claims for roles | DB lookup via SECURITY DEFINER | Custom claims require Edge Functions to set; DB lookup is simpler, already fits RLS pattern |
| Separate schemas per org | Shared tables with org_id | Separate schemas adds massive complexity for a solo project -- shared tables + RLS is standard |

## Architecture Patterns

### Database Schema Extension

```
organisations
├── id (UUID, PK)
├── name (TEXT)
├── owner_id (UUID, FK → auth.users)
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)

org_members
├── id (UUID, PK)
├── org_id (UUID, FK → organisations)
├── user_id (UUID, FK → auth.users)
├── role (TEXT: 'admin' | 'reviewer' | 'viewer')
├── invited_by (UUID, FK → auth.users, nullable)
├── created_at (TIMESTAMPTZ)
└── UNIQUE(org_id, user_id)

org_invites
├── id (UUID, PK)
├── org_id (UUID, FK → organisations)
├── email (TEXT)
├── role (TEXT: 'admin' | 'reviewer' | 'viewer')
├── invited_by (UUID, FK → auth.users)
├── status (TEXT: 'pending' | 'accepted' | 'expired')
├── created_at (TIMESTAMPTZ)
├── expires_at (TIMESTAMPTZ)
└── UNIQUE(org_id, email)

issue_comments
├── id (UUID, PK)
├── issue_id (UUID, FK → validation_issues)
├── user_id (UUID, FK → auth.users)
├── content (TEXT)
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)

-- ALTER existing tables:
projects: ADD COLUMN org_id UUID REFERENCES organisations(id)
datasets: ADD COLUMN approval_status TEXT DEFAULT 'draft'
profiles: ADD COLUMN default_org_id UUID REFERENCES organisations(id)
```

### Pattern 1: SECURITY DEFINER Helper Function
**What:** A single function that returns the user's role within an organisation, used by ALL RLS policies
**When to use:** Every RLS policy that needs org-scoped access
**Example:**
```sql
-- Source: Supabase multi-tenant best practices
CREATE OR REPLACE FUNCTION get_user_org_role(check_org_id UUID)
RETURNS TEXT AS $$
  SELECT role FROM org_members
  WHERE org_id = check_org_id AND user_id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Usage in RLS policy:
CREATE POLICY "Org members can view projects"
  ON projects FOR SELECT
  USING (get_user_org_role(org_id) IS NOT NULL);

CREATE POLICY "Admins and reviewers can modify projects"
  ON projects FOR UPDATE
  USING (get_user_org_role(org_id) IN ('admin', 'reviewer'));
```

### Pattern 2: Backward-Compatible Migration
**What:** Auto-create a "personal" organisation for each existing user during migration
**When to use:** Migration script must preserve single-user functionality
**Example:**
```sql
-- For each existing profile, create a personal org and membership
INSERT INTO organisations (id, name, owner_id)
SELECT id, full_name || '''s Organisation', id FROM profiles;

INSERT INTO org_members (org_id, user_id, role)
SELECT id, id, 'admin' FROM profiles;

-- Set default_org_id on profiles
UPDATE profiles SET default_org_id = id;

-- Backfill org_id on existing projects
UPDATE projects SET org_id = user_id;
```

### Pattern 3: Invite Flow
**What:** Admin sends invite -> pending record created -> email sent -> user clicks link -> signup/login -> auto-join org
**When to use:** TEAM-04 implementation
**Flow:**
1. Admin submits invite form (email + role)
2. Server action creates `org_invites` record (status: pending, expires: 7 days)
3. Server action calls Supabase Admin API `inviteUserByEmail` with redirect URL including invite ID
4. If user already exists in auth.users, send a custom email via Resend instead (Supabase invite only works for new users)
5. User clicks link -> lands on app -> `handle_new_user` trigger or login callback checks for pending invite -> auto-adds to org

### Pattern 4: Permission Matrix (Frontend + Backend)
**What:** Centralised permission constants shared between frontend guards and server actions

| Capability | Admin | Reviewer | Viewer |
|------------|-------|----------|--------|
| View projects/datasets/results | YES | YES | YES |
| Upload files | YES | YES | NO |
| Run validation | YES | YES | NO |
| Triage issues | YES | YES | NO |
| Generate reports | YES | YES | YES (download only) |
| Add comments | YES | YES | YES |
| Approve/issue datasets | YES | YES | NO |
| Manage team members | YES | NO | NO |
| Manage billing/branding | YES | NO | NO |
| Delete projects | YES | NO | NO |

### Pattern 5: Approval Workflow State Machine
**What:** Dataset lifecycle from draft through to issued
**States:** `draft` -> `reviewed` -> `approved` -> `issued`
**Rules:**
- Only Reviewers/Admins can transition states
- `reviewed`: Someone has completed QC review
- `approved`: QC results accepted as satisfactory
- `issued`: Final state -- client report has been generated/sent
- Each transition logged in audit_logs

### Anti-Patterns to Avoid
- **Checking roles in middleware:** Middleware should only check authentication, not authorisation. Role checks belong in server actions and RLS policies.
- **Storing role in JWT claims:** Stale after role changes. Always query the DB.
- **Inline subqueries in RLS policies:** Performance killer. Use SECURITY DEFINER functions.
- **Adding org_id to every table:** Only add to projects. Jobs inherit through project, datasets through job. Avoids data duplication.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| User invitation | Custom token generation + verification | Supabase `inviteUserByEmail` Admin API | Handles token lifecycle, expiry, email verification automatically |
| Email sending | nodemailer/raw SMTP | Resend (already configured) | Already the project's transactional email provider |
| Permission checking | Ad-hoc if/else in each action | Centralised `PERMISSIONS` constant + `hasPermission(role, action)` helper | Single source of truth, testable, prevents drift |
| Data isolation | Application-level filtering | Supabase RLS with SECURITY DEFINER | Defense-in-depth; even a buggy server action can't leak cross-org data |

**Key insight:** The hardest part of this phase is NOT adding new features -- it's rewriting existing RLS policies and server actions. Budget 60% of effort for migration, 40% for new features.

## Common Pitfalls

### Pitfall 1: RLS Recursive Policy References
**What goes wrong:** RLS policy on table A references table B, which also has RLS policies, causing infinite recursion
**Why it happens:** `org_members` table has RLS, and other tables' policies query `org_members`
**How to avoid:** Use SECURITY DEFINER functions. They bypass RLS on the tables they query internally.
**Warning signs:** "infinite recursion detected in policy" error

### Pitfall 2: Forgetting to Migrate Storage Policies
**What goes wrong:** Database tables are org-scoped but storage still uses user-folder isolation
**Why it happens:** Storage RLS is separate from table RLS and uses different path-based checks
**How to avoid:** Change storage path convention from `{user_id}/filename` to `{org_id}/filename` and update storage policies. OR keep user-folder structure but add org_member check.
**Warning signs:** Team members can't access each other's uploaded files

### Pitfall 3: Invite Race Condition
**What goes wrong:** User accepts invite but the org_members insert fails or the invite is already expired
**Why it happens:** Time between invite send and accept can be days; concurrent invite acceptance
**How to avoid:** Use a database function/trigger that atomically checks invite validity and creates membership. Use `ON CONFLICT DO NOTHING` for idempotency.
**Warning signs:** Users click invite link but don't appear in the team

### Pitfall 4: Breaking Existing Single-User Flows
**What goes wrong:** After migration, existing users can't see their own projects
**Why it happens:** RLS policies now check org_id but existing projects have NULL org_id
**How to avoid:** Migration MUST backfill org_id on all existing projects. Create personal orgs for all existing users. Test with existing data.
**Warning signs:** 404 errors on project pages after deployment

### Pitfall 5: Existing user_id Checks in Server Actions
**What goes wrong:** Server actions still filter by `user_id = auth.uid()` after org migration
**Why it happens:** Multiple server actions explicitly check ownership beyond what RLS does
**How to avoid:** Audit every server action and API route. Replace `user_id` checks with org membership checks where needed.
**Warning signs:** Team members get "not found" errors on shared resources

### Pitfall 6: Realtime Subscriptions Breaking
**What goes wrong:** Realtime channel filters on user_id stop working for team members
**Why it happens:** Current Realtime subscriptions likely filter by user_id
**How to avoid:** Update Realtime channel filters to use org_id or remove user-specific filters (RLS handles visibility)
**Warning signs:** Team members don't see real-time status updates

## Code Examples

### Server Action: Role-Gated Operation
```typescript
// Source: Project pattern from existing server actions
async function requireOrgRole(
  supabase: SupabaseClient,
  userId: string,
  minRole: 'viewer' | 'reviewer' | 'admin'
): Promise<{ orgId: string; role: string } | { error: string }> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('default_org_id')
    .eq('id', userId)
    .single()

  if (!profile?.default_org_id) {
    return { error: 'No organisation found' }
  }

  const { data: membership } = await supabase
    .from('org_members')
    .select('role')
    .eq('org_id', profile.default_org_id)
    .eq('user_id', userId)
    .single()

  if (!membership) {
    return { error: 'Not a member of this organisation' }
  }

  const ROLE_HIERARCHY = { viewer: 0, reviewer: 1, admin: 2 }
  if (ROLE_HIERARCHY[membership.role] < ROLE_HIERARCHY[minRole]) {
    return { error: 'Insufficient permissions' }
  }

  return { orgId: profile.default_org_id, role: membership.role }
}
```

### Invite Server Action
```typescript
// Source: Supabase Admin API docs
import { createClient } from '@supabase/supabase-js'

async function inviteTeamMember(email: string, role: string) {
  // Use service role client for admin operations
  const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Check if user already exists
  const { data: existingUsers } = await adminSupabase.auth.admin.listUsers()
  const existingUser = existingUsers?.users?.find(u => u.email === email)

  if (existingUser) {
    // User exists: create invite record, send custom email via Resend
    // They'll see the invite when they next log in
  } else {
    // New user: use Supabase invite
    await adminSupabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?invite=true`,
    })
  }
}
```

### Approval Status Transition
```typescript
const APPROVAL_TRANSITIONS: Record<string, string[]> = {
  draft: ['reviewed'],
  reviewed: ['approved', 'draft'],  // Can revert to draft
  approved: ['issued', 'reviewed'],  // Can revert to reviewed
  issued: [],  // Terminal state
}

function canTransition(current: string, next: string): boolean {
  return APPROVAL_TRANSITIONS[current]?.includes(next) ?? false
}
```

## Tables Requiring RLS Migration

**Complete inventory of tables and their current RLS pattern:**

| Table | Current RLS | New RLS Pattern | Migration Effort |
|-------|-------------|-----------------|------------------|
| profiles | `auth.uid() = id` | Keep as-is (personal data) + add org fields | LOW |
| projects | `auth.uid() = user_id` | `get_user_org_role(org_id) IS NOT NULL` | HIGH |
| jobs | `auth.uid() = user_id` | Inherit via project join | HIGH |
| datasets | `auth.uid() = user_id` | Inherit via job → project join | HIGH |
| validation_runs | Subquery on datasets.user_id | Inherit via dataset → job → project | MEDIUM |
| validation_issues | Subquery on datasets.user_id | Inherit via dataset → job → project | MEDIUM |
| validation_profiles | `auth.uid() = user_id` | Add org_id, use org role check | MEDIUM |
| audit_logs | `auth.uid() = user_id` | Add org_id, use org role check | MEDIUM |
| storage.objects | Folder = user UUID | Folder = org UUID OR org membership check | HIGH |

**Total: 9 tables + storage need RLS updates.**

## Server Actions / API Routes Requiring Updates

| File | Current Check | New Check |
|------|--------------|-----------|
| `src/lib/actions/projects.ts` | `user_id = user.id` | `org_id` from user's default org |
| `src/lib/actions/files.ts` | `user_id = user.id` | Org membership via project chain |
| `src/lib/actions/validation.ts` | Ownership via dataset | Org membership via project chain |
| `src/app/api/validate/route.ts` | `user_id = user.id` on dataset | Org membership check |
| `src/app/api/parse/route.ts` | Ownership check | Org membership check |
| `src/app/api/reports/pdf/route.ts` | Ownership check | Org membership check |
| `src/app/api/reports/export/route.ts` | Ownership check | Org membership check |
| `src/lib/usage.ts` | Per-user counts | Per-org counts |
| `src/components/realtime-provider.tsx` | User-scoped channels | Org-scoped channels |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| JWT custom claims for roles | DB-backed roles with SECURITY DEFINER | Supabase best practices 2024+ | Roles update immediately without re-auth |
| Application-level org filtering | RLS with helper functions | Standard since Supabase launched | Defense-in-depth, can't bypass |
| Separate schemas per tenant | Shared tables with org_id + RLS | N/A (shared has always been simpler) | Easier migrations, simpler queries |

## Open Questions

1. **Storage path migration**
   - What we know: Current files stored at `{user_id}/filename`. Team members need access.
   - What's unclear: Whether to migrate existing file paths to `{org_id}/` or update storage policies to check org_members
   - Recommendation: Keep existing paths, update storage RLS to check org membership instead of folder ownership. Avoids file migration complexity.

2. **Usage tracking scope change**
   - What we know: Current usage (project count, QC checks, storage) is per-user
   - What's unclear: Should limits apply per-org or per-user after teams?
   - Recommendation: Move to per-org limits. The billing entity is the org (one Stripe subscription per org), not individual users.

3. **Existing user migration experience**
   - What we know: Must create personal orgs for all existing users
   - What's unclear: Should users see any UI change, or should it be invisible?
   - Recommendation: Invisible migration. Personal org auto-created, default_org_id set. User sees Team tab in settings only.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (frontend) + pytest (backend) |
| Config file | vitest.config.ts, pytest.ini |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run && cd backend && python -m pytest` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEAM-01 | Org + membership tables, RLS policies | integration | `npx vitest run src/lib/__tests__/org-membership.test.ts -x` | No - Wave 0 |
| TEAM-03 | Permission checks per role | unit | `npx vitest run src/lib/__tests__/permissions.test.ts -x` | No - Wave 0 |
| TEAM-04 | Invite creation + acceptance flow | unit | `npx vitest run src/lib/__tests__/team-invites.test.ts -x` | No - Wave 0 |
| TEAM-05 | Comment CRUD + approval transitions | unit | `npx vitest run src/lib/__tests__/approval-workflow.test.ts -x` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run && cd backend && python -m pytest`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/__tests__/permissions.test.ts` -- covers TEAM-03 permission matrix
- [ ] `src/lib/__tests__/org-membership.test.ts` -- covers TEAM-01 role queries
- [ ] `src/lib/__tests__/team-invites.test.ts` -- covers TEAM-04 invite flow
- [ ] `src/lib/__tests__/approval-workflow.test.ts` -- covers TEAM-05 state transitions

## Sources

### Primary (HIGH confidence)
- Supabase RLS docs: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase inviteUserByEmail: https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail
- Existing codebase: 11 migration files, 9 tables with RLS, 27+ files with user_id references

### Secondary (MEDIUM confidence)
- Supabase multi-tenant RLS patterns: https://makerkit.dev/blog/tutorials/supabase-rls-best-practices
- Team invite RLS implementation: https://boardshape.com/engineering/how-to-implement-rls-for-a-team-invite-system-with-supabase
- Multi-tenant architecture: https://dev.to/blackie360/-enforcing-row-level-security-in-supabase-a-deep-dive-into-lockins-multi-tenant-architecture-4hd2

### Tertiary (LOW confidence)
- None -- all findings verified with official docs or codebase inspection

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing Supabase + Resend, well-documented patterns
- Architecture: HIGH - Multi-tenant org pattern is the standard Supabase approach, verified across multiple sources
- Pitfalls: HIGH - Identified from real codebase audit (9 tables, 27+ files need updating)
- Migration scope: HIGH - Complete inventory of tables, policies, and server actions documented

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stable patterns, Supabase RLS is mature)
