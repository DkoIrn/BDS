# Phase 34: Collaboration (Extended) - Research

**Researched:** 2026-04-14
**Domain:** Email notifications (Resend SDK), notification preferences UI, project activity feed
**Confidence:** HIGH

## Summary

Phase 34 extends the Phase 32 in-app notification system with two features: (1) email notifications via Resend for all four notification types with per-category toggle preferences, and (2) a project-scoped activity feed showing a chronological timeline of actions. The project already has a complete notification infrastructure (notifications table, createNotification() server action, Realtime subscriptions, bell UI) that email sending hooks into cleanly. Resend is referenced in project memory as the transactional email provider but is NOT yet installed as an npm dependency -- it needs to be added.

The implementation is straightforward: install `resend` + `@react-email/components`, create a branded HTML email template as a React component, add email dispatch logic inside the existing `createNotification()` flow (check preferences first, then send), build a notification preferences UI on the settings page, create a new `activity_events` table for the feed, and build the timeline component on the project detail page.

**Primary recommendation:** Hook email sending into the existing createNotification() server action with a preference check gate. Use `@react-email/components` for the branded template. Create activity events via explicit logging calls in existing server actions (not database triggers).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- All four notification types trigger emails: validation_complete, validation_failed, mention, comment_resolved
- Emails send immediately per event (no digest/batching)
- Branded HTML email template: TruQC logo, brand colours, styled layout
- Each email includes a "Manage notification preferences" link to /settings
- Email delivery via Resend
- New "Notifications" card section on existing /settings page
- Two toggle switches per category: In-App and Email (8 toggles total)
- Toggle switch UI (iOS-style on/off), not checkboxes -- two columns: In-App | Email
- All notifications on by default for new users
- Activity feed on each project detail page as a section/tab
- Vertical timeline layout with coloured icons per event type, actor name, timestamp, one-line description
- Events: validations, fixes/cleaning, comments, report exports, certificate generation
- Filter chips at top to toggle event types on/off
- Shows last 20 events with "Load more" button
- New activity_events table

### Claude's Discretion
- Email template exact layout and spacing
- activity_events table schema design
- notification_preferences storage approach (separate table vs user metadata)
- Timeline icon colours per event type
- Filter chip default state (all on)
- How activity events are created (triggers, server action hooks, or explicit logging)

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| COLB-02 | User receives email notifications for job failures and @mentions (toggle on/off per category) | Resend SDK for email delivery, notification_preferences table for toggles, hook into createNotification() |
| COLB-05 | User can view a project-scoped activity feed showing recent actions (validations, fixes, comments, exports) | New activity_events table, timeline component on project detail page, filter chips UI |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| resend | ^6.11.0 | Email sending API | Already chosen by project for transactional email; simple SDK with `resend.emails.send()` |
| @react-email/components | ^0.0.31 | React components for email templates | Official companion to Resend; renders React to email-safe HTML; used by Stripe/Linear/Vercel |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @react-email/render | ^1.0.5 | Render React email to HTML string | If sending from server actions where JSX needs to be converted to HTML string first |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @react-email/components | Raw HTML string template | React Email gives type-safe, responsive email components; raw HTML is error-prone for email clients |
| Separate preferences table | JSONB column on profiles | Separate table is cleaner, avoids schema migration on profiles, easier to query |
| Database triggers for activity events | Explicit logging in server actions | Triggers couple DB schema to logging; explicit calls are more controllable and testable |

**Installation:**
```bash
npm install resend @react-email/components
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── emails/                              # React Email templates
│   └── notification-email.tsx           # Branded notification template
├── lib/
│   ├── actions/
│   │   ├── notifications.ts             # MODIFY: add email dispatch after insert
│   │   ├── notification-preferences.ts  # NEW: get/update preferences
│   │   └── activity.ts                  # NEW: log + fetch activity events
│   ├── email.ts                         # NEW: Resend client singleton + send helper
│   └── types/
│       ├── notifications.ts             # MODIFY: add preference types
│       └── activity.ts                  # NEW: activity event types
├── components/
│   ├── settings/
│   │   └── notification-preferences.tsx # NEW: toggles card for settings page
│   └── activity/
│       ├── activity-feed.tsx            # NEW: timeline container
│       ├── activity-item.tsx            # NEW: single timeline event
│       └── activity-filters.tsx         # NEW: filter chips
└── app/(dashboard)/
    ├── settings/page.tsx                # MODIFY: add notification preferences card
    └── projects/[projectId]/page.tsx    # MODIFY: add activity feed section
supabase/
└── migrations/
    └── 20260414_activity_and_preferences.sql  # NEW: both tables in one migration
```

### Pattern 1: Email Dispatch Inside createNotification()
**What:** After inserting the notification row, check user preferences and send email if enabled.
**When to use:** Every notification creation.
**Example:**
```typescript
// In createNotification() after successful insert:
import { sendNotificationEmail } from '@/lib/email'

// Check if user has email enabled for this type
const prefs = await getNotificationPreferences(params.userId)
const emailEnabled = prefs[params.type]?.email !== false // default true

if (emailEnabled) {
  // Fire-and-forget -- don't block notification creation on email
  sendNotificationEmail({
    to: userEmail,
    type: params.type,
    title: params.title,
    body: params.body,
    linkUrl: params.linkUrl,
    actorName: actorName,
  }).catch(console.error)
}
```

### Pattern 2: Resend Client Singleton
**What:** Single Resend instance reused across all email sends.
**When to use:** All email operations.
**Example:**
```typescript
// src/lib/email.ts
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendNotificationEmail(params: {
  to: string
  type: NotificationType
  title: string
  body?: string | null
  linkUrl?: string | null
  actorName?: string | null
}) {
  const { data, error } = await resend.emails.send({
    from: 'TruQC <notifications@truqc.co.uk>',
    to: [params.to],
    subject: params.title,
    react: NotificationEmail(params),
  })

  if (error) {
    console.error('Email send failed:', error)
  }

  return { data, error }
}
```

### Pattern 3: Activity Event Explicit Logging
**What:** Call `logActivity()` explicitly in server actions that perform notable actions.
**When to use:** After validation completes, after cleaning/fix, after comment creation, after export, after certificate generation.
**Example:**
```typescript
// src/lib/actions/activity.ts
export async function logActivity(params: {
  projectId: string
  orgId: string
  actorId: string
  eventType: ActivityEventType
  summary: string
  resourceType?: string
  resourceId?: string
}) {
  const supabase = await createClient()
  await supabase.from('activity_events').insert({
    project_id: params.projectId,
    org_id: params.orgId,
    actor_id: params.actorId,
    event_type: params.eventType,
    summary: params.summary,
    resource_type: params.resourceType ?? null,
    resource_id: params.resourceId ?? null,
  })
}
```

### Pattern 4: Notification Preferences Table (Recommended)
**What:** Separate table with one row per user, JSONB column for preferences.
**Why over profiles column:** Avoids schema migration on heavily-used profiles table; cleaner separation of concerns.
**Example schema:**
```sql
CREATE TABLE public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  preferences JSONB NOT NULL DEFAULT '{
    "validation_complete": {"in_app": true, "email": true},
    "validation_failed": {"in_app": true, "email": true},
    "mention": {"in_app": true, "email": true},
    "comment_resolved": {"in_app": true, "email": true}
  }'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Anti-Patterns to Avoid
- **Sending email synchronously in createNotification:** Email is a network call that can fail or be slow. Fire-and-forget (or use a background function) so notification creation is never blocked.
- **Database triggers for activity logging:** Triggers are invisible, hard to test, and can cause cascading issues. Explicit logging is more maintainable for a solo project.
- **Storing preferences as individual columns:** JSONB is more flexible when adding new notification types later; avoids ALTER TABLE migrations.
- **Using Supabase service role key for email sending:** Use a separate Resend API key. The Supabase custom SMTP is only for auth emails (OTP), not transactional app emails.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email HTML rendering | Raw HTML strings with inline styles | @react-email/components | Email client compatibility is notoriously complex; React Email handles Outlook/Gmail/Apple Mail quirks |
| Email delivery | SMTP client / nodemailer | Resend SDK | Handles deliverability, bounce tracking, rate limiting; already in project stack |
| Toggle switch component | Custom checkbox-based toggle | shadcn/ui Switch or @base-ui Switch | Already using shadcn/base-ui in project; consistent styling |
| Responsive email layout | Manual table-based email HTML | React Email's Container/Section/Row | Email layout must use tables for Outlook; React Email abstracts this |

**Key insight:** Email rendering for cross-client compatibility is a solved problem via React Email. Building custom email HTML is the #1 source of broken notification emails.

## Common Pitfalls

### Pitfall 1: Resend Domain Verification
**What goes wrong:** Emails land in spam or don't send because the sending domain isn't verified in Resend.
**Why it happens:** Resend requires DNS records (SPF, DKIM, DMARC) for custom domains.
**How to avoid:** Verify truqc.co.uk domain in Resend dashboard before development. Until verified, use the default `onboarding@resend.dev` sender for testing.
**Warning signs:** `{ error: { statusCode: 403, message: "..." } }` from Resend SDK.

### Pitfall 2: Email Blocking Notification Flow
**What goes wrong:** If email send fails or times out, the entire createNotification() call fails.
**Why it happens:** Awaiting the email send in the main flow.
**How to avoid:** Fire-and-forget pattern -- call sendNotificationEmail() without awaiting, with a .catch(console.error). The in-app notification is the primary; email is supplementary.
**Warning signs:** Slow notification creation, intermittent failures.

### Pitfall 3: Missing User Email Lookup
**What goes wrong:** createNotification() receives a userId but not the user's email address.
**Why it happens:** The current createNotification() doesn't fetch the user's email since it only does a DB insert.
**How to avoid:** Fetch email from profiles or auth.users when preparing to send email. Cache or pass email as parameter.
**Warning signs:** Null email in send call.

### Pitfall 4: Activity Feed N+1 Queries
**What goes wrong:** Each activity item needs actor name, loading 20 items = 20 profile lookups.
**Why it happens:** Not joining actor profile in the initial query.
**How to avoid:** Use Supabase's `select('*, actor:actor_id(full_name)')` join pattern, same as notifications.
**Warning signs:** Slow activity feed load, many DB round trips.

### Pitfall 5: Preferences Race Condition on First Notification
**What goes wrong:** New user gets first notification before preferences row exists, causing null preferences lookup.
**Why it happens:** Preferences row created on first settings visit, not on user signup.
**How to avoid:** Default behavior is "all enabled" -- if no preferences row exists, treat as all-on. Only create row when user explicitly changes a preference.
**Warning signs:** No emails for new users despite "all on by default" intention.

### Pitfall 6: In-App Toggle Accidentally Disabling Realtime
**What goes wrong:** User toggles "In-App: off" for a type, but the Realtime subscription still pushes toasts.
**Why it happens:** Realtime provider doesn't check preferences.
**How to avoid:** In-app preference only controls the createNotification() insert -- if in-app is off, don't insert the row at all. Realtime listener then naturally gets nothing. OR: continue inserting but mark as "suppressed" so it doesn't count as unread.
**Warning signs:** User disabled in-app mentions but still sees toast.

## Code Examples

### React Email Branded Template
```typescript
// src/emails/notification-email.tsx
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'

interface NotificationEmailProps {
  type: string
  title: string
  body?: string | null
  linkUrl?: string | null
  actorName?: string | null
}

export function NotificationEmail({
  title,
  body,
  linkUrl,
  actorName,
}: NotificationEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{title}</Preview>
      <Body style={{ backgroundColor: '#f4f4f5', fontFamily: 'DM Sans, sans-serif' }}>
        <Container style={{ maxWidth: '480px', margin: '0 auto', padding: '40px 20px' }}>
          <Section style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '32px' }}>
            <Img
              src="https://truqc.co.uk/logo.png"
              alt="TruQC"
              width={120}
              height={32}
              style={{ marginBottom: '24px' }}
            />
            <Heading style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '20px', color: '#0f172a' }}>
              {title}
            </Heading>
            {actorName && (
              <Text style={{ color: '#64748b', fontSize: '14px' }}>
                By {actorName}
              </Text>
            )}
            {body && (
              <Text style={{ color: '#334155', fontSize: '14px', lineHeight: '1.6' }}>
                {body}
              </Text>
            )}
            {linkUrl && (
              <Link
                href={`https://truqc.co.uk${linkUrl}`}
                style={{
                  display: 'inline-block',
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                  padding: '10px 20px',
                  borderRadius: '12px',
                  fontSize: '14px',
                  textDecoration: 'none',
                  marginTop: '16px',
                }}
              >
                View in TruQC
              </Link>
            )}
          </Section>
          <Text style={{ color: '#94a3b8', fontSize: '12px', textAlign: 'center' as const, marginTop: '24px' }}>
            <Link href="https://truqc.co.uk/settings" style={{ color: '#94a3b8' }}>
              Manage notification preferences
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
```

### Activity Events Table Schema
```sql
-- activity_events: project-scoped chronological feed
CREATE TABLE public.activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  org_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE NOT NULL,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'validation_run', 'validation_failed', 'cleaning_applied',
    'comment_added', 'comment_resolved', 'report_exported',
    'certificate_generated', 'dataset_uploaded'
  )),
  summary TEXT NOT NULL,           -- "Ran validation on pipeline_survey.csv"
  resource_type TEXT,              -- 'dataset', 'issue', 'comment', 'certificate'
  resource_id UUID,
  metadata JSONB DEFAULT '{}',    -- flexible extra data per event type
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fast lookup for project activity feed
CREATE INDEX idx_activity_events_project ON public.activity_events(project_id, created_at DESC);

-- RLS
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view project activity"
  ON public.activity_events FOR SELECT
  USING (get_user_org_role(org_id) IS NOT NULL);

CREATE POLICY "Org members can insert activity"
  ON public.activity_events FOR INSERT
  WITH CHECK (get_user_org_role(org_id) IS NOT NULL);

-- Enable Realtime for live feed updates (optional)
ALTER PUBLICATION supabase_realtime ADD TABLE activity_events;
```

### Notification Preferences Toggle Row
```typescript
// Pattern for the settings toggle UI
// Uses the established Card pattern from settings page

interface PreferenceRow {
  label: string
  type: NotificationType
  inApp: boolean
  email: boolean
}

// Each row: [Label] [In-App toggle] [Email toggle]
// All default to true, stored in notification_preferences table
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Nodemailer + SMTP | Resend SDK | 2023+ | Simpler API, better deliverability tracking, React component support |
| HTML string email templates | React Email components | 2023+ | Type-safe, component-based, handles email client quirks |
| Per-column notification preferences | JSONB preferences | Common pattern | Flexible, fewer migrations when adding types |

**Deprecated/outdated:**
- Nodemailer for transactional email in serverless: cold start issues, connection pooling problems. Resend/Postmark/SendGrid APIs are standard now.

## Open Questions

1. **Resend Domain Verification Status**
   - What we know: Project uses truqc.co.uk domain, Resend is mentioned as email provider
   - What's unclear: Whether DNS records are already configured for Resend sending
   - Recommendation: Check Resend dashboard; use `onboarding@resend.dev` for dev/test until verified

2. **User Email Access Pattern**
   - What we know: createNotification() has userId but not email; email is in auth.users (Supabase managed)
   - What's unclear: Whether profiles table stores email or if auth.users must be queried
   - Recommendation: Query from profiles or pass email as parameter to createNotification

3. **Activity Feed Live Updates**
   - What we know: Supabase Realtime is used for notifications; activity_events could use same pattern
   - What's unclear: Whether live updates are needed for activity feed (vs. refresh-on-visit)
   - Recommendation: Start without Realtime for activity feed (refresh-on-visit). Add later if needed -- activity feeds are not time-critical like notifications.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run tests/collaboration/ --reporter verbose` |
| Full suite command | `npx vitest run --reporter verbose` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COLB-02a | Email send dispatched for each notification type | unit | `npx vitest run tests/collaboration/email-notifications.test.ts -t "sends email"` | No -- Wave 0 |
| COLB-02b | Email respects user preferences (off = no send) | unit | `npx vitest run tests/collaboration/email-notifications.test.ts -t "respects preferences"` | No -- Wave 0 |
| COLB-02c | Notification preferences CRUD | unit | `npx vitest run tests/collaboration/notification-preferences.test.ts` | No -- Wave 0 |
| COLB-02d | Preferences UI renders toggles | unit | `npx vitest run tests/collaboration/notification-preferences-ui.test.tsx` | No -- Wave 0 |
| COLB-05a | Activity events logged for key actions | unit | `npx vitest run tests/collaboration/activity-logging.test.ts` | No -- Wave 0 |
| COLB-05b | Activity feed fetches with pagination | unit | `npx vitest run tests/collaboration/activity-feed.test.ts` | No -- Wave 0 |
| COLB-05c | Activity feed UI renders timeline items | unit | `npx vitest run tests/collaboration/activity-feed-ui.test.tsx` | No -- Wave 0 |
| COLB-05d | Filter chips toggle event types | unit | `npx vitest run tests/collaboration/activity-filters.test.tsx` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/collaboration/ --reporter verbose`
- **Per wave merge:** `npx vitest run --reporter verbose`
- **Phase gate:** Full suite green before /gsd:verify-work

### Wave 0 Gaps
- [ ] `tests/collaboration/email-notifications.test.ts` -- covers COLB-02 email dispatch + preference gating
- [ ] `tests/collaboration/notification-preferences.test.ts` -- covers COLB-02 preference CRUD
- [ ] `tests/collaboration/notification-preferences-ui.test.tsx` -- covers COLB-02 toggle UI
- [ ] `tests/collaboration/activity-logging.test.ts` -- covers COLB-05 event creation
- [ ] `tests/collaboration/activity-feed.test.ts` -- covers COLB-05 feed fetching
- [ ] `tests/collaboration/activity-feed-ui.test.tsx` -- covers COLB-05 timeline UI
- [ ] `tests/collaboration/activity-filters.test.tsx` -- covers COLB-05 filter chips

## Sources

### Primary (HIGH confidence)
- Resend official docs (https://resend.com/docs/send-with-nextjs) -- SDK usage patterns, server action integration
- React Email components (https://react.email/components) -- email template component library
- Existing codebase: `src/lib/actions/notifications.ts`, `supabase/migrations/20260412_notifications.sql` -- current notification infrastructure

### Secondary (MEDIUM confidence)
- npm registry (https://www.npmjs.com/package/resend) -- resend v6.11.0 latest
- React Email templates (https://react.email/templates) -- branded template patterns from Stripe/Linear

### Tertiary (LOW confidence)
- None -- all findings verified with official sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Resend is the chosen provider, React Email is its official companion
- Architecture: HIGH -- extending well-documented existing patterns (createNotification, settings page, Realtime)
- Pitfalls: HIGH -- based on direct code analysis of current notification flow and common email integration issues

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (stable domain, mature libraries)
