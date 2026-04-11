# Phase 7: Async Processing - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Phase Boundary

File processing (validation) runs in the background with real-time status updates so users are never stuck waiting. Users can navigate freely while processing runs, see live status updates, and receive notifications on completion or failure. This phase converts the existing synchronous validation flow to async. Parsing is already fire-and-forget and stays as-is. Cancel, retry queues, and notification persistence are out of scope for MVP.

</domain>

<decisions>
## Implementation Decisions

### Status Delivery
- Supabase Realtime subscriptions for status updates — zero new infrastructure
- Track state transitions only (queued → processing → complete → failed), not granular step progress
- App-wide subscription at the layout/shell level — works regardless of which page user is on
- Filter subscription to datasets in 'validating' status only — minimal traffic, fires only when something is processing

### Notification Style
- Sonner toast popups — already used throughout the app, no new UI components
- Success toast includes quick summary: "Validation complete — 3 critical, 5 warnings — View results" with clickable link to file detail page
- Failure toast includes short error reason + link: "Validation failed: [brief reason] — View details"
- No bell icon, no browser push notifications, no email — toast is sufficient for MVP

### Queue & Trigger
- Fire-and-forget HTTP from Next.js API route to FastAPI — returns 202 Accepted immediately
- FastAPI processes in background and writes results directly to Supabase
- If FastAPI is unreachable (connection refused, 5xx), return immediate error to user — no silent failures, no retry logic
- Async scope is validation only — parsing already works as fire-and-forget
- No cancel button for MVP — validation runs to completion or failure

### Navigation Experience
- Animated status badge (pulsing/spinning) on file list when file is processing — clear at a glance
- No global processing indicator in top bar or sidebar — toast notifications are sufficient for MVP
- Auto-restore on return: file detail page loads status from DB, Realtime subscription picks up live changes, shows results immediately if already complete
- File list auto-updates via Realtime — status badge changes from 'Processing...' to 'Validated' live without page reload

### Claude's Discretion
- Supabase Realtime subscription implementation details (channel setup, filter syntax)
- How to restructure the validate API route for fire-and-forget (background task in FastAPI vs thread)
- Toast component configuration for action links
- How the app-wide Realtime provider integrates with the existing layout
- RLS policy adjustments needed for Realtime subscriptions
- How file-detail-view.tsx refactors from awaiting response to listening for Realtime updates

</decisions>

<specifics>
## Specific Ideas

- Toast with summary gives users an instant sense of urgency — "3 critical" means look now, "0 critical, 2 info" means look later
- The clickable link in the toast is key UX — one click from notification to results, regardless of where user is in the app
- Animated badge on file list creates a sense of activity — the system is working, not frozen
- Auto-restore means no "refresh to see results" friction — page always reflects current state

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ValidationProgress` component (src/components/files/validation-progress.tsx) — simple spinner + text, can be reused for the processing state
- `ValidationSummary` component — already displays run results, no changes needed
- Sonner toast (already integrated) — needs action link pattern added
- Badge component — needs animated/pulsing variant for processing state
- `validation_runs` table — already has `status` field fitting the state machine

### Established Patterns
- Client orchestrator pattern in `FileDetailView` — manages validation state locally, needs refactor to use Realtime
- Server Components for data fetching, Client Components for interactivity
- API routes at `src/app/api/` proxying to FastAPI — validate route needs fire-and-forget refactor
- Dataset status progression: uploaded → parsing → parsed → mapped → validating → validated

### Integration Points
- `src/app/api/validate/route.ts` — currently synchronous (awaits FastAPI response), needs to return 202 immediately
- `src/components/files/file-detail-view.tsx` — `handleRunValidation()` awaits response, needs to fire-and-forget + subscribe to Realtime
- FastAPI `validate` endpoint — needs to run processing in background (not block the HTTP response)
- App layout (shell level) — add Realtime subscription provider for dataset status changes
- `src/components/files/file-list.tsx` — add Realtime subscription for live status badge updates
- Supabase RLS — may need policy adjustments to allow Realtime subscriptions on datasets table

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-async-processing*
*Context gathered: 2026-03-12*
