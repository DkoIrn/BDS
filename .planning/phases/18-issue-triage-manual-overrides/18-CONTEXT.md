# Phase 18: Issue Triage & Manual Overrides - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a "Review" stage to the pipeline between Validate and Clean where users can accept, reject, or defer individual QC issues with justifications. Includes bulk actions for managing multiple issues at once. Only accepted issues feed forward into the Clean stage. This phase does NOT add new validation rules or cleaning capabilities — it adds a human review layer to the existing pipeline flow.

</domain>

<decisions>
## Implementation Decisions

### Triage Placement
- New 6th pipeline stage called "Review" between Validate and Clean
- Pipeline becomes: Import → Inspect → Validate → Review → Clean → Export
- Optional with nudge — if skipped, show warning ("X issues not reviewed") consistent with smart gating pattern
- Auto-skip with toast message when validation found 0 issues ("No issues found — skipping review")
- Shows all issues with severity filter tabs (All / Critical / Warning / Info), reusing existing IssuesTable pattern

### Issue Actions & Flow
- Three actions per issue: Accept, Reject, Defer
  - Accept = "real issue, fix it in Clean"
  - Reject = "false positive, ignore"
  - Defer = "acknowledged but not fixing now"
- Justification required for Reject, optional for Accept and Defer
- Inline action buttons on each row (right-aligned), clicking Reject opens inline comment field
- Acted-on issues get status badge + subtle row styling (green border/tint = accepted, red = rejected, amber = deferred)
- Issues stay visible in list after being acted on (no moving to separate tabs)

### Bulk Operations
- Checkbox on each row, "select all" checkbox in header
- Floating action toolbar appears when >=1 issue selected
- Bulk actions: Accept All / Reject All / Defer All (same three actions as individual)
- Bulk reject prompts for a single shared justification applied to all selected issues
- Progress bar + counts at top of stage: "Reviewed: 12/45 issues — 8 accepted, 3 rejected, 1 deferred"

### Triage Gating
- Stage complete when all issues have a decision (accept/reject/defer) — stepper checkmark at 100%
- Partial review shows progress percentage in stepper
- Accepted issues feed into Clean stage as suggested fixes — rejected/deferred excluded from cleaning
- Users can navigate back to Review from Clean and change decisions (re-editable, consistent with Phase 16 "jump back" pattern)

### Claude's Discretion
- Floating toolbar design and positioning
- Exact color values for status tints (within the existing teal/blue/amber/red palette)
- Animation/transition when applying bulk actions
- Toast notification design for auto-skip
- How inline comment field expands/collapses on Reject

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `IssuesTable` (src/components/files/issues-table.tsx): Severity filtering, expandable rows — extend with action buttons and checkboxes
- `IssueRowDetail` (src/components/files/issue-row-detail.tsx): Expected/actual values, context rows — reuse for expanded issue details
- `stage-clean.tsx` accept/reject pattern: handleAcceptSuggestion/handleRejectSuggestion with audit logging — mirror this pattern for triage actions
- `Badge` component (src/components/ui/badge.tsx): For status badges on triaged issues
- `Dialog` component (src/components/ui/dialog.tsx): For bulk reject justification modal
- Pipeline reducer (src/app/(dashboard)/pipeline/lib/pipeline-state.ts): Extend with Review stage and triage state

### Established Patterns
- Pipeline stages use dispatch actions via useReducer (Redux-style)
- Audit logging via `audit_logs` table with JSONB metadata
- Severity colors: red (critical), amber (warning), blue (info), green (passing)
- Stage components follow a consistent layout pattern with summary cards + main content

### Integration Points
- Pipeline stepper (pipeline-stepper.tsx): Add 6th "Review" step
- Pipeline state (pipeline-state.ts): Add Review stage type, triage decisions to state
- Stage gating logic: Add Review stage with optional-with-nudge gating
- Clean stage (stage-clean.tsx): Filter to only accepted issues from triage
- Audit logging: Add triage.accept, triage.reject, triage.defer, triage.bulk_action action types
- Database: New table for issue decisions (issue_id, decision, justification, user_id, timestamps)

</code_context>

<specifics>
## Specific Ideas

- Reuse the existing IssuesTable component as the base — add checkboxes to the left and action buttons to the right of each row
- The progress bar at the top should feel motivating for large datasets (like a task completion tracker)
- Inline comment field for Reject should be a compact text input that expands on the row, not a modal — keep the flow fast for power users triaging many issues
- Bulk actions toolbar should float/stick to the bottom of the viewport when issues are selected (like Gmail's bulk action bar)

</specifics>

<deferred>
## Deferred Ideas

- Pre-filled rejection template options (e.g., "Expected behavior", "False positive", "Out of scope") — nice-to-have for v2
- Issue comment threads (multiple comments per issue) — current scope is single justification per action
- Saving triage decisions as reusable templates across similar datasets

</deferred>

---

*Phase: 18-issue-triage-manual-overrides*
*Context gathered: 2026-04-09 via discuss-phase*
