# Phase 2: Project Structure - Research

**Researched:** 2026-03-10
**Domain:** Supabase schema design, Next.js CRUD patterns, shadcn/ui data display
**Confidence:** HIGH

## Summary

Phase 2 implements project and job CRUD with Supabase as the backend. The core work is: (1) database schema with two new tables and RLS policies, (2) server actions for create/read operations, (3) three new pages (projects list, project detail, job creation UI), and (4) a Dialog component for modal-based creation flows.

The project already has established patterns from Phase 1 -- server actions in `src/lib/actions/`, Supabase client helpers, `useActionState` for forms, and shadcn/ui components. This phase extends those patterns to data CRUD. The main new elements are the Dialog component (needs to be added via shadcn CLI), a Table component for the projects list, and database migration files.

**Primary recommendation:** Follow the existing server action + Server Component pattern. Use Supabase RLS to isolate user data. Add shadcn Dialog and Table components. Keep client-side sorting for MVP (small dataset per user).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Projects list page: table/list view with sortable columns (name, status, jobs count, last updated)
- Clean, minimalistic design consistent with top-bar-only layout
- "+ New Project" button prominently placed
- Create project flow: modal/dialog, no page navigation
- Project fields: name (required), description (optional)
- Project detail page: shows project name, description, list of jobs
- Navigation: projects list -> project detail -> jobs
- Job fields: job name (required), survey type dropdown (DOB, DOC, TOP, Event Listing, Pipeline Position, ROVV), description/notes (optional)
- Add "Projects" to top bar navigation between Dashboard and Settings
- No sidebar -- top bar only

### Claude's Discretion
- Table sorting implementation (client-side vs server-side)
- Project/job status values and transitions
- Empty states (no projects yet, no jobs in project)
- Job creation UI (modal vs inline)
- URL structure for project detail pages
- Database schema design for projects and jobs tables
- RLS policies for projects and jobs

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PROJ-01 | User can create a project (e.g., "Pipeline Survey - North Sea") | Dialog modal + server action + projects table with RLS |
| PROJ-02 | User can create survey jobs within a project (e.g., "Phase 1 Survey") | Job creation UI + server action + jobs table with FK to projects |
| PROJ-03 | User can view list of their projects with status summaries | Projects list page with Server Component data fetching + jobs count query |
| PROJ-04 | User can view all jobs and datasets within a project | Project detail page with nested job listing (datasets deferred to Phase 3) |
</phase_requirements>

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | ^2.99.0 | Database client | Already in project, handles queries + RLS |
| @supabase/ssr | ^0.9.0 | Server-side Supabase | Cookie-based auth, already configured |
| shadcn/ui | v4 | UI components | Already in project, add Dialog + Table |
| lucide-react | ^0.577.0 | Icons | Already in project |
| sonner | ^2.0.7 | Toast notifications | Already in project, use for create success/error |

### Components to Add (via shadcn CLI)
| Component | Purpose | Command |
|-----------|---------|---------|
| Dialog | Modal for project/job creation | `npx shadcn@latest add dialog` |
| Table | Projects list display | `npx shadcn@latest add table` |
| Select | Survey type dropdown for jobs | `npx shadcn@latest add select` |
| Badge | Status indicators on projects/jobs | `npx shadcn@latest add badge` |
| Textarea | Description fields | `npx shadcn@latest add textarea` |

**Installation:**
```bash
npx shadcn@latest add dialog table select badge textarea
```

### Not Needed
| Library | Why Not |
|---------|---------|
| TanStack Table | Overkill for MVP -- simple HTML table with shadcn styling + manual sort suffices |
| React Hook Form | useActionState already handles form state; simple forms don't need it |
| Zod (client) | Server-side validation in actions is sufficient for MVP |

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/(dashboard)/
│   └── projects/
│       ├── page.tsx              # Projects list (PROJ-03)
│       └── [projectId]/
│           └── page.tsx          # Project detail with jobs (PROJ-04)
├── components/
│   ├── projects/
│   │   ├── create-project-dialog.tsx  # Modal form (PROJ-01)
│   │   ├── projects-table.tsx         # Sortable table (PROJ-03)
│   │   └── project-status-badge.tsx   # Status display
│   └── jobs/
│       ├── create-job-dialog.tsx       # Modal form (PROJ-02)
│       └── jobs-list.tsx              # Jobs within project (PROJ-04)
├── lib/
│   ├── actions/
│   │   └── projects.ts           # Server actions for projects + jobs
│   └── types/
│       └── projects.ts           # TypeScript types for projects + jobs
supabase/
└── migrations/
    └── 00002_projects_jobs.sql   # Schema + RLS
```

### Pattern 1: Database Schema Design
**What:** Two tables -- `projects` and `jobs` -- with user ownership via `user_id` FK to `auth.users`.

```sql
-- Projects table
CREATE TABLE public.projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Jobs table
CREATE TABLE public.jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  survey_type TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_projects_user_id ON public.projects(user_id);
CREATE INDEX idx_jobs_project_id ON public.jobs(project_id);
CREATE INDEX idx_jobs_user_id ON public.jobs(user_id);
```

**Status values recommendation:**
- Projects: `active`, `completed`, `archived`
- Jobs: `pending`, `processing`, `completed`, `failed`

These are simple text columns for now. Phase 7 (async processing) will use the job status values.

**Why `user_id` on both tables:** Jobs table has `user_id` for direct RLS without joins. This is the standard Supabase pattern -- denormalize ownership for RLS performance.

### Pattern 2: RLS Policies
**What:** Row-level security ensuring users only see their own data.

```sql
-- Projects RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own projects"
  ON public.projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own projects"
  ON public.projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects"
  ON public.projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects"
  ON public.projects FOR DELETE
  USING (auth.uid() = user_id);

-- Jobs RLS (same pattern)
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own jobs"
  ON public.jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own jobs"
  ON public.jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own jobs"
  ON public.jobs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own jobs"
  ON public.jobs FOR DELETE
  USING (auth.uid() = user_id);
```

**Reuse `handle_updated_at` trigger** from profiles migration -- it already exists as a function.

### Pattern 3: Server Actions for CRUD
**What:** Follow the existing `src/lib/actions/auth.ts` pattern.

```typescript
// src/lib/actions/projects.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createProject(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const name = formData.get('name') as string
  const description = formData.get('description') as string | null

  const { error } = await supabase
    .from('projects')
    .insert({ user_id: user.id, name, description: description || null })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/projects')
  return { success: true }
}
```

Key points:
- Always call `getUser()` (not `getSession()`) per Phase 1 security decision
- Use `revalidatePath` to refresh Server Component data after mutations
- Return `{ error }` or `{ success }` -- no redirect (modal stays open until success, then closes)

### Pattern 4: Server Component Data Fetching
**What:** Projects list page fetches data server-side, passes to client components for interactivity.

```typescript
// src/app/(dashboard)/projects/page.tsx
export default async function ProjectsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: projects } = await supabase
    .from('projects')
    .select('*, jobs(count)')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  return <ProjectsPageClient projects={projects ?? []} />
}
```

The `select('*, jobs(count)')` syntax returns a `jobs` array with `[{ count: N }]` -- this gives job counts without fetching all job data.

### Pattern 5: Dialog-Based Creation
**What:** shadcn Dialog wrapping a form with useActionState.

The Dialog component in shadcn v4 uses Base UI under the hood. The pattern:
- Client component wraps Dialog
- Form inside uses `useActionState` with the server action
- On success, close dialog + show toast
- On error, display inline error message

### Pattern 6: Client-Side Sorting
**What:** Simple state-based sorting for the projects table.

For MVP with a single user's projects (likely <100), client-side sorting is appropriate:
- Store sort column and direction in useState
- Sort the array before rendering
- Toggle direction on column header click
- No need for URL params or server-side sorting at this scale

### Anti-Patterns to Avoid
- **Fetching in client components:** Do NOT use `useEffect` + client Supabase for initial data. Server Components fetch data, client components handle interactivity.
- **Skipping RLS:** Never use service role key on the client. RLS with anon key ensures data isolation.
- **Separate API routes for simple CRUD:** Server actions are simpler than route handlers for form mutations.
- **Nested layouts for projects:** Don't create `projects/layout.tsx` unless shared UI exists -- each page is self-contained.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Modal dialogs | Custom portal + overlay | shadcn Dialog | Focus trap, a11y, animation, escape handling |
| Data tables | Custom table markup | shadcn Table components | Consistent styling, proper semantic HTML |
| Dropdown selects | Custom dropdown | shadcn Select | Keyboard nav, a11y, portal positioning |
| Toast notifications | Custom notification system | Sonner (already installed) | Already works, queuing, auto-dismiss |
| Form state management | Custom useState tracking | useActionState (React 19) | Handles pending state, error state, progressive enhancement |
| UUID generation | Custom ID scheme | Supabase gen_random_uuid() | Database-level, no client dependency |

## Common Pitfalls

### Pitfall 1: Forgetting revalidatePath After Mutations
**What goes wrong:** User creates a project, dialog closes, but the list doesn't update.
**Why it happens:** Server actions don't automatically refresh Server Component data.
**How to avoid:** Always call `revalidatePath('/projects')` after insert/update/delete.
**Warning signs:** Stale data after form submission; user needs to manually refresh.

### Pitfall 2: Not Setting user_id in INSERT
**What goes wrong:** RLS blocks the insert because `auth.uid() = user_id` check fails.
**Why it happens:** Developer forgets to include `user_id: user.id` in the insert payload.
**How to avoid:** Always set `user_id` explicitly in server actions. Could also use a database trigger, but explicit is clearer.

### Pitfall 3: Dialog Not Closing After Successful Submission
**What goes wrong:** Form submits successfully but dialog stays open.
**Why it happens:** useActionState doesn't have built-in dialog integration.
**How to avoid:** Use a useEffect that watches the action state -- when success becomes true, close the dialog and reset form.

### Pitfall 4: Missing Indexes on Foreign Keys
**What goes wrong:** Slow queries when listing projects by user or jobs by project.
**Why it happens:** PostgreSQL doesn't auto-create indexes on FK columns.
**How to avoid:** Explicitly create indexes on `user_id` and `project_id` columns.

### Pitfall 5: Empty State Not Handled
**What goes wrong:** Blank page when user has no projects or a project has no jobs.
**Why it happens:** Only coding the "has data" path.
**How to avoid:** Design empty states first -- they're the first thing new users see. Include CTA to create first project/job.

### Pitfall 6: Survey Type as Free Text
**What goes wrong:** Inconsistent survey type values that break downstream template matching.
**Why it happens:** Using a text input instead of a constrained select.
**How to avoid:** Use a Select dropdown with fixed values. Define survey types as a TypeScript const array and reuse for both UI and validation.

## Code Examples

### Survey Type Constants
```typescript
// src/lib/types/projects.ts
export const SURVEY_TYPES = [
  'DOB',
  'DOC',
  'TOP',
  'Event Listing',
  'Pipeline Position',
  'ROVV',
] as const

export type SurveyType = typeof SURVEY_TYPES[number]

export const PROJECT_STATUSES = ['active', 'completed', 'archived'] as const
export type ProjectStatus = typeof PROJECT_STATUSES[number]

export const JOB_STATUSES = ['pending', 'processing', 'completed', 'failed'] as const
export type JobStatus = typeof JOB_STATUSES[number]

export interface Project {
  id: string
  user_id: string
  name: string
  description: string | null
  status: ProjectStatus
  created_at: string
  updated_at: string
  jobs: { count: number }[]
}

export interface Job {
  id: string
  project_id: string
  user_id: string
  name: string
  survey_type: SurveyType
  description: string | null
  status: JobStatus
  created_at: string
  updated_at: string
}
```

### Supabase Count Query
```typescript
// Fetch projects with job counts
const { data: projects } = await supabase
  .from('projects')
  .select('*, jobs(count)')
  .eq('user_id', user.id)
  .order('updated_at', { ascending: false })

// Access count: projects[0].jobs[0].count
```

### Top Bar Nav Update
```typescript
// In src/components/top-bar.tsx, update navItems:
import { LayoutDashboard, FolderOpen, Settings } from "lucide-react"

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderOpen },
  { href: "/settings", label: "Settings", icon: Settings },
]
```

### URL Structure
```
/projects              → Projects list page (PROJ-03)
/projects/[projectId]  → Project detail with jobs (PROJ-04)
```

Using `[projectId]` (UUID) in the URL. Clean and standard Next.js dynamic routing.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| API route handlers for CRUD | Server Actions with useActionState | Next.js 14+ / React 19 | Less boilerplate, progressive enhancement |
| Client-side data fetching (SWR/React Query) | Server Components | Next.js 13+ App Router | No loading spinners for initial data |
| Custom form state (useState) | useActionState | React 19 | Built-in pending/error states |
| shadcn/ui v0 (Radix) | shadcn/ui v4 (Base UI) | 2025 | Different API -- render props, `render` prop instead of `asChild` |

## Open Questions

1. **Supabase migration application method**
   - What we know: Project has `supabase/migrations/00001_profiles.sql` but unclear if using Supabase CLI or manual SQL execution
   - What's unclear: Whether `supabase db push` or manual Dashboard SQL editor is the workflow
   - Recommendation: Create migration file regardless; document both application methods in task instructions

2. **TypeScript types from Supabase**
   - What we know: Supabase can auto-generate TypeScript types via `supabase gen types typescript`
   - What's unclear: Whether project uses generated types or manual interfaces
   - Recommendation: Use manual interfaces for now (simpler, no CLI dependency). Can generate later.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 + Testing Library React 16.3.2 |
| Config file | `vitest.config.ts` (exists) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROJ-01 | Create project server action validates input and inserts | unit | `npx vitest run tests/actions/projects.test.ts -t "create project"` | No - Wave 0 |
| PROJ-02 | Create job server action validates input and inserts with survey type | unit | `npx vitest run tests/actions/projects.test.ts -t "create job"` | No - Wave 0 |
| PROJ-03 | Projects page renders project list with status | unit | `npx vitest run tests/components/projects-table.test.tsx` | No - Wave 0 |
| PROJ-04 | Project detail page renders jobs list | unit | `npx vitest run tests/components/jobs-list.test.tsx` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/actions/projects.test.ts` -- covers PROJ-01, PROJ-02 (server action unit tests require Supabase mocking)
- [ ] `tests/components/projects-table.test.tsx` -- covers PROJ-03
- [ ] `tests/components/jobs-list.test.tsx` -- covers PROJ-04

Note: Server action tests require mocking `@/lib/supabase/server`. Use `vi.mock()` to provide a mock Supabase client that returns controlled data. Component tests can render with mock data props directly.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `supabase/migrations/00001_profiles.sql` -- established RLS and schema patterns
- Existing codebase: `src/lib/actions/auth.ts` -- established server action patterns
- Existing codebase: `src/app/(dashboard)/layout.tsx` -- established data fetching pattern
- Existing codebase: `src/components/top-bar.tsx` -- established nav pattern
- Existing codebase: `package.json` -- confirmed all dependency versions

### Secondary (MEDIUM confidence)
- Supabase documentation on RLS policies and foreign key relationships
- shadcn/ui v4 component APIs (Dialog, Table, Select)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in project, just adding shadcn components
- Architecture: HIGH - follows established Phase 1 patterns exactly
- Pitfalls: HIGH - common Supabase + Next.js CRUD issues, well-documented
- Database schema: HIGH - standard relational design, follows existing profiles migration pattern

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable stack, no fast-moving dependencies)
