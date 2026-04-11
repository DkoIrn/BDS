# Phase 32: Collaboration (Core) - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Team members stay informed about validation activity through in-app notifications and can communicate via resolvable comments with @mentions. Covers COLB-01 (bell icon + unread count), COLB-03 (comment resolution + filter), COLB-04 (@mention autocomplete + notification). Email notifications and activity feed are Phase 34.

</domain>

<decisions>
## Implementation Decisions

### Notification Panel
- Dropdown popover from bell icon (not slide-out or full page) — click bell opens a floating list below it
- Single chronological list, no tabs or filters — "Mark all read" at the top is the only bulk action
- Click a notification to mark as read + navigate to the relevant item (dataset, issue, comment) — no per-item dismiss buttons
- "View all notifications" link at bottom of dropdown (future full page, or just scrollable list for now)
- Unread badge: exact count up to 9, then "9+" — red dot on bell icon

### Comment Resolution
- Anyone in the org can resolve any comment (Admin, Reviewer, or Viewer)
- Resolved comments collapse to a single line: "[Name] resolved this - [time]" with click-to-expand
- Default view shows unresolved only; "Show resolved (N)" toggle above comments list
- Resolved comments can be reopened by anyone — "Reopen" button on collapsed resolved comments
- Resolving a comment triggers an in-app notification to the comment author

### @Mention Experience
- Inline popup autocomplete on @ keystroke — floating list of org members below cursor, filter by typing
- Arrow keys + Enter or click to select from autocomplete list
- Mentions render as highlighted name chips (blue background pill) — visually distinct from regular text, not clickable (no profile pages yet)
- Enhanced plain text input — keep current textarea, add @mention overlay/detection on top. No rich text editor
- Mentions stored as structured data (user_id reference) in comment content, displayed as resolved names

### Notification Triggers
- Three trigger events: validation complete/failed, @mention in a comment, comment resolved (notifies author)
- Validation notifications go to the triggering user only, not all org members
- Comment notifications are @mention-only — no auto-subscribe to issue comment threads
- Delivery: extend existing Supabase Realtime subscription (RealtimeProvider) for notifications table — increment bell counter + show toast on new notification

### Claude's Discretion
- Notification popover max height and scroll behavior
- Toast notification styling and duration
- Exact @mention autocomplete positioning and keyboard interaction details
- Notifications table schema design (Supabase)
- How to store @mentions in comment content (markup format)
- Notification deduplication logic (if same event fires multiple notifications)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/comments/issue-comments.tsx`: Existing comment component with add/delete — extend with resolve/reopen and @mention support
- `src/lib/actions/comments.ts`: Server actions for addComment, getIssueComments, deleteComment — extend with resolveComment, reopenComment
- `src/components/realtime-provider.tsx`: Global Supabase Realtime subscription for dataset + job events — extend with notifications channel
- `src/components/top-navbar.tsx`: Bell icon already imported from lucide-react — wire up notification dropdown
- `src/components/team/member-list.tsx` + `src/lib/actions/team.ts`: Org member queries — reuse for @mention autocomplete data source
- `src/lib/types/organisations.ts`: IssueComment type — extend with resolved_at, resolved_by fields

### Established Patterns
- Supabase Realtime for push updates (dataset status, job progress) — same pattern for notification delivery
- Optimistic UI updates in comments (add comment before server confirms) — apply same pattern for resolve/reopen
- Server actions with `requireOrgRole` permission checks — same pattern for notification and comment resolution actions
- Toast notifications via sonner — reuse for notification toasts

### Integration Points
- `src/components/top-navbar.tsx`: Add notification dropdown next to existing bell icon
- `src/components/comments/issue-comments.tsx`: Add resolve/reopen buttons, @mention input, resolved filter toggle
- `src/components/realtime-provider.tsx`: Add notifications table subscription
- `src/app/(dashboard)/layout.tsx`: RealtimeProvider already wraps dashboard — notifications will work globally
- `supabase/migrations/`: New notifications table, add resolved_at/resolved_by columns to issue_comments

</code_context>

<specifics>
## Specific Ideas

- Notification panel should feel like GitHub's notification dropdown — quick glance without leaving the page
- Resolved comments should collapse like GitHub PR review comments — one-line summary, expand to see full content
- @mention autocomplete should match Slack's behavior — popup appears on @, narrows as you type
- Keep notification volume low for v1.1 — only intentional events (validation, @mentions, resolution), not auto-subscriptions

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 32-collaboration-core*
*Context gathered: 2026-04-11*
