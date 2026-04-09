# Phase 18: Issue Triage & Manual Overrides - Research

**Researched:** 2026-04-09
**Domain:** Pipeline UI state management, issue review workflow, bulk actions
**Confidence:** HIGH

## Summary

Phase 18 adds a "Review" stage between Validate and Clean in the pipeline workflow. This is primarily a frontend state management and UI task -- extending the existing pipeline reducer with a new stage, adding triage decision tracking to pipeline state, and building a review UI that reuses the IssuesTable pattern with checkboxes and action buttons.

The codebase already has all the building blocks: the pipeline uses a useReducer state machine with discriminated union actions, IssuesTable provides severity filtering and grouped/flat views, stage-clean.tsx demonstrates the accept/reject pattern with audit logging, and the audit_logs table supports JSONB metadata for any action type. No new libraries are needed. The work is extending existing patterns to a new stage.

**Primary recommendation:** Extend the pipeline state machine with a "review" stage and triage decisions map, build stage-review.tsx reusing IssuesTable with checkbox + action button extensions, and wire the Clean stage to filter issues by triage decision.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- New 6th pipeline stage called "Review" between Validate and Clean
- Pipeline becomes: Import -> Inspect -> Validate -> Review -> Clean -> Export
- Optional with nudge -- if skipped, show warning ("X issues not reviewed") consistent with smart gating pattern
- Auto-skip with toast message when validation found 0 issues ("No issues found -- skipping review")
- Shows all issues with severity filter tabs (All / Critical / Warning / Info), reusing existing IssuesTable pattern
- Three actions per issue: Accept, Reject, Defer
  - Accept = "real issue, fix it in Clean"
  - Reject = "false positive, ignore"
  - Defer = "acknowledged but not fixing now"
- Justification required for Reject, optional for Accept and Defer
- Inline action buttons on each row (right-aligned), clicking Reject opens inline comment field
- Acted-on issues get status badge + subtle row styling (green border/tint = accepted, red = rejected, amber = deferred)
- Issues stay visible in list after being acted on (no moving to separate tabs)
- Checkbox on each row, "select all" checkbox in header
- Floating action toolbar appears when >=1 issue selected
- Bulk actions: Accept All / Reject All / Defer All (same three actions as individual)
- Bulk reject prompts for a single shared justification applied to all selected issues
- Progress bar + counts at top of stage: "Reviewed: 12/45 issues -- 8 accepted, 3 rejected, 1 deferred"
- Stage complete when all issues have a decision (accept/reject/defer) -- stepper checkmark at 100%
- Partial review shows progress percentage in stepper
- Accepted issues feed into Clean stage as suggested fixes -- rejected/deferred excluded from cleaning
- Users can navigate back to Review from Clean and change decisions (re-editable)

### Claude's Discretion
- Floating toolbar design and positioning
- Exact color values for status tints (within the existing teal/blue/amber/red palette)
- Animation/transition when applying bulk actions
- Toast notification design for auto-skip
- How inline comment field expands/collapses on Reject

### Deferred Ideas (OUT OF SCOPE)
- Pre-filled rejection template options (e.g., "Expected behavior", "False positive", "Out of scope")
- Issue comment threads (multiple comments per issue)
- Saving triage decisions as reusable templates across similar datasets
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React useReducer | React 19 | Pipeline state machine | Already used for all pipeline state management |
| Tailwind CSS | 4.x | Styling for review UI, status tints, floating toolbar | Project standard |
| Lucide React | latest | Icons (Check, X, Clock, CheckSquare, Square) | Project standard icon set |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn/ui Badge | existing | Status badges on triaged issues | Per-row decision status display |
| shadcn/ui Dialog | existing | Bulk reject justification modal | When bulk rejecting with shared justification |
| logAuditClient | existing | Fire-and-forget audit logging | Every triage action (accept/reject/defer/bulk) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| In-state triage map | Supabase table | Adds DB round-trip; pipeline is client-side, keep triage in state until export/save |
| Dialog for bulk reject | Inline expansion | Dialog is cleaner for a single shared justification across many items |

**Installation:**
No new dependencies needed. All required components exist in the project.

## Architecture Patterns

### Recommended Project Structure
```
src/app/(dashboard)/pipeline/
  lib/
    pipeline-state.ts        # MODIFY: add "review" stage, triage types, triage actions
    pipeline-store.ts        # No changes needed (serializes full state)
  components/
    pipeline-stepper.tsx     # MODIFY: add 6th "Review" step to STAGE_CONFIG
    stage-review.tsx         # NEW: triage review stage component
    pipeline-workflow.tsx    # MODIFY: render StageReview, pass triage state
    stage-clean.tsx          # MODIFY: filter issues by triage decisions
```

### Pattern 1: Pipeline State Machine Extension
**What:** Add "review" to PipelineStage union, add triage decisions to PipelineState, add new reducer actions
**When to use:** This is the core pattern -- all pipeline stage logic lives in the reducer
**Example:**
```typescript
// In pipeline-state.ts
export type PipelineStage =
  | "import" | "inspect" | "validate" | "review" | "clean" | "export"

export type TriageDecision = "accept" | "reject" | "defer"

export interface TriageEntry {
  decision: TriageDecision
  justification: string | null
  timestamp: number
}

// Map from issue index/ID to triage decision
export interface PipelineState {
  // ... existing fields ...
  triageDecisions: Record<string, TriageEntry>
  triageAutoSkipped: boolean
}

// New actions
export type PipelineAction =
  | // ... existing actions ...
  | { type: "TRIAGE_ISSUE"; issueId: string; decision: TriageDecision; justification: string | null }
  | { type: "TRIAGE_BULK"; issueIds: string[]; decision: TriageDecision; justification: string | null }
  | { type: "SKIP_REVIEW" }
  | { type: "REVIEW_COMPLETE" }
  | { type: "AUTO_SKIP_REVIEW" }
```

### Pattern 2: Issue Identity in Client Pipeline
**What:** The client-side ValidationIssue (from client-validate.ts) does NOT have an `id` field. Need a stable identifier for triage decisions.
**When to use:** For mapping triage decisions to specific issues
**Example:**
```typescript
// Generate stable issue IDs from issue properties
function getIssueId(issue: ValidationIssue, index: number): string {
  // Use combination of type + row + column for stable identity
  // Fall back to index if properties aren't unique
  return `${issue.type}-${issue.row ?? 'x'}-${issue.column ?? 'x'}-${index}`
}
```

### Pattern 3: Floating Bulk Action Toolbar
**What:** Fixed-position toolbar at bottom of viewport when issues are selected
**When to use:** Gmail-style bulk action bar
**Example:**
```typescript
// Positioned fixed at bottom, only visible when selection.size > 0
<div className={cn(
  "fixed bottom-6 left-1/2 -translate-x-1/2 z-50",
  "flex items-center gap-3 rounded-2xl border bg-card px-5 py-3 shadow-lg",
  "transition-all duration-200",
  selectedIds.size > 0 ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 pointer-events-none"
)}>
  <span className="text-sm font-medium">{selectedIds.size} selected</span>
  <button onClick={handleBulkAccept}>Accept All</button>
  <button onClick={handleBulkReject}>Reject All</button>
  <button onClick={handleBulkDefer}>Defer All</button>
</div>
```

### Pattern 4: Conditional Stage Auto-Skip
**What:** When validation finds 0 issues, auto-skip Review with toast notification
**When to use:** In the VALIDATE_COMPLETE reducer action or in the workflow component
**Example:**
```typescript
// In pipeline-workflow.tsx, after VALIDATE_COMPLETE
useEffect(() => {
  if (state.currentStage === "review" && state.issueCount === 0) {
    dispatch({ type: "AUTO_SKIP_REVIEW" })
    toast("No issues found -- skipping review")
  }
}, [state.currentStage, state.issueCount])
```

### Pattern 5: Review Gating with Progress
**What:** Stage complete = all issues have decisions. Stepper shows partial progress.
**When to use:** For the canNavigateTo and stepper display logic
**Example:**
```typescript
// Progress calculation
const totalIssues = validationIssues.length
const reviewedCount = Object.keys(state.triageDecisions).length
const progress = totalIssues > 0 ? Math.round((reviewedCount / totalIssues) * 100) : 100
const isComplete = reviewedCount >= totalIssues

// Stepper summary shows progress
summary: isComplete
  ? `${reviewedCount} reviewed`
  : `${reviewedCount}/${totalIssues} reviewed (${progress}%)`
```

### Anti-Patterns to Avoid
- **Separate triage state outside reducer:** All triage decisions must live in PipelineState to benefit from sessionStorage persistence and single-source-of-truth
- **Mutating issues array directly:** Never add triage fields to ValidationIssue objects. Use a separate decisions map keyed by issue ID
- **Database writes during triage:** Triage is client-side pipeline state. Audit logs fire-and-forget is fine, but don't create a database table for triage decisions -- they persist via sessionStorage with the rest of pipeline state
- **Moving reviewed issues to separate lists:** Per user decision, issues stay visible in the same list with status styling. Do not filter them out or move them to "reviewed" tabs

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Issue table with severity tabs | New table component | Extend existing IssuesTable | Already has severity filtering, grouped/flat views, expandable rows |
| Accept/reject UI pattern | Custom action buttons | Mirror stage-clean.tsx SuggestionCard pattern | Proven accept/reject with audit logging pattern |
| Audit logging | Custom fetch calls | logAuditClient / logAuditClientBatch | Existing fire-and-forget helper handles errors silently |
| State persistence | Custom localStorage | Existing pipeline-store.ts | Already serializes/deserializes full PipelineState |
| Toast notifications | Custom notification | Existing toast system (sonner or similar) | Check what the project uses for the "Realtime toasts" pattern |

**Key insight:** This phase is almost entirely about extending existing patterns, not building new infrastructure. The IssuesTable, pipeline reducer, audit logging, and stage component layout are all established.

## Common Pitfalls

### Pitfall 1: Issue Identity Instability
**What goes wrong:** Client-side ValidationIssue has no `id` field. If you use array index as key, triage decisions break when issues are filtered/sorted.
**Why it happens:** The client-validate.ts interface uses `type`, `severity`, `row`, `column`, `message` but no unique identifier.
**How to avoid:** Generate deterministic IDs from issue properties (type + row + column + index). Store triage decisions keyed by these IDs. The ID generation must be consistent across re-renders.
**Warning signs:** Triage decisions "jump" between issues after severity filter changes.

### Pitfall 2: STAGE_ORDER vs. STAGE_CONFIG Desync
**What goes wrong:** Adding "review" to STAGE_ORDER but forgetting STAGE_CONFIG in pipeline-stepper.tsx (or vice versa), causing stepper to crash or skip the step.
**Why it happens:** Stage configuration is spread across multiple files: pipeline-state.ts (types, STAGE_ORDER, canNavigateTo, reducer), pipeline-stepper.tsx (STAGE_CONFIG visual config), pipeline-workflow.tsx (stage rendering switch).
**How to avoid:** Update all 4 locations atomically: (1) PipelineStage type, (2) STAGE_ORDER array, (3) STAGE_CONFIG array in stepper, (4) stage rendering in workflow. Also update canNavigateTo and reducer cases.
**Warning signs:** TypeScript errors about missing cases in switch statements (which is good -- exhaustive checking catches this).

### Pitfall 3: Clean Stage Not Filtering by Triage
**What goes wrong:** Clean stage receives all validation issues regardless of triage decision, applying fixes to rejected/deferred issues.
**Why it happens:** Currently stage-clean.tsx receives `validationIssues` directly from workflow state. Need to filter this array before passing.
**How to avoid:** In pipeline-workflow.tsx, compute `acceptedIssues` by filtering validationIssues against triageDecisions. Pass only accepted issues to StageClean.
**Warning signs:** Auto-fix applies to issues the user explicitly rejected as false positives.

### Pitfall 4: SessionStorage Bloat from Triage Decisions
**What goes wrong:** Large datasets with hundreds of issues create large triage decision maps that exceed sessionStorage limits (~5MB).
**Why it happens:** Each TriageEntry has decision + justification + timestamp, multiplied by hundreds of issues.
**How to avoid:** Keep justification strings short (enforce max length). The existing pipeline store already serializes the full state -- monitor size. For MVP scale (max 50MB files, likely <500 issues) this should be fine.
**Warning signs:** `savePipelineState` silently fails (try/catch swallows the error).

### Pitfall 5: Reducer Returning New Stage Order Incorrectly
**What goes wrong:** VALIDATE_COMPLETE currently sets `currentStage: "clean"`. Must change to `currentStage: "review"`.
**Why it happens:** Direct stage transition in existing reducer needs updating.
**How to avoid:** Change VALIDATE_COMPLETE to transition to "review" instead of "clean". Update canNavigateTo to gate "clean" on "review" being completed/skipped.
**Warning signs:** Pipeline skips directly from Validate to Clean, never showing Review.

## Code Examples

### Extending PipelineState Types
```typescript
// pipeline-state.ts additions
export type TriageDecision = "accept" | "reject" | "defer"

export interface TriageEntry {
  decision: TriageDecision
  justification: string | null
  timestamp: number
}

// Add to PipelineState interface:
triageDecisions: Record<string, TriageEntry>
triageAutoSkipped: boolean

// Add to initialState:
triageDecisions: {},
triageAutoSkipped: false,
```

### Reducer Cases for Triage
```typescript
case "TRIAGE_ISSUE": {
  return {
    ...state,
    triageDecisions: {
      ...state.triageDecisions,
      [action.issueId]: {
        decision: action.decision,
        justification: action.justification,
        timestamp: Date.now(),
      },
    },
  }
}

case "TRIAGE_BULK": {
  const newDecisions = { ...state.triageDecisions }
  for (const id of action.issueIds) {
    newDecisions[id] = {
      decision: action.decision,
      justification: action.justification,
      timestamp: Date.now(),
    }
  }
  return { ...state, triageDecisions: newDecisions }
}

case "SKIP_REVIEW": {
  return {
    ...state,
    currentStage: "clean",
    stages: {
      ...state.stages,
      review: {
        completed: false,
        skipped: true,
        summary: "Skipped -- issues not reviewed",
      },
    },
  }
}

case "REVIEW_COMPLETE": {
  const total = Object.keys(state.triageDecisions).length
  const accepted = Object.values(state.triageDecisions).filter(d => d.decision === "accept").length
  const rejected = Object.values(state.triageDecisions).filter(d => d.decision === "reject").length
  const deferred = Object.values(state.triageDecisions).filter(d => d.decision === "defer").length
  return {
    ...state,
    currentStage: "clean",
    stages: {
      ...state.stages,
      review: {
        completed: true,
        skipped: false,
        summary: `${accepted} accepted, ${rejected} rejected, ${deferred} deferred`,
      },
    },
  }
}
```

### Audit Logging Pattern for Triage
```typescript
// Individual triage action
logAuditClient({
  action: `triage.${decision}`,
  entityType: "dataset",
  entityId: state.datasetId ?? undefined,
  metadata: {
    issueId,
    issueType: issue.type,
    row: issue.row,
    column: issue.column,
    decision,
    justification,
  },
})

// Bulk triage action
logAuditClient({
  action: "triage.bulk_action",
  entityType: "dataset",
  entityId: state.datasetId ?? undefined,
  metadata: {
    decision,
    count: issueIds.length,
    justification,
  },
})
```

### Updated canNavigateTo
```typescript
export function canNavigateTo(
  state: PipelineState,
  targetStage: PipelineStage
): boolean {
  switch (targetStage) {
    case "import":
      return true
    case "inspect":
      return state.stages.import.completed
    case "validate":
      return state.stages.inspect.completed
    case "review":
      return state.stages.validate.completed || state.stages.validate.skipped
    case "clean":
      // Clean available after review completed/skipped, or validate completed/skipped
      return state.stages.inspect.completed
    case "export":
      return state.stages.import.completed
    default:
      return false
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 5-stage pipeline | 6-stage pipeline with Review | Phase 18 | Review intercepts between Validate and Clean |
| All issues feed to Clean | Only accepted issues feed to Clean | Phase 18 | Users control what gets auto-fixed |
| No triage state | triageDecisions map in PipelineState | Phase 18 | Client-side decision tracking persisted in sessionStorage |

## Open Questions

1. **Toast implementation**
   - What we know: The project uses "Realtime toasts" (RealtimeProvider) for notifications. Sonner or similar is likely installed.
   - What's unclear: Exact toast API to use for the auto-skip notification.
   - Recommendation: Check existing toast imports in the codebase and reuse the same pattern.

2. **Issue count alignment between client and server validation**
   - What we know: Pipeline has two paths -- client-side validateClientSide() for uploaded files, and /api/validate for existing datasets. The ValidationIssue types differ (client has `type`, server has `rule_type`; client has no `id`, server does).
   - What's unclear: Whether Review stage needs to handle both issue formats.
   - Recommendation: Normalize to a common format in the workflow component before passing to StageReview. Use the client-side format as baseline since pipeline is client-first.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | No test framework currently configured |
| Config file | none |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| N/A | Triage state reducer (TRIAGE_ISSUE, TRIAGE_BULK, SKIP_REVIEW, REVIEW_COMPLETE) | unit | Manual verification | No |
| N/A | canNavigateTo with review stage | unit | Manual verification | No |
| N/A | Issue ID generation stability | unit | Manual verification | No |
| N/A | Progress calculation (reviewed/total) | unit | Manual verification | No |
| N/A | Clean stage filters by triage decisions | integration | Manual verification | No |

### Sampling Rate
- **Per task commit:** Manual browser testing of pipeline flow
- **Per wave merge:** Full pipeline walkthrough (Import -> Export) with triage
- **Phase gate:** Verify all pipeline stages work, triage decisions persist, clean filters correctly

### Wave 0 Gaps
No test infrastructure exists in this project. All verification is manual browser testing, consistent with all prior phases.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of pipeline-state.ts, pipeline-stepper.tsx, stage-clean.tsx, issues-table.tsx, pipeline-workflow.tsx, pipeline-store.ts, client-validate.ts, audit-client.ts
- Supabase migration 00008_audit_logs.sql for audit schema

### Secondary (MEDIUM confidence)
- STATE.md project decisions for established patterns (useReducer, sessionStorage, audit logging)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new libraries needed, all patterns exist in codebase
- Architecture: HIGH - Direct extension of existing pipeline state machine pattern
- Pitfalls: HIGH - Identified from actual code analysis (issue identity, stage order sync, clean filtering)

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (stable -- internal codebase patterns, no external dependencies)
