# Phase 23: One-Click Data Fixes - Research

**Researched:** 2026-04-10
**Domain:** Client-side data transformation with preview/undo UX
**Confidence:** HIGH

## Summary

Phase 23 transforms the existing auto-clean engine from an all-or-nothing bulk operation into individual, user-controlled one-click fixes. The codebase already has `auto-clean.ts` with working implementations of `removeDuplicates`, `interpolateGaps`, and `removeSpikes` -- the core algorithms exist. The work is primarily a UX refactoring: breaking the monolithic `autoClean()` into individual fix functions that can be previewed (before/after diff), applied one at a time, and undone.

The pipeline state machine (`pipeline-state.ts`) already has `CLEAN_COMPLETE` and `AI_FIX_APPLIED` actions. The new one-click fixes fit naturally as a new action type (e.g., `ONE_CLICK_FIX`) that updates `parsedData` incrementally. The undo requirement maps cleanly to a stack of previous data snapshots stored in component state (not persisted to sessionStorage due to size).

**Primary recommendation:** Refactor `auto-clean.ts` to export individual fix functions (`fillMissing`, `removeDuplicates`, `smoothSpikes`) that operate on a single issue or issue type, returning a `FixPreview` with before/after rows. Build the UI as fix action buttons on each validation issue in the Clean stage, with a diff modal preview and an undo stack.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CLEN-01 | One-click fix for missing values (interpolation) | `interpolateGaps()` already exists in auto-clean.ts; needs refactoring to target specific rows/columns and return preview data |
| CLEN-02 | One-click duplicate removal | `removeDuplicates()` already exists in auto-clean.ts; needs refactoring to target specific duplicate rows with preview |
| CLEN-03 | One-click spike smoothing | `removeSpikes()` already exists in auto-clean.ts; needs refactoring to target specific outlier values with preview |
| CLEN-04 | Before vs after diff preview of cleaning actions | New UI component -- diff table showing affected rows with old/new values highlighted, confirmation button |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React (hooks) | 19 | Component state for undo stack, fix previews | Already in project |
| TypeScript | 5.x | Type safety for fix functions and preview types | Already in project |
| Lucide React | latest | Icons for fix buttons (Eraser, Merge, TrendingDown) | Already in project |
| shadcn/ui | v4 | Card, Button, Dialog components | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sonner | latest | Toast notifications for fix applied/undone | Already in project |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Client-side fixes | Backend FastAPI fixes | Unnecessary network round-trip for simple array ops; client-side is instant |
| Full data snapshot undo | Incremental reverse operations | Snapshots are simpler, use more memory but datasets are <50MB |

**Installation:**
No new dependencies needed. Everything is already in the project.

## Architecture Patterns

### Recommended Project Structure
```
src/app/(dashboard)/pipeline/
  lib/
    auto-clean.ts         # Existing -- refactor to export individual fix functions
    fix-engine.ts         # NEW: individual fix functions with preview support
    fix-types.ts          # NEW: FixPreview, FixResult, UndoEntry types
  components/
    stage-clean.tsx        # Existing -- enhance with one-click fix buttons
    fix-preview-modal.tsx  # NEW: before/after diff preview dialog
    fix-action-bar.tsx     # NEW: fix buttons row for each issue type
tests/pipeline/
    fix-engine.test.ts     # NEW: unit tests for individual fix functions
```

### Pattern 1: Individual Fix Functions (Refactor from auto-clean.ts)
**What:** Extract the 3 fix types from `autoClean()` into standalone functions that operate on specific issues and return previews
**When to use:** Each one-click fix button triggers one of these
**Example:**
```typescript
// Source: Derived from existing auto-clean.ts patterns
export interface FixPreview {
  type: "fill_missing" | "remove_duplicates" | "smooth_spikes"
  affectedRows: {
    rowIndex: number        // 1-indexed (matches ValidationIssue.row)
    column?: string
    before: string
    after: string
    explanation: string
  }[]
  totalAffected: number
}

export interface FixResult {
  data: string[][]          // Full dataset after fix
  preview: FixPreview       // What changed
  undoSnapshot: string[][]  // Data before fix (for undo)
}

export function previewFillMissing(
  data: string[][],
  issues: ValidationIssue[]
): FixPreview { ... }

export function applyFillMissing(
  data: string[][],
  issues: ValidationIssue[]
): FixResult { ... }
```

### Pattern 2: Undo Stack in Component State
**What:** Store previous data snapshots in a stack (array) within the StageClean component state
**When to use:** Every fix application pushes the pre-fix data onto the stack; undo pops it
**Example:**
```typescript
const [undoStack, setUndoStack] = useState<UndoEntry[]>([])

interface UndoEntry {
  data: string[][]
  label: string  // e.g. "Fill Missing (3 values)"
  timestamp: number
}

function handleApplyFix(result: FixResult, label: string) {
  setUndoStack(prev => [...prev, {
    data: result.undoSnapshot,
    label,
    timestamp: Date.now(),
  }])
  dispatch({ type: "ONE_CLICK_FIX", updatedData: result.data })
}

function handleUndo() {
  if (undoStack.length === 0) return
  const last = undoStack[undoStack.length - 1]
  setUndoStack(prev => prev.slice(0, -1))
  dispatch({ type: "ONE_CLICK_FIX", updatedData: last.data })
  toast(`Undid: ${last.label}`)
}
```

### Pattern 3: Fix Preview Modal (Before/After Diff)
**What:** A modal dialog that shows exactly which rows/values will change before the user confirms
**When to use:** Every one-click fix shows this before applying
**Example:**
```typescript
// Preview table with before/after columns
// Red strikethrough for old values, green highlight for new values
// Confirm/Cancel buttons at bottom
// Same visual language as AI suggestion cards in current stage-clean.tsx
```

### Pattern 4: Pipeline State Action for One-Click Fixes
**What:** Reuse existing `AI_FIX_APPLIED` action type for one-click fix data updates
**When to use:** When a fix is applied or undone
**Rationale:** `AI_FIX_APPLIED` already does exactly what one-click fixes need -- update `cleanedData` and `parsedData` with new data. No need for a new action type.

### Anti-Patterns to Avoid
- **Don't persist undo stack to sessionStorage:** Data snapshots are too large. Keep in component state only -- user loses undo history on page refresh, which is acceptable.
- **Don't run all 3 fixes at once:** The whole point of "one-click" is individual control. The existing `autoClean()` can stay as a separate "Auto-Fix All" button.
- **Don't modify parsedData in-place:** Always create deep copies. The existing code already does this with `.map(r => [...r])`.
- **Don't show preview for zero-affected-row fixes:** If a fix type finds nothing to fix, show a toast "No X found" instead of opening an empty modal.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Linear interpolation | Custom math | Existing `interpolateGaps()` in auto-clean.ts | Already handles edge cases (gap size limits, NaN handling) |
| Spike detection | Custom z-score | Existing `removeSpikes()` in auto-clean.ts | Already handles minimum sample size, neighbor median |
| Duplicate detection | Custom dedup | Existing `removeDuplicates()` in auto-clean.ts | Already handles row key generation |
| Diff visualization | Custom table | Adapt existing `ActionRow` and `SuggestionCard` patterns from stage-clean.tsx | Consistent visual language |

**Key insight:** The algorithms already exist and are tested. This phase is 80% UX work (preview modal, individual buttons, undo) and 20% refactoring (extracting functions from `autoClean()`).

## Common Pitfalls

### Pitfall 1: Row Index Drift After Fixes
**What goes wrong:** After "Remove Duplicates" deletes rows, subsequent fixes reference stale row indices
**Why it happens:** ValidationIssue.row is 1-indexed from the original data; after row deletion, indices shift
**How to avoid:** After each fix that changes row count, re-validate or re-map issue row indices. Or: apply fixes to a working copy of the data and regenerate issue list.
**Warning signs:** Fix preview shows wrong row data

### Pitfall 2: Memory Pressure from Undo Snapshots
**What goes wrong:** Each undo entry stores a full deep copy of the dataset (string[][])
**Why it happens:** 50MB file limit means snapshots could be large
**How to avoid:** Limit undo stack to 10 entries. For datasets >10K rows, consider storing only changed rows (delta undo). For MVP, full snapshots are fine since most pipeline datasets are <5K rows.
**Warning signs:** Browser tab memory usage climbing

### Pitfall 3: Fix Preview Showing Stale Data
**What goes wrong:** Preview computed from original parsedData, but user already applied a previous fix
**Why it happens:** Preview functions read from state.parsedData which may not be updated yet
**How to avoid:** Always compute previews from the current working data (cleanedData ?? parsedData), not from the original parsedData
**Warning signs:** Preview shows values that don't match what the user sees

### Pitfall 4: Audit Trail Missing Fix Context
**What goes wrong:** Audit log records "fix applied" but not what type or which rows
**Why it happens:** Forgetting to include the FixPreview details in the audit metadata
**How to avoid:** Pass `preview.affectedRows` (capped at 100) to `logAuditClient()` metadata, same pattern as existing `clean.ai_fix` audit entries
**Warning signs:** Audit timeline shows "Fix applied" with no details

## Code Examples

### Individual Fix Function (extracted from auto-clean.ts)
```typescript
// Source: Refactored from auto-clean.ts interpolateGaps()
export function previewFillMissing(
  data: string[][],
  targetColumn?: string
): FixPreview {
  const headers = data[0]
  const rows = data.slice(1)
  const numericCols = detectNumericColumns(headers, rows)
  const kpIdx = findKpColumn(headers)
  const affectedRows: FixPreview["affectedRows"] = []

  const colIndices = targetColumn
    ? [headers.findIndex(h => h === targetColumn)]
    : numericCols

  for (const colIdx of colIndices) {
    if (colIdx === -1) continue
    for (let i = 0; i < rows.length; i++) {
      const val = rows[i][colIdx]?.trim() ?? ""
      if (val !== "") continue
      const interpolated = computeInterpolation(rows, i, colIdx)
      if (interpolated !== null) {
        affectedRows.push({
          rowIndex: i + 2,
          column: headers[colIdx],
          before: "(empty)",
          after: String(interpolated),
          explanation: `Linear interpolation from surrounding values`,
        })
      }
    }
  }

  return {
    type: "fill_missing",
    affectedRows,
    totalAffected: affectedRows.length,
  }
}
```

### Undo Button Pattern
```typescript
// Source: Project pattern from stage-clean.tsx
{undoStack.length > 0 && (
  <Button variant="outline" onClick={handleUndo}>
    <Undo2 className="mr-2 size-4" />
    Undo: {undoStack[undoStack.length - 1].label}
  </Button>
)}
```

### Audit Logging for One-Click Fix
```typescript
// Source: Existing pattern from stage-clean.tsx handleAcceptSuggestion()
logAuditClient({
  action: "clean.one_click_fix",
  entityType: "dataset",
  entityId: state.datasetId ?? undefined,
  metadata: {
    fixType: preview.type,
    rowsAffected: preview.totalAffected,
    changes: preview.affectedRows.slice(0, 100).map(r => ({
      row: r.rowIndex,
      column: r.column,
      before: r.before,
      after: r.after,
    })),
    totalChanges: preview.totalAffected,
    changesTruncated: preview.totalAffected > 100,
  },
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Monolithic autoClean() runs all passes | Individual one-click fixes with preview | This phase | User control over each fix type |
| No undo capability | Undo stack with data snapshots | This phase | Reversibility builds trust |
| Changes shown after the fact | Before/after preview before applying | This phase | Informed consent on data changes |

**Existing code to preserve:**
- `autoClean()` should remain as an "Auto-Fix All" option alongside one-click fixes
- `CleanAction` and `CleanResult` types remain for the auto-fix flow
- The AI assist flow (`handleAiAssist`, `SuggestionCard`) is independent and stays unchanged

## Open Questions

1. **Should one-click fixes be available from the Validate stage or only Clean stage?**
   - What we know: Currently only the Clean stage has fix capabilities
   - What's unclear: Whether showing fix buttons inline with validation issues (in Validate/Review stages) would be more intuitive
   - Recommendation: Keep fixes in Clean stage only to maintain the pipeline's linear flow. The stepper already guides users there.

2. **Should the "Auto-Fix All" button remain alongside individual fixes?**
   - What we know: The existing auto-fix runs all passes in order
   - What's unclear: Whether having both is confusing
   - Recommendation: Keep both. Auto-fix for quick users, one-click for careful users. Show auto-fix as a secondary option below the individual fix buttons.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 1.x with jsdom |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run tests/pipeline/fix-engine.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CLEN-01 | Fill missing interpolates gaps correctly | unit | `npx vitest run tests/pipeline/fix-engine.test.ts -t "fill missing"` | Wave 0 |
| CLEN-02 | Remove duplicates keeps first occurrence | unit | `npx vitest run tests/pipeline/fix-engine.test.ts -t "remove duplicates"` | Wave 0 |
| CLEN-03 | Smooth spikes replaces outliers with interpolated values | unit | `npx vitest run tests/pipeline/fix-engine.test.ts -t "smooth spikes"` | Wave 0 |
| CLEN-04 | Preview returns before/after diff without modifying data | unit | `npx vitest run tests/pipeline/fix-engine.test.ts -t "preview"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/pipeline/fix-engine.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/pipeline/fix-engine.test.ts` -- covers CLEN-01, CLEN-02, CLEN-03, CLEN-04
- [ ] Framework install: None needed -- Vitest already configured

## Sources

### Primary (HIGH confidence)
- Codebase: `src/app/(dashboard)/pipeline/lib/auto-clean.ts` -- existing fix algorithms
- Codebase: `src/app/(dashboard)/pipeline/lib/pipeline-state.ts` -- state machine with AI_FIX_APPLIED action
- Codebase: `src/app/(dashboard)/pipeline/components/stage-clean.tsx` -- existing Clean stage UI with AI suggestion cards
- Codebase: `src/app/(dashboard)/pipeline/pipeline-workflow.tsx` -- state flow and issue filtering
- Codebase: `src/lib/audit-client.ts` -- audit logging pattern

### Secondary (MEDIUM confidence)
- Project STATE.md decisions on pipeline patterns and sessionStorage persistence

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, all patterns exist in codebase
- Architecture: HIGH - refactoring existing code with well-understood patterns
- Pitfalls: HIGH - identified from reading actual code (row index drift, memory, stale data)

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stable -- internal refactoring, no external dependencies)
