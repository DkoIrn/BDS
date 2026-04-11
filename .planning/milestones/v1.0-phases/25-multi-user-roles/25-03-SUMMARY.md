---
phase: 25-multi-user-roles
plan: "03"
subsystem: ui
tags: [comments, approval-workflow, state-machine, server-actions, supabase]

requires:
  - phase: 25-multi-user-roles (plan 01)
    provides: Org types (IssueComment, ApprovalStatus, APPROVAL_TRANSITIONS), permissions (requireOrgRole, hasPermission)
provides:
  - Comment CRUD server actions (addComment, getIssueComments, deleteComment)
  - Approval status server actions (getApprovalStatus, updateApprovalStatus, canTransition)
  - IssueComments UI component for threaded issue discussions
  - ApprovalWorkflow UI component for dataset status progression
affects: [reports, audit-trail, notifications]

tech-stack:
  added: []
  patterns: [optimistic-ui-updates, state-machine-transitions, collapsible-comments-disclosure]

key-files:
  created:
    - src/lib/actions/comments.ts
    - src/lib/actions/approval.ts
    - src/components/comments/issue-comments.tsx
    - src/components/approval/approval-workflow.tsx
  modified:
    - src/components/files/issues-table.tsx
    - src/components/files/results-dashboard.tsx
    - src/components/files/file-detail-view.tsx
    - src/app/(dashboard)/projects/[projectId]/jobs/[jobId]/files/[fileId]/page.tsx

key-decisions:
  - "Optimistic UI for comments: add to local state immediately, reconcile on server response"
  - "Approval status fetched via unknown cast on Dataset type since approval_status column added in plan 01 migration"
  - "Comments section is collapsible disclosure inside expanded issue rows to avoid clutter"

patterns-established:
  - "Collapsible comments disclosure inside expanded issue detail rows"
  - "State machine validation via canTransition pure function shared between server and client"

requirements-completed: [TEAM-05]

duration: 6min
completed: 2026-04-11
---

# Phase 25 Plan 03: Issue Commenting & Approval Workflow Summary

**Threaded issue comments with optimistic UI and dataset approval state machine (draft->reviewed->approved->issued) with role-gated transitions**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-11T11:37:58Z
- **Completed:** 2026-04-11T11:43:36Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Comment CRUD server actions with org role authorization and profile join for author names
- Approval status transitions validated against APPROVAL_TRANSITIONS state machine with audit logging
- IssueComments component with optimistic add/delete, relative timestamps, and own-comment-only deletion
- ApprovalWorkflow component with status progression pills and role-gated transition buttons
- Integrated comments into expanded issue rows via collapsible disclosure pattern
- ApprovalWorkflow rendered on file detail page header with org role detection

## Task Commits

Each task was committed atomically:

1. **Task 1: Comment and approval server actions** - `3fad4e6` (feat)
2. **Task 2: Comment thread UI and approval workflow component** - `f24a414` (feat)

## Files Created/Modified
- `src/lib/actions/comments.ts` - Comment CRUD server actions (addComment, getIssueComments, deleteComment)
- `src/lib/actions/approval.ts` - Approval status transitions with state machine validation and audit logging
- `src/components/comments/issue-comments.tsx` - Threaded comment UI with optimistic updates
- `src/components/approval/approval-workflow.tsx` - Approval status badges and transition buttons
- `src/components/files/issues-table.tsx` - Added collapsible comments section to expanded issue rows
- `src/components/files/results-dashboard.tsx` - Passed currentUserId through to IssuesTable
- `src/components/files/file-detail-view.tsx` - Added currentUserId prop passthrough
- `src/app/(dashboard)/projects/[projectId]/jobs/[jobId]/files/[fileId]/page.tsx` - Added ApprovalWorkflow and org role fetch

## Decisions Made
- Optimistic UI for comments: add to local state immediately, reconcile on server response
- Approval status fetched via unknown cast on Dataset type since approval_status column added in plan 01 migration
- Comments section is collapsible disclosure inside expanded issue rows to avoid visual clutter

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Adapted to actual component structure**
- **Found during:** Task 2
- **Issue:** Plan referenced `expandable-issue-row.tsx` which does not exist; actual component is `issues-table.tsx` with `IssueItem` + `issue-row-detail.tsx`
- **Fix:** Integrated comments into `IssueItem` in `issues-table.tsx` instead of the non-existent file
- **Files modified:** src/components/files/issues-table.tsx
- **Verification:** TypeScript compiles, comments section renders in expanded rows
- **Committed in:** f24a414

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Adaptation to actual file structure. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Issue commenting and approval workflow complete
- Approval status changes logged in audit trail for traceability
- Ready for any notifications or reporting features that consume approval events

---
*Phase: 25-multi-user-roles*
*Completed: 2026-04-11*
