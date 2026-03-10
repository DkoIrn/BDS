# Phase 1: Foundation & Auth - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can securely access their accounts within a professionally designed application shell. This phase delivers: Supabase Auth (email/password), the app shell layout (sidebar + top bar), the design system foundation, and the initial database schema. Project management, file upload, and all data features are out of scope.

</domain>

<decisions>
## Implementation Decisions

### App Shell Layout
- Sidebar + top bar layout: left sidebar for main navigation, top bar for breadcrumbs and actions
- Sidebar is collapsible — user can toggle between full labels and icon-only mode
- Top bar contains: breadcrumb trail (left), notification bell (right), user avatar/dropdown (right)
- On tablet breakpoints, sidebar auto-collapses to icon-only mode (user can expand temporarily)

### Auth Page Design
- Split-screen layout: form on the left, brand visual/tagline on the right
- Separate pages for login (/login) and signup (/signup) — distinct routes
- Inline validation errors displayed directly below the field with the issue
- Email verification required after signup — user must click verification link before accessing the app

### Design System
- Component library: shadcn/ui (Radix + Tailwind CSS)
- Color mapping: Deep Blue (#1E3A8A) = primary actions (buttons, links, nav active states), Teal (#14B8A6) = success/positive states, Orange (#F97316) = warnings/attention/CTAs
- Typography: Inter font
- Light mode only for MVP — no dark mode
- Background: #F8FAFC (from brand spec)

### Post-Login Experience
- Phase 1 dashboard shows a welcome message only — no project-related UI until Phase 2 builds it
- No disabled/greyed-out future features shown
- Sidebar label: "Dashboard"
- Sidebar shows only active items: Dashboard + Settings in Phase 1. New nav items appear as phases deliver them

### Claude's Discretion
- Loading skeleton design for auth pages
- Exact spacing, padding, and typography scale
- Error state handling for auth failures (toast vs inline for server errors)
- Notification bell placeholder behavior (no notifications exist until Phase 7)
- Settings page content for Phase 1 (profile info, password change)
- Database schema design for users/profiles tables

</decisions>

<specifics>
## Specific Ideas

- Auth pages should feel polished — split-screen with brand visual gives a professional first impression
- User previously noted sign-in must be "simple and effective" — keep forms minimal, no unnecessary fields
- Notification bell included from the start for visual consistency, even though notifications arrive in Phase 7
- Sidebar collapses to icons to maximize content area for data tables in future phases

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing codebase

### Established Patterns
- None yet — this phase establishes the patterns all future phases will follow

### Integration Points
- Supabase Auth handles signup, login, sessions, password reset, email verification
- Next.js App Router for routing (/login, /signup, /dashboard, /settings)
- shadcn/ui components as the building blocks for all future UI
- Tailwind CSS with custom theme tokens for brand colors

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation-auth*
*Context gathered: 2026-03-10*
