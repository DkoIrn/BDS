---
phase: 34-collaboration-extended
plan: 01
subsystem: notifications, email, activity
tags: [resend, react-email, notification-preferences, activity-feed, supabase-rls]

requires:
  - phase: 32-collaboration
    provides: notifications table, createNotification server action, Realtime subscription, bell UI
provides:
  - Email notification dispatch via Resend with branded React Email template
  - Notification preferences table and CRUD server actions with all-on defaults
  - Activity events table with RLS and server actions for logging and querying
  - Preference-gated notification flow (in_app controls insert, email controls dispatch)
affects: [34-02-collaboration-extended-frontend, settings-page, project-detail-page]

tech-stack:
  added: [resend, "@react-email/components"]
  patterns: [fire-and-forget email dispatch, preference-gated notification insertion, cursor-based activity pagination]

key-files:
  created:
    - supabase/migrations/20260414_activity_and_preferences.sql
    - src/lib/types/activity.ts
    - src/emails/notification-email.tsx
    - src/lib/email.ts
    - src/lib/actions/notification-preferences.ts
    - src/lib/actions/activity.ts
    - tests/collaboration/email-notifications.test.ts
    - tests/collaboration/notification-preferences.test.ts
    - tests/collaboration/activity-logging.test.ts
  modified:
    - src/lib/types/notifications.ts
    - src/lib/actions/notifications.ts
    - tests/collaboration/notification-actions.test.ts

key-decisions:
  - "Resend client uses lazy singleton with graceful RESEND_API_KEY fallback (no-op in dev/test)"
  - "In-app preference OFF skips notification row insert entirely (not insert-then-mark-read)"
  - "Email dispatch is fire-and-forget via .catch(console.error) to never block notification creation"
  - "Preferences default to all-enabled when no row exists (row created only on first explicit change)"

patterns-established:
  - "Fire-and-forget email: sendNotificationEmail(...).catch(console.error) pattern"
  - "Preference-gated notification: check prefs before insert + before email dispatch"
  - "Activity logging: explicit logActivity() calls in server actions (not DB triggers)"
  - "Cursor-based pagination: .lt('created_at', before) for activity feed"

requirements-completed: [COLB-02, COLB-05]

duration: 6min
completed: 2026-04-14
---

# Phase 34 Plan 01: Collaboration Extended Backend Summary

**Email notification dispatch via Resend with branded template, notification preference CRUD with all-on defaults, and activity event logging with cursor pagination**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-14T13:00:46Z
- **Completed:** 2026-04-14T13:07:14Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Resend email service with branded React Email template (TruQC logo, Space Grotesk heading, dark CTA button)
- notification_preferences and activity_events tables with RLS policies and Realtime publication
- createNotification now checks in_app preference before inserting and email preference before dispatching
- All 76 collaboration tests pass including 18 new tests for email, preferences, and activity

## Task Commits

Each task was committed atomically:

1. **Task 1: Migration, types, and email service** - `a2eddd8` (feat)
2. **Task 2: Server actions -- preferences, activity logging, and email dispatch** - `ff29ae1` (feat)

## Files Created/Modified
- `supabase/migrations/20260414_activity_and_preferences.sql` - notification_preferences and activity_events tables with RLS
- `src/lib/types/notifications.ts` - Added NotificationPreferences, NotificationPreferenceChannel, DEFAULT_PREFERENCES
- `src/lib/types/activity.ts` - ActivityEventType union and ActivityEvent/ActivityEventWithActor interfaces
- `src/emails/notification-email.tsx` - Branded React Email template with logo, fonts, CTA, and preferences link
- `src/lib/email.ts` - Resend client singleton with sendNotificationEmail helper and graceful fallback
- `src/lib/actions/notification-preferences.ts` - getNotificationPreferences and updateNotificationPreferences server actions
- `src/lib/actions/activity.ts` - logActivity (fire-and-forget) and getProjectActivity (with cursor pagination)
- `src/lib/actions/notifications.ts` - Modified createNotification with preference checks and email dispatch
- `tests/collaboration/email-notifications.test.ts` - 5 tests for Resend send and template rendering
- `tests/collaboration/notification-preferences.test.ts` - 8 tests for preferences CRUD and email dispatch gating
- `tests/collaboration/activity-logging.test.ts` - 5 tests for activity logging and feed querying
- `tests/collaboration/notification-actions.test.ts` - Updated existing test for new multi-table createNotification flow

## Decisions Made
- Resend client uses lazy singleton with graceful RESEND_API_KEY fallback (no-op in dev/test)
- In-app preference OFF skips notification row insert entirely (not insert-then-mark-read) per research pitfall #6
- Email dispatch is fire-and-forget via .catch(console.error) to never block notification creation
- Preferences default to all-enabled when no row exists (row created only on first explicit change)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated existing notification-actions test mock for new createNotification flow**
- **Found during:** Task 2 (full test suite run)
- **Issue:** Existing createNotification test used mockReturnValueOnce for a single from() call, but createNotification now calls from() multiple times (notification_preferences, notifications, profiles)
- **Fix:** Changed mock to use mockImplementation dispatching by table name; added email module mock
- **Files modified:** tests/collaboration/notification-actions.test.ts
- **Verification:** All 76 collaboration tests pass
- **Committed in:** ff29ae1 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Test mock update necessary for correctness. No scope creep.

## Issues Encountered
- Vitest Resend mock required `function` keyword syntax (not arrow function) since Resend is instantiated with `new`. Fixed by using named function in mock factory.

## User Setup Required

External services require manual configuration:
- **RESEND_API_KEY**: Required for email delivery. Get from Resend Dashboard (resend.com) -> API Keys -> Create API Key
- **Domain verification**: Verify truqc.co.uk in Resend Dashboard -> Domains -> Add Domain (SPF, DKIM, DMARC DNS records)
- Email service gracefully degrades when RESEND_API_KEY is not set (logs warning, skips send)

## Next Phase Readiness
- Backend infrastructure complete for Plan 02 (frontend)
- Notification preferences CRUD ready for settings page toggle UI
- Activity feed server actions ready for timeline component on project detail page
- Email template renders correctly; needs RESEND_API_KEY for production delivery

---
*Phase: 34-collaboration-extended*
*Completed: 2026-04-14*
