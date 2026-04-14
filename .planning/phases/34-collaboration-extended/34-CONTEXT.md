# Phase 34: Collaboration (Extended) - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Users receive email notifications for critical events and can track project activity in a chronological feed. Extends Phase 32's in-app notification infrastructure with email delivery via Resend and a new project-scoped activity feed. Covers COLB-02 (email notifications with toggles) and COLB-05 (project activity feed).

</domain>

<decisions>
## Implementation Decisions

### Email Notifications
- All four notification types trigger emails: validation_complete, validation_failed, mention, comment_resolved
- Emails send immediately per event (no digest/batching)
- Branded HTML email template: TruQC logo, brand colours, styled layout — professional SaaS notification email
- Each email includes a "Manage notification preferences" link to /settings (no per-category unsubscribe in the email itself)
- Email delivery via Resend (already in project stack for transactional email)

### Notification Preferences
- New "Notifications" card section added to the existing /settings page
- Two toggle switches per category: In-App and Email (8 toggles total for 4 categories)
- Toggle switch UI (iOS-style on/off), not checkboxes — two columns: In-App | Email
- All notifications on by default for new users (both in-app and email)
- Preferences stored per-user in a new notification_preferences table (or user metadata)

### Activity Feed
- Lives on each project detail page as a section/tab — project-scoped per COLB-05
- Vertical timeline layout with coloured icons per event type, actor name, timestamp, one-line description (GitHub repo activity style)
- Events: validations, fixes/cleaning, comments, report exports, certificate generation — all major actions
- Filter chips at top to toggle event types on/off (user decides what to see)
- Shows last 20 events with "Load more" button for older activity
- New activity_events table to log events as they happen

### Claude's Discretion
- Email template exact layout and spacing
- activity_events table schema design
- notification_preferences storage approach (separate table vs user metadata)
- Timeline icon colours per event type
- Filter chip default state (all on)
- How activity events are created (triggers, server action hooks, or explicit logging)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/actions/notifications.ts`: createNotification() server action — hook email sending into this flow
- `src/lib/types/notifications.ts`: NotificationType union — same 4 types for email categories
- `src/components/notifications/`: Bell, popover, item components — established notification UI patterns
- `src/components/realtime-provider.tsx`: Supabase Realtime subscription — can extend for activity feed live updates
- `src/app/(dashboard)/settings/page.tsx`: Settings page with card sections — add Notifications card here

### Established Patterns
- Supabase Realtime for push updates (dataset status, job progress, notifications)
- Server actions with `requireOrgRole` permission checks
- Toast notifications via sonner for immediate feedback
- Card-based settings layout with sections

### Integration Points
- `src/lib/actions/notifications.ts`: Add email dispatch after in-app notification creation
- `src/app/(dashboard)/settings/page.tsx`: Add Notifications preferences section
- `src/app/(dashboard)/projects/[projectId]/page.tsx`: Add Activity tab/section to project detail
- `supabase/migrations/`: New activity_events table, new notification_preferences table
- Resend SDK: New dependency for email sending from Next.js API routes or server actions

</code_context>

<specifics>
## Specific Ideas

- Email template should match TruQC brand (Space Grotesk headings, brand colours, logo) — polished like Stripe or Linear notification emails
- Activity feed timeline should feel like GitHub's repository activity — clean icons, actor names, clear event descriptions
- Notification preferences should look like a modern SaaS settings panel with clean toggle rows

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 34-collaboration-extended*
*Context gathered: 2026-04-14*
