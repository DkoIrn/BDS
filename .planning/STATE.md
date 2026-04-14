---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Production-Grade QC Platform
status: completed
stopped_at: Phase 35 context gathered
last_updated: "2026-04-14T22:34:29.393Z"
last_activity: 2026-04-14 -- Completed 34-02 notification preferences and activity feed UI
progress:
  total_phases: 9
  completed_phases: 5
  total_plans: 12
  completed_plans: 10
  percent: 91
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-11)

**Core value:** Engineers can upload survey data and receive automated QC reports with every flagged issue explained -- replacing hours of manual checking with minutes of automated validation.
**Current focus:** Phase 34 -- Collaboration Extended (email notifications, preferences, activity feed)

## Current Position

Phase: 34 of 37 (Collaboration Extended)
Plan: 2 of 2 complete
Status: Phase complete
Last activity: 2026-04-14 -- Completed 34-02 notification preferences and activity feed UI

Progress: [█████████░] 91%

## Accumulated Context

### Decisions

See PROJECT.md Key Decisions table for full history.

- v1.1 roadmap: Use procrastinate (PostgreSQL-backed) for job queue, not Redis/ARQ
- v1.1 roadmap: Certificates split into basic (Phase 31) and verification (Phase 33) with versioning in between
- v1.1 roadmap: Custom rule builder before context-aware QC (shared conditional logic patterns)
- 29-01: Use InMemoryConnector fallback when DATABASE_URL not set (dev/test safety)
- 29-01: Lazy imports in task body for heavy deps (pandas/validators) to keep module import fast
- 29-01: USE_JOB_QUEUE defaults false for safe production transition
- 29-02: Validate routes set status to "queued" not "validating" -- queue task handles transitions
- 29-02: Stage-based progress maps discrete stages to percentage ranges for smooth UX
- 29-02: Realtime provider keeps existing dataset subscription for backward compat with USE_JOB_QUEUE=false
- 32-01: MENTION_REGEX broadened to [a-zA-Z0-9-] for any UUID format
- 32-01: Notification dedup via UNIQUE(user_id, type, resource_type, resource_id) -- duplicates silently succeed
- 32-01: getIssueComments defaults to 'unresolved' filter for backward compatibility
- 32-01: Org-wide resolve RLS policy coexists with existing owner-only update policy
- 30-01: MAX_VERSIONS = 10 with prune-oldest-first strategy
- 30-01: Position-based row diff (not key-based) for simplicity with survey data
- 30-01: Non-blocking snapshot: try/except wrapper so validation never fails due to versioning
- 32-02: Custom DOM event pattern (truqc:new-notification) for Realtime-to-component communication
- 32-02: Optimistic UI for comment resolve/reopen with error-based refetch fallback
- 32-02: Badge shows exact count up to 9 then 9+ for compact visual
- 30-02: Trend summary compares first vs latest version for issue trend and row count change
- 30-02: Sticky footer bar appears only when exactly 2 versions selected for comparison
- 30-02: Position-based inline diff format: column: old_value -> new_value for modified rows
- 33-01: Verify endpoint returns 200 for all states (active/revoked/not_found) to prevent enumeration timing attacks
- 33-01: Revoked certificates omit dataset details, showing only ID, status, revoked_at, and reason
- 33-01: QR code positioned at (175, 15) with 25mm width, ERROR_CORRECT_M for balance of size and resilience
- 33-01: Cache-Control: no-store on all verify responses to prevent stale verification results
- 33-02: Public verify page uses server component with force-dynamic to ensure revocation is always current
- 33-02: Copy-to-clipboard button extracted as client component to keep verify page as server component
- 33-02: Reports tab navigation uses client component with usePathname for active tab detection
- 34-01: Resend client lazy singleton with graceful RESEND_API_KEY fallback (no-op in dev/test)
- 34-01: In-app preference OFF skips notification row insert entirely (not insert-then-mark-read)
- 34-01: Email dispatch fire-and-forget via .catch(console.error) to never block notification creation
- 34-01: Preferences default to all-enabled when no row exists (row created on first change)
- 34-02: iOS-style shadcn Switch toggles for notification preferences with optimistic UI and error rollback
- 34-02: Client-side relative timestamp formatting for activity items (no server roundtrip)
- 34-02: Client-side event filtering via filter chips rather than server-side re-fetch

### Roadmap Evolution

v1.0 shipped 28 phases. v1.1 adds 9 phases (29-37) covering reliability, workflow depth, and differentiation layers.

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-04-14T22:34:29.381Z
Stopped at: Phase 35 context gathered
Resume file: .planning/phases/35-cross-dataset-validation/35-CONTEXT.md
