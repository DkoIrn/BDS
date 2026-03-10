# Phase 2: Project Structure - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can organize their survey work into projects and jobs. This phase delivers: project CRUD, job CRUD within projects, project list page, project detail page with jobs. File upload is out of scope (Phase 3). No sidebar — app uses top bar navigation only.

</domain>

<decisions>
## Implementation Decisions

### Projects List Page
- Table/list view with sortable columns: name, status, jobs count, last updated
- Clean, minimalistic design consistent with the top-bar-only layout established in Phase 1
- "+ New Project" button prominently placed

### Create Project Flow
- Modal/dialog triggered by "+ New Project" button
- Stays in context — no page navigation required
- Fields:
  - Name (required) — e.g., "Pipeline Survey - North Sea Block 21"
  - Description (optional) — notes about project scope or client

### Project Detail Page
- Shows project name, description, and list of survey jobs
- Jobs displayed within the project context
- Drill-down from project list → project detail → jobs

### Survey Jobs
- Created within a project context
- Fields:
  - Job name (required) — e.g., "Phase 1 DOB Survey" or "As-Built Inspection"
  - Survey type (dropdown): DOB, DOC, TOP, Event Listing, Pipeline Position, ROVV
  - Description/notes (optional) — free text about job scope
- Survey type selection helps pre-select validation templates in later phases

### Navigation
- Add "Projects" to the top bar navigation (between Dashboard and Settings)
- No sidebar — minimalistic top bar layout from Phase 1

### Claude's Discretion
- Table sorting implementation (client-side vs server-side)
- Project/job status values and transitions
- Empty states (no projects yet, no jobs in project)
- Job creation UI (modal vs inline)
- URL structure for project detail pages
- Database schema design for projects and jobs tables
- RLS policies for projects and jobs

</decisions>

<specifics>
## Specific Ideas

- Keep the modern, minimalistic feel established in Phase 1
- Table view chosen over cards for the projects list — efficient for scanning many items
- Modal for project creation keeps workflow snappy
- Survey type on jobs is important — it connects to validation templates in Phase 6
- Status summaries on projects page per PROJ-03

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- Top bar component (src/components/top-bar.tsx) — needs "Projects" nav item added
- Supabase server/client setup (src/lib/supabase/server.ts, client.ts)
- Server actions pattern (src/lib/actions/auth.ts) — use same pattern for project/job actions
- shadcn/ui components: Card, Button, Input, Label, DropdownMenu
- Brand color system in globals.css

### Established Patterns
- Server Components for data fetching, Client Components for interactivity
- useActionState (React 19) for form handling
- Sonner toast for success/error feedback
- getUser() for server-side auth checks

### Integration Points
- Dashboard layout (src/app/(dashboard)/layout.tsx) wraps all authenticated pages
- Top bar navItems array needs Projects entry
- Supabase RLS for data isolation between users

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-project-structure*
*Context gathered: 2026-03-10*
