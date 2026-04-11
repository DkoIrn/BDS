# Phase 32: Collaboration (Core) - Research

**Researched:** 2026-04-11
**Domain:** In-app notifications, comment resolution, @mention autocomplete (Supabase + Next.js + React)
**Confidence:** HIGH

## Summary

This phase adds three collaboration features to TruQC: a notification bell with unread count, comment resolution with filtering, and @mention autocomplete in comments. All three features build on existing infrastructure: Supabase Realtime (already used for dataset/job events), the existing comment system (issue-comments.tsx + server actions), and the team member data layer (org_members + profiles).

The core technical challenge is the @mention input overlay on a plain textarea -- this requires careful cursor position tracking and a floating autocomplete popup without introducing a rich text editor. The notification system is straightforward: a new `notifications` table, a Realtime subscription channel, and a Popover dropdown from the existing bell icon. Comment resolution requires only schema additions (resolved_at, resolved_by) and UI changes to the existing component.

**Primary recommendation:** Use Supabase Realtime postgres_changes on a new `notifications` table for push delivery, `@base-ui/react/popover` for the notification dropdown, and a custom @mention textarea overlay (no rich text library needed).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Notification panel: Dropdown popover from bell icon (not slide-out or full page)
- Single chronological list, no tabs or filters; "Mark all read" at top is the only bulk action
- Click notification to mark read + navigate to item; no per-item dismiss
- Unread badge: exact count up to 9, then "9+"; red dot on bell icon
- Comment resolution: Anyone in org can resolve/reopen any comment
- Resolved comments collapse to single line with click-to-expand
- Default shows unresolved only; "Show resolved (N)" toggle
- Resolving triggers notification to comment author
- @Mention: Inline popup autocomplete on @ keystroke; arrow keys + Enter or click to select
- Mentions render as highlighted name chips (blue background pill), not clickable
- Enhanced plain text input -- keep current textarea, add @mention overlay/detection on top. No rich text editor
- Mentions stored as structured data (user_id reference) in comment content
- Three trigger events: validation complete/failed, @mention, comment resolved (notifies author)
- Validation notifications go to triggering user only
- Comment notifications are @mention-only -- no auto-subscribe
- Extend existing Supabase Realtime subscription (RealtimeProvider) for notifications table

### Claude's Discretion
- Notification popover max height and scroll behavior
- Toast notification styling and duration
- Exact @mention autocomplete positioning and keyboard interaction details
- Notifications table schema design (Supabase)
- How to store @mentions in comment content (markup format)
- Notification deduplication logic

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| COLB-01 | User receives in-app notifications (bell icon with unread count) for validation completions, comments, and @mentions | Notifications table schema, Realtime subscription pattern, Popover component for dropdown, unread count query |
| COLB-03 | User can mark comments as resolved, and filter to show unresolved only | Schema additions to issue_comments (resolved_at, resolved_by), server actions, UI collapse pattern |
| COLB-04 | User can @mention org members in comments with autocomplete, triggering a notification | @mention markup format, textarea overlay approach, autocomplete popup, notification creation on mention |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | ^2.99.0 | DB queries, Realtime subscriptions | Already in project, Realtime postgres_changes for push notifications |
| @base-ui/react | ^1.2.0 | Popover primitive for notification dropdown | Already in project, used for all UI primitives (Menu, Dialog, Select) |
| sonner | ^2.0.7 | Toast notifications on new notification arrival | Already in project, established pattern in RealtimeProvider |
| lucide-react | ^0.577.0 | Bell, Check, CornerDownRight icons | Already in project icon library |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| React 19 useTransition | built-in | Optimistic UI for resolve/reopen/mark-read | Same pattern as existing comment add/delete |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom @mention textarea | tiptap/prosemirror | Massive bundle for simple @mention; user explicitly chose "no rich text editor" |
| Custom popover | Radix Popover | Project uses @base-ui, not Radix -- stay consistent |
| Supabase Realtime | Polling | Realtime already established; polling would be inconsistent and slower |

**Installation:**
No new packages needed. All dependencies already in project.

## Architecture Patterns

### Recommended Project Structure
```
src/
  components/
    notifications/
      notification-bell.tsx        # Bell icon + unread badge + popover trigger
      notification-popover.tsx     # Dropdown list of notifications
      notification-item.tsx        # Single notification row
    comments/
      issue-comments.tsx           # EXTEND: add resolve/reopen, @mention, filter
      mention-input.tsx            # Textarea with @mention overlay
      mention-autocomplete.tsx     # Floating autocomplete popup
  lib/
    actions/
      notifications.ts            # Server actions: getNotifications, markRead, markAllRead, createNotification
      comments.ts                 # EXTEND: resolveComment, reopenComment
    types/
      notifications.ts            # Notification type definition
      organisations.ts            # EXTEND: IssueComment with resolved_at, resolved_by
  supabase/
    migrations/
      YYYYMMDD_notifications.sql  # notifications table + RLS + Realtime enable
      YYYYMMDD_comment_resolution.sql  # ALTER issue_comments add resolved columns
```

### Pattern 1: Notifications Table Schema
**What:** PostgreSQL table for notifications with Supabase Realtime enabled
**When to use:** Core infrastructure for COLB-01

```sql
-- Notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  org_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('validation_complete', 'validation_failed', 'mention', 'comment_resolved')),
  title TEXT NOT NULL,
  body TEXT,
  read BOOLEAN DEFAULT FALSE NOT NULL,
  -- Polymorphic reference to the source entity
  resource_type TEXT, -- 'dataset', 'issue', 'comment'
  resource_id UUID,
  -- Navigation context
  link_url TEXT,
  -- Actor who triggered the notification
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, read) WHERE read = FALSE;
CREATE INDEX idx_notifications_user_created ON public.notifications(user_id, created_at DESC);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- RLS: users can only see their own notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Server actions insert via service role or RLS insert policy
CREATE POLICY "Org members can create notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_id = notifications.org_id
      AND user_id = auth.uid()
    )
  );
```

**Key design decisions:**
- `read` boolean (not `read_at` timestamp) -- simpler, sufficient for "unread count" and "mark read"
- `link_url` stores the navigation path (e.g., `/projects/{pid}/jobs/{jid}/files/{did}`) -- click navigates directly
- `resource_type` + `resource_id` for polymorphic reference -- enables future grouping
- RLS scoped to `user_id = auth.uid()` -- each user only sees their own notifications
- Realtime enabled so postgres_changes events fire on INSERT for push delivery

### Pattern 2: Comment Resolution Schema Extension
**What:** Add resolved_at and resolved_by to issue_comments
**When to use:** Core infrastructure for COLB-03

```sql
ALTER TABLE public.issue_comments
  ADD COLUMN resolved_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT NULL;

-- Index for filtering unresolved
CREATE INDEX idx_issue_comments_resolved ON public.issue_comments(issue_id, resolved_at)
  WHERE resolved_at IS NULL;
```

**RLS consideration:** The existing UPDATE policy on issue_comments is `USING (auth.uid() = user_id)` -- only comment authors can update. Since the user decision says "anyone in org can resolve," we need a new policy:

```sql
-- Allow any org member to resolve/reopen (update resolved_at, resolved_by only)
CREATE POLICY "Org members can resolve comments"
  ON public.issue_comments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.validation_issues vi
      JOIN public.datasets d ON d.id = vi.dataset_id
      JOIN public.jobs j ON j.id = d.job_id
      JOIN public.projects p ON p.id = j.project_id
      WHERE vi.id = issue_comments.issue_id
      AND get_user_org_role(p.org_id) IS NOT NULL
    )
  );
```

Note: This replaces the existing owner-only UPDATE policy or coexists with it (Supabase OR-combines multiple SELECT/UPDATE policies). Since the existing policy allows full update by owner and this new one allows update by any org member, the effect is: any org member can update the resolved fields. For tighter control, a database function could restrict which columns are updatable, but given the solo developer context and the fact that the server actions control what gets sent, this is acceptable.

### Pattern 3: @Mention Storage Format
**What:** How to encode @mentions in comment content
**When to use:** COLB-04 data model

**Recommended format:** Markdown-like inline tokens that are human-readable in raw form:

```
Hey @[Daniel](user:uuid-here), can you check the depth column?
```

**Storage in database:** The `content` column stores the raw string with mention tokens.

**Parsing on display:** A React component splits the content by regex and renders mention tokens as styled pills:

```typescript
// Parse mentions from content
const MENTION_REGEX = /@\[([^\]]+)\]\(user:([a-f0-9-]+)\)/g

function parseContent(content: string): (string | { name: string; userId: string })[] {
  const parts: (string | { name: string; userId: string })[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = MENTION_REGEX.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index))
    }
    parts.push({ name: match[1], userId: match[2] })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex))
  }
  return parts
}
```

**Why this format:**
- Human-readable in raw DB queries
- Standard markdown link syntax (familiar)
- Easy to extract user IDs for notification creation
- No rich text serialization complexity
- Future-proof: same format could support @[Team Name](team:uuid) later

### Pattern 4: @Mention Textarea Overlay
**What:** Enhanced textarea with floating autocomplete
**When to use:** COLB-04 input component

**Approach:** Keep the existing `<textarea>` element. Layer behavior on top:

1. **Keystroke detection:** On every `onChange`, check if the cursor is preceded by `@` with optional filter text
2. **Autocomplete trigger:** When `@` detected, show a floating popup positioned below the textarea (or below the cursor line using a hidden measurement div)
3. **Popup rendering:** List of org members filtered by typed text, navigable with arrow keys
4. **Selection:** On Enter/click, replace the `@filtertext` with `@[Full Name](user:uuid) ` in the textarea value
5. **Visual rendering:** The textarea shows the raw markup while typing. The display (in posted comments) renders the pills.

**Simplified positioning approach (recommended for v1):** Position the autocomplete popup at the bottom-left of the textarea, not at the exact cursor position. Exact cursor positioning in a textarea requires invisible mirror elements and is fragile. Bottom-left is how Slack's mobile experience works and is sufficient for short comment inputs.

```typescript
// Detect @mention trigger
function detectMentionTrigger(value: string, cursorPos: number): string | null {
  // Walk backward from cursor to find @
  const before = value.slice(0, cursorPos)
  const match = before.match(/@(\w*)$/)
  if (match) return match[1] // filter text after @
  return null
}
```

### Pattern 5: Realtime Notification Delivery
**What:** Extend RealtimeProvider for notification push
**When to use:** COLB-01 real-time updates

```typescript
// In RealtimeProvider, add a third channel:
const notifChannel = supabase
  .channel("user-notifications")
  .on(
    "postgres_changes",
    {
      event: "INSERT",
      schema: "public",
      table: "notifications",
      filter: `user_id=eq.${userId}`,
    },
    (payload) => {
      const notif = payload.new as Notification
      // Show toast
      toast.info(notif.title, { description: notif.body })
      // Trigger bell badge update (via callback or context)
    }
  )
  .subscribe()
```

**Important:** The filter `user_id=eq.${userId}` ensures each client only receives their own notifications via Realtime. Combined with RLS on the table, this is double-secured.

**Bell badge state:** Use a React context or a simple useState in a parent component that wraps the bell. The RealtimeProvider calls a callback to increment the unread count. Initial count is fetched on mount via a server action.

### Anti-Patterns to Avoid
- **Don't build a WebSocket notification server:** Supabase Realtime postgres_changes handles this. No need for custom socket infrastructure.
- **Don't use rich text editors for @mentions:** The user explicitly chose "enhanced plain text input." A textarea with overlay detection is the correct approach.
- **Don't auto-subscribe to comment threads:** User decision: notifications are @mention-only, not "all comments on issues I follow."
- **Don't use polling for unread count:** Supabase Realtime will push INSERT events. Only need initial fetch on mount.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Popover positioning | Custom absolute positioning | `@base-ui/react/popover` | Handles viewport edge detection, scroll containment, z-index |
| Realtime push | WebSocket server | Supabase Realtime postgres_changes | Already infrastructure, handles reconnect/auth |
| Toast notifications | Custom toast system | sonner (already in project) | Established pattern, handles stacking/dismissal |
| Dropdown keyboard nav | Custom key handlers | `@base-ui/react` Menu or Popover | Handles focus management, ARIA attributes |

**Key insight:** Every infrastructure piece for this phase already exists in the project. The work is extending existing patterns, not introducing new ones.

## Common Pitfalls

### Pitfall 1: Supabase Realtime RLS + Publication
**What goes wrong:** Notifications table added but Realtime events don't fire
**Why it happens:** Table must be added to `supabase_realtime` publication AND RLS must allow SELECT for the subscribing user. If either is missing, no events.
**How to avoid:** Migration must include both `ALTER PUBLICATION supabase_realtime ADD TABLE notifications` and RLS SELECT policy for `auth.uid() = user_id`
**Warning signs:** Realtime subscription connects but never fires callbacks

### Pitfall 2: @Mention Regex Edge Cases
**What goes wrong:** Mention detection triggers inside words or after special characters
**Why it happens:** Naive regex `/@(\w*)$/` matches mid-word or after punctuation
**How to avoid:** Check that the character before `@` is whitespace or start-of-string: `/(^|\s)@(\w*)$/`
**Warning signs:** Autocomplete popup appears when typing email addresses

### Pitfall 3: Notification Duplication
**What goes wrong:** Same event creates multiple notifications (e.g., validation complete fires from both dataset channel and job_runs channel)
**Why it happens:** Multiple code paths can trigger the same logical event
**How to avoid:** Create notifications from a single authoritative source per event type. Validation notifications should come from the job completion handler (backend/API), not from the Realtime subscription in the browser. Add a UNIQUE constraint or dedup check: `UNIQUE(user_id, type, resource_type, resource_id)`
**Warning signs:** Users see duplicate entries in notification list

### Pitfall 4: Comment Resolution RLS Conflict
**What goes wrong:** Non-author org members cannot resolve comments despite the decision allowing it
**Why it happens:** Existing UPDATE policy restricts to `auth.uid() = user_id` (comment author only)
**How to avoid:** Add a broader UPDATE policy for org members. Supabase OR-combines multiple policies of the same command type, so both can coexist.
**Warning signs:** 403/permission errors when non-author tries to resolve

### Pitfall 5: Textarea Cursor Jump on Mention Insert
**What goes wrong:** After inserting `@[Name](user:id)`, cursor jumps to end of textarea
**Why it happens:** Setting textarea value via React state resets cursor position
**How to avoid:** After state update, use `requestAnimationFrame` + `textarea.setSelectionRange(newPos, newPos)` to restore cursor position after the mention token
**Warning signs:** Users lose their place when selecting a mention

### Pitfall 6: Notification Count Drift
**What goes wrong:** Bell badge shows wrong unread count over time
**Why it happens:** Realtime event missed (network blip), or optimistic decrement on mark-read fails silently
**How to avoid:** Re-fetch actual unread count periodically (e.g., on window focus via `visibilitychange` event). Use the Realtime event to increment optimistically, but reconcile with server count.
**Warning signs:** Badge shows 0 but popover has unread items, or badge shows stale count

## Code Examples

### Notification Bell with Popover (using @base-ui/react)
```typescript
// Source: Project pattern from dropdown-menu.tsx adapted for Popover
import { Popover } from "@base-ui/react/popover"
import { Bell } from "lucide-react"

function NotificationBell({ unreadCount }: { unreadCount: number }) {
  return (
    <Popover.Root>
      <Popover.Trigger className="relative inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground">
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={8}>
          <Popover.Popup className="w-80 max-h-96 overflow-y-auto rounded-xl border bg-popover shadow-lg">
            {/* Notification list content */}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
```

### Resolved Comment Collapsed View
```typescript
// Collapsed resolved comment
function ResolvedComment({ comment }: { comment: IssueComment }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-lg border border-dashed bg-muted/30 p-2.5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 text-xs text-muted-foreground"
      >
        <Check className="size-3 text-emerald-500" />
        <span>{comment.resolved_by_name} resolved this - {relativeTime(comment.resolved_at!)}</span>
        <ChevronDown className={cn("ml-auto size-3 transition-transform", expanded && "rotate-180")} />
      </button>
      {expanded && (
        <div className="mt-2 border-t pt-2">
          <p className="text-xs text-foreground/80 whitespace-pre-wrap">{comment.content}</p>
          <Button size="sm" variant="ghost" onClick={() => handleReopen(comment.id)} className="mt-1 h-6 text-[10px]">
            Reopen
          </Button>
        </div>
      )}
    </div>
  )
}
```

### Server Action: Create Notification on Comment with Mentions
```typescript
// In addComment server action, after inserting comment:
const mentionedUserIds = extractMentionedUserIds(content)
if (mentionedUserIds.length > 0) {
  const notifications = mentionedUserIds.map((mentionedUserId) => ({
    user_id: mentionedUserId,
    org_id: orgId,
    type: 'mention' as const,
    title: `${userName} mentioned you in a comment`,
    body: content.slice(0, 100),
    resource_type: 'issue',
    resource_id: issueId,
    link_url: buildIssueLinkUrl(issueId),
    actor_id: user.id,
  }))
  await supabase.from('notifications').insert(notifications)
}

function extractMentionedUserIds(content: string): string[] {
  const regex = /@\[([^\]]+)\]\(user:([a-f0-9-]+)\)/g
  const ids: string[] = []
  let match
  while ((match = regex.exec(content)) !== null) {
    ids.push(match[2])
  }
  return [...new Set(ids)] // deduplicate
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Polling for notifications | Supabase Realtime postgres_changes | Supabase v2+ | Real-time push without custom WebSocket server |
| Rich text editors for @mentions | Textarea with overlay detection | Ongoing trend | Much lighter bundle, simpler architecture |
| Separate notification microservice | Database-driven with Realtime | Supabase pattern | No additional infrastructure for solo developer |

**Deprecated/outdated:**
- Supabase Realtime v1 (channel-based broadcast) replaced by postgres_changes in v2 -- use postgres_changes, which is what the project already uses

## Open Questions

1. **Notification link_url construction**
   - What we know: Notifications need to link to datasets, issues, and comments
   - What's unclear: The exact URL structure for navigating to a specific comment on an issue (issue detail may need a comment anchor)
   - Recommendation: Store full path like `/projects/{pid}/jobs/{jid}/files/{did}?issue={iid}` -- the existing issue detail view already exists; comment scroll-to can be added later

2. **Notification creation for validation events**
   - What we know: Validation complete/failed should notify the triggering user
   - What's unclear: Where to insert the notification row -- in the FastAPI backend after job completion, or in a Supabase database trigger, or in the Next.js API route
   - Recommendation: Create notification in the same server action / API route that marks validation complete. If using job queue (procrastinate), the task completion handler in Python should insert via Supabase client. Alternatively, a Supabase database trigger on `datasets.status` change is the most reliable approach.

3. **@base-ui/react Popover availability**
   - What we know: @base-ui/react v1.2.0 is installed; Menu, Dialog, Select, Tooltip are used
   - What's unclear: Whether Popover primitive exists in the installed version
   - Recommendation: Verify with `import { Popover } from "@base-ui/react/popover"`. If unavailable, use the DropdownMenu (Menu primitive) pattern instead -- functionally equivalent for this use case, just wraps content in Menu.Popup instead of Popover.Popup

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.0.18 + @testing-library/react 16.3.2 |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run tests/collaboration --reporter=verbose` |
| Full suite command | `npx vitest run --reporter=verbose` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COLB-01 | Notification bell shows unread count, mark-read, mark-all-read | unit | `npx vitest run tests/collaboration/notification-bell.test.tsx -t "unread count"` | Wave 0 |
| COLB-01 | Notification server actions (get, markRead, markAllRead) | unit | `npx vitest run tests/collaboration/notification-actions.test.ts` | Wave 0 |
| COLB-03 | Comment resolve/reopen toggles resolved_at | unit | `npx vitest run tests/collaboration/comment-resolution.test.ts` | Wave 0 |
| COLB-03 | Resolved filter shows/hides resolved comments | unit | `npx vitest run tests/collaboration/comment-resolution-ui.test.tsx` | Wave 0 |
| COLB-04 | @mention regex parses mention tokens from content | unit | `npx vitest run tests/collaboration/mention-parser.test.ts` | Wave 0 |
| COLB-04 | @mention trigger detection from cursor position | unit | `npx vitest run tests/collaboration/mention-trigger.test.ts` | Wave 0 |
| COLB-04 | Mention insertion replaces @filter with full token | unit | `npx vitest run tests/collaboration/mention-input.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/collaboration --reporter=verbose`
- **Per wave merge:** `npx vitest run --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/collaboration/` directory -- new test directory for this phase
- [ ] `tests/collaboration/notification-bell.test.tsx` -- covers COLB-01 UI
- [ ] `tests/collaboration/notification-actions.test.ts` -- covers COLB-01 server actions
- [ ] `tests/collaboration/comment-resolution.test.ts` -- covers COLB-03 logic
- [ ] `tests/collaboration/comment-resolution-ui.test.tsx` -- covers COLB-03 UI
- [ ] `tests/collaboration/mention-parser.test.ts` -- covers COLB-04 parsing
- [ ] `tests/collaboration/mention-trigger.test.ts` -- covers COLB-04 detection
- [ ] `tests/collaboration/mention-input.test.ts` -- covers COLB-04 insertion

## Sources

### Primary (HIGH confidence)
- Project source code: `src/components/realtime-provider.tsx` -- existing Realtime pattern
- Project source code: `src/components/comments/issue-comments.tsx` -- existing comment UI
- Project source code: `src/lib/actions/comments.ts` -- existing comment server actions
- Project source code: `src/components/top-navbar.tsx` -- existing bell icon (disabled)
- Project source code: `src/lib/actions/team.ts` -- getTeamMembers for @mention data
- Project source code: `supabase/migrations/00012_organisations.sql` -- issue_comments schema + RLS
- Project source code: `supabase/migrations/20260312_enable_realtime_datasets.sql` -- Realtime publication pattern

### Secondary (MEDIUM confidence)
- Supabase Realtime postgres_changes documentation -- filter syntax, RLS interaction
- @base-ui/react Popover API -- needs runtime verification of availability in v1.2.0

### Tertiary (LOW confidence)
- @mention textarea overlay approach -- based on common community patterns; exact cursor positioning may need iteration

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in project, no new dependencies
- Architecture: HIGH -- extends existing patterns (Realtime, server actions, comment component)
- Pitfalls: HIGH -- based on direct analysis of existing code and Supabase patterns
- @mention input: MEDIUM -- textarea overlay is well-understood but cursor management details may need iteration

**Research date:** 2026-04-11
**Valid until:** 2026-05-11 (stable domain, no fast-moving dependencies)
