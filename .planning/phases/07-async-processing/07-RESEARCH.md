# Phase 7: Async Processing - Research

**Researched:** 2026-03-12
**Domain:** Async processing, Supabase Realtime, FastAPI background tasks, toast notifications
**Confidence:** HIGH

## Summary

Phase 7 converts the existing synchronous validation flow to async: the Next.js API route fires a request to FastAPI and returns 202 immediately, FastAPI runs validation in the background and writes results directly to Supabase, and the frontend listens for status changes via Supabase Realtime postgres_changes subscriptions. Sonner toast notifications with action buttons notify users of completion/failure regardless of which page they are on.

The existing code is well-structured for this conversion. The validate API route (`src/app/api/validate/route.ts`) currently awaits the full FastAPI response -- it needs to return 202 immediately after setting status to `validating`. FastAPI already uses sync `def` endpoints (run in a threadpool by Starlette), so the simplest approach is to use FastAPI's built-in `BackgroundTasks` to run validation after returning the HTTP response. The frontend `FileDetailView` needs to stop awaiting the response and instead subscribe to Realtime updates. An app-wide Realtime provider at the dashboard layout level handles notifications from any page.

**Primary recommendation:** Use FastAPI `BackgroundTasks` for fire-and-forget processing, Supabase Realtime `postgres_changes` for live status delivery, and Sonner toast `action` for clickable notifications. Zero new infrastructure required.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Supabase Realtime subscriptions for status updates -- zero new infrastructure
- Track state transitions only (queued -> processing -> complete -> failed), not granular step progress
- App-wide subscription at the layout/shell level -- works regardless of which page user is on
- Filter subscription to datasets in 'validating' status only -- minimal traffic
- Sonner toast popups for notifications -- already used throughout the app
- Success toast includes quick summary with clickable link to file detail page
- Failure toast includes short error reason + link
- No bell icon, no browser push notifications, no email
- Fire-and-forget HTTP from Next.js API route to FastAPI -- returns 202 Accepted immediately
- FastAPI processes in background and writes results directly to Supabase
- If FastAPI is unreachable (connection refused, 5xx), return immediate error -- no silent failures, no retry logic
- Async scope is validation only -- parsing already works as fire-and-forget
- No cancel button for MVP
- Animated status badge (pulsing/spinning) on file list when file is processing
- No global processing indicator in top bar or sidebar
- Auto-restore on return: file detail page loads status from DB, Realtime subscription picks up live changes
- File list auto-updates via Realtime

### Claude's Discretion
- Supabase Realtime subscription implementation details (channel setup, filter syntax)
- How to restructure the validate API route for fire-and-forget (background task in FastAPI vs thread)
- Toast component configuration for action links
- How the app-wide Realtime provider integrates with the existing layout
- RLS policy adjustments needed for Realtime subscriptions
- How file-detail-view.tsx refactors from awaiting response to listening for Realtime updates

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PROC-01 | Processing runs asynchronously -- user uploads and is notified when complete | FastAPI BackgroundTasks for async execution; Supabase Realtime for status delivery; Sonner toast with action button for notification |
| PROC-02 | User can see processing status (queued, processing, complete, failed) | Realtime postgres_changes subscription on datasets table filtering status UPDATE events; animated StatusBadge in file list; auto-restore on FileDetailView |
</phase_requirements>

## Standard Stack

### Core (already installed, no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | ^2.99.0 | Realtime subscriptions via postgres_changes | Already in project; provides channel API for Realtime |
| FastAPI BackgroundTasks | built-in | Fire-and-forget processing after 202 response | Built into FastAPI/Starlette; no Celery/Redis needed for MVP |
| sonner | ^2.0.7 | Toast notifications with action buttons | Already in project; supports `action` prop with onClick + label |

### Supporting (already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | ^0.577.0 | Animated spinner icon for processing badge | Loader2 already used in StatusBadge for parsing state |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| FastAPI BackgroundTasks | Celery + Redis | Overkill for MVP; adds infrastructure; BackgroundTasks sufficient for single-task fire-and-forget |
| Supabase Realtime | Polling | Polling adds unnecessary load and latency; Realtime is free with Supabase |

**Installation:** No new packages needed. Zero infrastructure changes.

## Architecture Patterns

### Pattern 1: Fire-and-Forget Validate Route (Next.js API)

**What:** The API route validates auth/ownership, sets status to `validating`, fires a non-awaited fetch to FastAPI, and returns 202 immediately. If FastAPI is unreachable, return error immediately.

**When to use:** When the Next.js route should not block on FastAPI processing.

**Example:**
```typescript
// src/app/api/validate/route.ts
// Source: FastAPI docs + existing route pattern
export async function POST(request: Request) {
  // ... auth check, ownership check (unchanged) ...

  // Update status to validating
  await supabase.from('datasets').update({ status: 'validating' }).eq('id', datasetId)

  // Fire-and-forget to FastAPI -- do NOT await the response
  const fastApiUrl = process.env.FASTAPI_URL
  if (!fastApiUrl) {
    await supabase.from('datasets').update({ status: 'validation_error' }).eq('id', datasetId)
    return NextResponse.json({ error: 'FASTAPI_URL not configured' }, { status: 500 })
  }

  try {
    // Only check that FastAPI accepts the request (connection + initial response)
    const response = await fetch(`${fastApiUrl}/api/v1/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataset_id: datasetId, config: config ?? null }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      await supabase.from('datasets').update({ status: 'validation_error' }).eq('id', datasetId)
      return NextResponse.json({ error: `FastAPI error: ${errorBody}` }, { status: 502 })
    }

    // FastAPI accepted -- return 202 immediately
    return NextResponse.json({ status: 'accepted', datasetId }, { status: 202 })
  } catch (err) {
    // Connection refused, timeout, etc.
    await supabase.from('datasets').update({ status: 'validation_error' }).eq('id', datasetId)
    return NextResponse.json({ error: 'Processing service unavailable' }, { status: 503 })
  }
}
```

### Pattern 2: FastAPI BackgroundTasks for Validation

**What:** FastAPI endpoint accepts the request, kicks off validation as a background task, and returns 202 immediately. The background task writes results to Supabase (which triggers Realtime).

**When to use:** Fire-and-forget processing where the response should not wait.

**Example:**
```python
# backend/app/routers/validation.py
# Source: FastAPI official docs on BackgroundTasks
from fastapi import BackgroundTasks

@router.post("/validate", status_code=202)
def validate_dataset(request: ValidateRequest, background_tasks: BackgroundTasks):
    """Accept validation request and process in background."""
    # Quick validation: check dataset exists
    supabase = get_supabase_client()
    result = supabase.table("datasets").select("id").eq("id", request.dataset_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # Add to background tasks -- runs after response is sent
    background_tasks.add_task(run_validation_background, request.dataset_id, request.config)

    return {"status": "accepted", "dataset_id": request.dataset_id}


def run_validation_background(dataset_id: str, config: ProfileConfig | None):
    """Run validation pipeline and write results to Supabase."""
    # This is the existing validation logic, extracted into a standalone function
    # It writes status updates to Supabase, which triggers Realtime notifications
    # ... (existing logic from validate_dataset, with try/except writing status)
```

### Pattern 3: Supabase Realtime Provider (App-Wide)

**What:** A React context provider at the dashboard layout level that subscribes to postgres_changes on the datasets table, filtered to UPDATE events on the status column. When status changes to `validated` or `validation_error`, it fires a Sonner toast.

**When to use:** App-wide notifications that work regardless of which page the user is on.

**Example:**
```typescript
// src/components/realtime-provider.tsx
"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"

export function RealtimeProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('dataset-status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'datasets',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newStatus = payload.new.status
          const fileName = payload.new.file_name
          const datasetId = payload.new.id

          if (newStatus === 'validated') {
            // Fetch validation run summary for the toast
            // Then show success toast with action link
            toast.success(`Validation complete: ${fileName}`, {
              description: 'Click to view results',
              action: {
                label: 'View Results',
                onClick: () => router.push(`/path/to/file/${datasetId}`),
              },
            })
          } else if (newStatus === 'validation_error') {
            toast.error(`Validation failed: ${fileName}`, {
              action: {
                label: 'View Details',
                onClick: () => router.push(`/path/to/file/${datasetId}`),
              },
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, router])

  return <>{children}</>
}
```

### Pattern 4: Realtime-Aware File List

**What:** The FileList component subscribes to Realtime changes for datasets belonging to the current user and updates displayed statuses live.

**When to use:** When the file list should reflect processing state changes without page reload.

**Example:**
```typescript
// Inside FileList component -- subscribe to dataset status changes
useEffect(() => {
  const supabase = createClient()
  const channel = supabase
    .channel('file-list-status')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'datasets',
        filter: `job_id=eq.${jobId}`,
      },
      (payload) => {
        // Update the specific file's status in local state
        setFiles(prev => prev.map(f =>
          f.id === payload.new.id ? { ...f, status: payload.new.status } : f
        ))
      }
    )
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}, [jobId])
```

### Pattern 5: Realtime-Aware File Detail View

**What:** FileDetailView subscribes to status changes for the specific dataset. When status transitions to `validated`, it fetches the validation run and displays results. Replaces the current `await fetch('/api/validate')` pattern.

**When to use:** The file detail page during and after validation.

### Recommended Project Structure (changes only)
```
src/
  components/
    realtime-provider.tsx       # App-wide Realtime subscription + toast notifications
    files/
      file-list.tsx             # Add Realtime subscription for live status updates
      file-detail-view.tsx      # Refactor: fire-and-forget + Realtime subscription
      validation-progress.tsx   # Reused as-is for processing state display
  app/
    api/validate/route.ts       # Refactor: return 202 immediately
    (dashboard)/layout.tsx      # Wrap children with RealtimeProvider

backend/
  app/
    routers/validation.py       # Refactor: use BackgroundTasks
```

### Anti-Patterns to Avoid
- **Polling for status:** Use Realtime subscriptions, not setInterval polling. Supabase Realtime is free and push-based.
- **Awaiting FastAPI response in Next.js route:** The whole point is fire-and-forget. The API route must return 202 without waiting for validation to complete.
- **Duplicate status updates:** FastAPI already writes status to Supabase. The Next.js route sets `validating` before calling FastAPI. Do not have both services race to update the same status.
- **Creating a new Supabase client per subscription:** Reuse the browser client from `@/lib/supabase/client`.
- **Subscribing without cleanup:** Always return a cleanup function from useEffect that calls `supabase.removeChannel(channel)`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebSocket connections for live updates | Custom WebSocket server | Supabase Realtime postgres_changes | Already infrastructure; handles reconnection, auth, filtering |
| Background job queue | Custom queue with polling | FastAPI BackgroundTasks | Built-in, sufficient for single-task fire-and-forget; no Redis needed |
| Toast notification system | Custom notification UI | Sonner toast with `action` prop | Already integrated; supports action buttons, auto-dismiss, stacking |
| Animated processing indicator | Custom CSS animation | Tailwind `animate-spin` + `animate-pulse` | Already used in the codebase for Loader2 spinner |

**Key insight:** This phase adds zero new dependencies. Every piece of infrastructure (Supabase Realtime, FastAPI BackgroundTasks, Sonner toasts) is already available in the stack. The work is purely refactoring existing code to use async patterns.

## Common Pitfalls

### Pitfall 1: Supabase Realtime Requires Publication Setup
**What goes wrong:** Subscribing to postgres_changes on a table that is not added to the `supabase_realtime` publication silently receives no events.
**Why it happens:** Supabase Realtime only broadcasts changes from tables explicitly added to the `supabase_realtime` Postgres publication.
**How to avoid:** Run `ALTER PUBLICATION supabase_realtime ADD TABLE datasets;` as a migration. This can also be toggled in the Supabase Dashboard under Database > Publications.
**Warning signs:** Subscription connects successfully but callback never fires.

### Pitfall 2: RLS Blocks Realtime Events
**What goes wrong:** Realtime subscription works for unauthenticated users but not for authenticated users, or vice versa.
**Why it happens:** Supabase Realtime checks RLS policies before delivering events. The `datasets` table already has `SELECT` policy for `auth.uid() = user_id`, which should work. But the browser client must be authenticated (cookies present) for `auth.uid()` to resolve.
**How to avoid:** Use the browser client from `createClient()` (which uses the anon key + user session cookies). Verify the existing RLS policy for `datasets` covers SELECT for the authenticated user.
**Warning signs:** Events arrive in the Supabase Realtime dashboard but not in the client.

### Pitfall 3: Realtime UPDATE Payload Missing Columns
**What goes wrong:** `payload.new` only contains the columns that changed, not the full row.
**Why it happens:** By default, Supabase Realtime sends the full new row for UPDATE events, but only if `REPLICA IDENTITY` is set appropriately. The default `REPLICA IDENTITY DEFAULT` sends only the primary key in `payload.old`. The `payload.new` should contain the full new row.
**How to avoid:** The `payload.new` for UPDATE events should include all columns. Verify in testing that `payload.new.file_name`, `payload.new.status`, etc. are present. If not, set `ALTER TABLE datasets REPLICA IDENTITY FULL;`.
**Warning signs:** `payload.new.file_name` is undefined in the callback.

### Pitfall 4: FastAPI BackgroundTasks Exception Handling
**What goes wrong:** Background task throws an exception, but the status never updates to `validation_error`, leaving the dataset stuck in `validating` state.
**Why it happens:** Exceptions in BackgroundTasks are logged by Starlette but not re-raised. If the try/except in the background function does not catch all exceptions, the status update to `validation_error` never runs.
**How to avoid:** Wrap the entire background function body in a broad try/except that always updates status on failure. The existing code already has this pattern -- make sure it carries over to the extracted background function.
**Warning signs:** Datasets stuck in `validating` status indefinitely.

### Pitfall 5: Race Condition Between Next.js and FastAPI Status Updates
**What goes wrong:** Next.js sets status to `validating`, then FastAPI also sets status to `validating`, creating a redundant write.
**Why it happens:** Both services try to set the initial status.
**How to avoid:** The Next.js route sets `validating` before calling FastAPI. FastAPI should NOT set `validating` again -- it should only write `validated` or `validation_error` at the end. Remove the `status: validating` update from FastAPI's validate endpoint.
**Warning signs:** Two UPDATE events fire for the same transition.

### Pitfall 6: Toast Requires Navigation Context
**What goes wrong:** Toast action onClick tries to navigate but the router is not available.
**Why it happens:** The toast fires from a useEffect callback where Next.js router may not be properly scoped.
**How to avoid:** Use `useRouter()` from `next/navigation` in the RealtimeProvider component and pass it to the toast action callback. The router reference is stable across renders.
**Warning signs:** Clicking toast action does nothing or throws an error.

## Code Examples

### Sonner Toast with Action Button
```typescript
// Source: https://sonner.emilkowal.ski/toast
toast.success('Validation complete -- 3 critical, 5 warnings', {
  action: {
    label: 'View Results',
    onClick: () => router.push(`/projects/${projectId}/jobs/${jobId}/files/${datasetId}`),
  },
})

toast.error('Validation failed: insufficient data columns', {
  action: {
    label: 'View Details',
    onClick: () => router.push(`/projects/${projectId}/jobs/${jobId}/files/${datasetId}`),
  },
})
```

### Supabase Realtime Channel with Filter
```typescript
// Source: https://supabase.com/docs/guides/realtime/postgres-changes
const channel = supabase
  .channel('dataset-status-changes')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'datasets',
      filter: `user_id=eq.${userId}`,
    },
    (payload) => {
      // payload.new contains full updated row
      // payload.old contains only primary key (unless REPLICA IDENTITY FULL)
      const { id, status, file_name } = payload.new
    }
  )
  .subscribe()

// Cleanup
return () => { supabase.removeChannel(channel) }
```

### FastAPI BackgroundTasks
```python
# Source: https://fastapi.tiangolo.com/tutorial/background-tasks/
from fastapi import BackgroundTasks

@router.post("/validate", status_code=202)
def validate_dataset(request: ValidateRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(run_validation_background, request.dataset_id, request.config)
    return {"status": "accepted", "dataset_id": request.dataset_id}
```

### Animated Processing Badge (Tailwind)
```typescript
// Pulsing badge for 'validating' status
case "validating":
  return (
    <Badge variant="default" className="gap-1 animate-pulse">
      <Loader2 className="size-3 animate-spin" />
      Processing...
    </Badge>
  )
```

### Migration: Enable Realtime on Datasets Table
```sql
-- Add datasets table to supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE datasets;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Celery + Redis for background tasks | FastAPI BackgroundTasks for simple fire-and-forget | Always available in FastAPI | No extra infrastructure for MVP |
| Polling for status updates | Supabase Realtime postgres_changes | Supabase v2+ | Push-based, zero latency, zero infrastructure |
| Custom WebSocket server | Supabase Realtime channels | Supabase v2+ | Handled by Supabase infrastructure |

**Deprecated/outdated:**
- None relevant -- all approaches used here are current and stable.

## Open Questions

1. **Toast needs project/job context for navigation links**
   - What we know: The Realtime payload contains dataset row data (id, job_id, user_id, file_name, status). It does NOT contain project_id directly.
   - What's unclear: How to construct the full URL `/projects/{projectId}/jobs/{jobId}/files/{datasetId}` from the Realtime payload. The `datasets` table has `job_id` but not `project_id`. Would need to query `jobs` table for `project_id`.
   - Recommendation: Either (a) add a quick Supabase query in the Realtime callback to fetch project_id from jobs table, or (b) add `project_id` to the datasets table as a denormalized field. Option (a) is simpler and sufficient for MVP since this only fires on status change events (infrequent).

2. **Validation summary in success toast**
   - What we know: User wants "Validation complete -- 3 critical, 5 warnings -- View results" in the toast.
   - What's unclear: The Realtime UPDATE payload for datasets only contains dataset columns (status, file_name, etc.), not validation_runs columns (critical_count, warning_count).
   - Recommendation: After receiving the `validated` status change, query the latest validation_run for that dataset to get counts, then fire the toast with the summary. This adds one small async query per completion event.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework (frontend) | Vitest 4.x + jsdom + @testing-library/react |
| Framework (backend) | pytest |
| Config file (frontend) | vitest.config.ts |
| Config file (backend) | backend/pyproject.toml |
| Quick run command (frontend) | `npx vitest run --reporter=verbose` |
| Quick run command (backend) | `cd backend && python -m pytest -x` |
| Full suite command | `npx vitest run && cd backend && python -m pytest` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROC-01 | API route returns 202 immediately without awaiting FastAPI | unit | `npx vitest run src/app/api/validate/route.test.ts -x` | No -- Wave 0 |
| PROC-01 | FastAPI validate endpoint returns 202 and runs background task | unit | `cd backend && python -m pytest tests/test_async_validate.py -x` | No -- Wave 0 |
| PROC-02 | RealtimeProvider fires toast on dataset status change | unit | `npx vitest run src/components/realtime-provider.test.ts -x` | No -- Wave 0 |
| PROC-02 | StatusBadge renders animated state for validating | unit | `npx vitest run src/components/files/file-list.test.ts -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run` (frontend) or `cd backend && python -m pytest -x` (backend)
- **Per wave merge:** Full suite
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/test_async_validate.py` (backend) -- covers PROC-01 FastAPI background task behavior
- [ ] Test for API route returning 202 -- covers PROC-01 Next.js side (may be manual-only due to fetch mocking complexity)
- [ ] Test for RealtimeProvider toast firing -- covers PROC-02 (requires Supabase client mock)
- [ ] Test for animated StatusBadge rendering -- covers PROC-02

## Sources

### Primary (HIGH confidence)
- [Supabase Realtime Postgres Changes docs](https://supabase.com/docs/guides/realtime/postgres-changes) -- channel API, filter syntax, RLS requirements, publication setup
- [FastAPI Background Tasks docs](https://fastapi.tiangolo.com/tutorial/background-tasks/) -- BackgroundTasks injection, add_task API, limitations
- [Sonner toast API](https://sonner.emilkowal.ski/toast) -- action prop with label/onClick, description, custom JSX

### Secondary (MEDIUM confidence)
- [Supabase Realtime publication setup](https://github.com/orgs/supabase/discussions/13680) -- ALTER PUBLICATION syntax verification
- Existing codebase analysis -- RLS policies, current validate route, FileDetailView, FileList, dashboard layout

### Tertiary (LOW confidence)
- None -- all findings verified with official documentation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in project, APIs verified with official docs
- Architecture: HIGH -- patterns derived from existing codebase + official docs, straightforward refactoring
- Pitfalls: HIGH -- publication/RLS requirements well-documented, BackgroundTasks exception handling verified

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (stable -- no fast-moving dependencies)
