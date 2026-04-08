# Phase 17: Audit Trail & Data Lineage - Research

**Researched:** 2026-04-07
**Domain:** Audit logging, data lineage tracking, transformation snapshots, validation reproducibility
**Confidence:** HIGH

## Summary

Phase 17 builds on a **substantial existing audit infrastructure** that already covers the database table, RLS policies, server-side and client-side logging functions, an API endpoint, a backfill mechanism, and a working AuditTimeline component. The core work is filling gaps in what actions are logged, enriching metadata per event, adding before/after transformation snapshots, enabling validation re-run from stored config, and upgrading the timeline UI to show richer detail.

The existing `audit_logs` table with its JSONB `metadata` column is flexible enough to store all needed context without schema changes. The `validation_runs.config_snapshot` field already stores the full validation configuration, making re-run straightforward. The main technical challenge is capturing before/after data snapshots for transformations without bloating storage -- JSONB metadata with row-level diffs (not full dataset copies) is the right approach.

**Primary recommendation:** Extend the existing audit infrastructure rather than rebuilding. Add missing log calls for parse, column mapping, and profile changes. Store row-level before/after diffs in audit metadata for clean actions. Add a "Re-run with this config" button that reads config_snapshot from a previous validation_run.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUDT-01 | System tracks every action on a dataset (upload, parse, map, validate, clean, export) with timestamps and user attribution | Existing audit_logs table + logAudit/logAuditClient functions. Gaps: parse complete, column mapping confirmed, profile changes not logged. Need to add ~4 new log call sites. |
| AUDT-02 | User can view a visual timeline showing the full journey of their dataset through every processing stage | AuditTimeline component exists with icon/color/expand support. Needs: action configs for new event types (parse, map, profile), date grouping, and dataset-name header. |
| AUDT-03 | User can click any validation issue and see original value, detected problem, suggested fix, and final value after cleaning | IssueRowDetail already shows expected/actual + surrounding rows. Need to cross-reference audit_logs for clean.auto/clean.ai_fix entries matching same row/column to show "final value after cleaning". |
| AUDT-04 | System stores before/after snapshots for every data transformation (auto-clean, AI fix, manual override) | Auto-clean already logs metadata with counts. Need to enhance: store per-action before/after values in metadata JSONB. AI fix already stores before/after. Auto-clean actions need individual row-level diffs. |
| AUDT-05 | User can re-run a previous validation with the same configuration for reproducibility | validation_runs.config_snapshot already stores full ProfileConfig. Need UI: "Re-run with this config" button on run switcher that passes config_snapshot to the validate API. |
| AUDT-06 | Audit timeline displays rich metadata per event (issue counts, fix details, export format, config used) | ActionSummary component exists for validation.complete, clean.auto, clean.ai_fix, export.download. Need to add summaries for new event types and enhance existing ones with more detail. |
</phase_requirements>

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Supabase JS | ^2.x | Database queries, RLS-scoped audit reads/writes | Already used throughout project |
| Next.js Server Actions | 16.x | Server-side audit writes (logAudit) | Existing pattern |
| lucide-react | latest | Timeline icons per action type | Already used in AuditTimeline |
| shadcn/ui | v4 | Card, Table, Tabs, Button components | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sonner | latest | Toast notifications for re-run actions | Already wired via toast() |

### No New Dependencies Required
This phase requires zero new npm packages. Everything builds on existing infrastructure.

## Architecture Patterns

### Existing Audit Architecture (Keep As-Is)
```
src/
├── lib/
│   ├── actions/
│   │   ├── audit.ts              # Server-side logAudit() + logAuditBatch()
│   │   └── audit-read.ts         # Server-side getAuditLogs() + getProjectAuditLogs()
│   └── audit-client.ts           # Client-side logAuditClient() fire-and-forget
├── app/
│   └── api/
│       └── audit/
│           ├── route.ts          # POST endpoint for client audit writes
│           └── backfill/route.ts # Backfill entity_id for pipeline sessions
├── components/
│   └── files/
│       ├── audit-timeline.tsx    # Visual timeline with expand/collapse
│       └── issue-row-detail.tsx  # Issue detail with surrounding rows
```

### Pattern 1: Fire-and-Forget Audit Logging
**What:** Audit writes never block primary flow. Server-side uses try/catch with silent fail. Client-side uses fetch().catch(() => {}).
**When to use:** All audit logging -- always.
**Already implemented:** Yes, in both logAudit() and logAuditClient().

### Pattern 2: JSONB Metadata for Flexible Schema
**What:** Each audit action stores action-specific data in the metadata JSONB column rather than adding columns.
**When to use:** Every new event type -- put the details in metadata.
**Example for before/after snapshots:**
```typescript
// Auto-clean action with per-row diffs
logAuditClient({
  action: "clean.auto",
  entityType: "dataset",
  entityId: datasetId,
  metadata: {
    fileName: "survey.csv",
    totalActions: 5,
    duplicatesRemoved: 2,
    changes: [
      { row: 15, column: "DOB", before: "12.5", after: null, type: "remove_duplicate" },
      { row: 23, column: "KP", before: "1.234", after: "1.250", type: "interpolate" },
    ]
  }
})
```

### Pattern 3: Config Snapshot Re-Run
**What:** validation_runs already stores config_snapshot (full ProfileConfig JSONB). Re-run passes this config back to the validate API.
**When to use:** AUDT-05 re-run feature.
**Example:**
```typescript
// Read config from previous run
const previousRun = runs.find(r => r.id === selectedRunId)
const config = previousRun?.config_snapshot

// Re-run with same config
await fetch("/api/validate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ datasetId, config }),
})
```

### Pattern 4: Cross-Reference Audit Logs with Issues
**What:** To show "final value after cleaning" for a validation issue, query audit_logs for clean.auto/clean.ai_fix entries that match the same entity_id, then look in metadata.changes for matching row/column.
**When to use:** AUDT-03 issue traceability.

### Anti-Patterns to Avoid
- **Full dataset snapshots in audit_logs:** Storing entire parsed datasets as before/after would bloat the database. Use row-level diffs only.
- **Blocking on audit writes:** Never await audit logging in the critical path. Fire-and-forget pattern is already established.
- **New database tables for snapshots:** The existing metadata JSONB column is sufficient for row-level diffs. A separate transformation_snapshots table adds unnecessary complexity.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Audit log storage | Custom event store | Existing audit_logs table + JSONB metadata | Already built with RLS, indexes, and query functions |
| Timeline UI | New timeline component | Existing AuditTimeline with ACTION_CONFIG extensions | Already handles expand/collapse, icons, time formatting |
| Config reproducibility | Custom config versioning | Existing config_snapshot on validation_runs | Already stores full ProfileConfig per run |
| Issue context display | New detail component | Existing IssueRowDetail + cross-reference audit logs | Already shows expected/actual and surrounding rows |

## Common Pitfalls

### Pitfall 1: Missing Audit Calls in Existing Flows
**What goes wrong:** Some dataset lifecycle events are not logged, creating gaps in the timeline.
**Why it happens:** Audit logging was added incrementally. Parse completion, column mapping confirmation, and profile selection are not logged.
**How to avoid:** Systematically audit every action type mentioned in AUDT-01 and add logAudit/logAuditClient calls.
**Current gaps identified:**
- `dataset.parse` -- not logged when parse completes (in `/api/parse` route)
- `dataset.map` -- not logged when column mappings are confirmed (in `file-detail-view.tsx handleConfirmMappings`)
- `profile.select` -- not logged when validation profile is selected/changed
- `validation.complete` -- only logged in pipeline client-side flow, NOT in the project-based backend flow (FastAPI does not write audit logs)
- `report.generate` -- defined in AuditAction type but no log calls found

### Pitfall 2: Auto-Clean Loses Individual Change Details
**What goes wrong:** Current auto-clean audit log only stores summary counts (duplicatesRemoved: 2, spikesRemoved: 1) but not the actual row/column/before/after values.
**Why it happens:** The autoClean function returns a CleanResult with actions array, but only the summary is logged.
**How to avoid:** Include the actions array (row-level diffs) in the audit metadata. Cap at reasonable size (e.g., first 100 changes) to avoid JSONB bloat.

### Pitfall 3: Pipeline vs Project Flow Audit Gaps
**What goes wrong:** The pipeline flow (client-side) logs audit events via logAuditClient, but the project-based flow (backend FastAPI) only logs validation.run from the Next.js proxy. FastAPI itself never writes to audit_logs.
**Why it happens:** Two separate processing paths with audit logging added to one.
**How to avoid:** For Phase 17, focus on adding missing log calls in the Next.js layer (both flows pass through Next.js API routes). The backend validation completion could trigger a log via the Supabase Realtime listener in FileDetailView.

### Pitfall 4: JSONB Metadata Size
**What goes wrong:** Storing every row-level change for large datasets (10K+ rows) creates very large JSONB values.
**Why it happens:** Attempting to store complete before/after for every change.
**How to avoid:** Cap changes array at 50-100 entries. Store totalChanges count separately. For full audit, users can re-run the clean operation.

## Code Examples

### Current Audit Log Write (Server-Side)
```typescript
// Source: src/lib/actions/audit.ts
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId ?? null,
      metadata: entry.metadata ?? {},
    })
  } catch {
    // Never let audit logging break the primary flow
  }
}
```

### Current AuditTimeline ACTION_CONFIG (Extend This)
```typescript
// Source: src/components/files/audit-timeline.tsx
// Current configs: validation.run, validation.complete, clean.auto,
// clean.ai_fix, clean.ai_reject, export.download, dataset.upload,
// dataset.save_to_project, report.generate
//
// MISSING configs to add:
// "dataset.parse" - Parse Complete
// "dataset.map" - Column Mappings Confirmed
// "profile.select" - Validation Profile Selected
```

### Current Issue Detail (IssueRowDetail)
```typescript
// Source: src/components/files/issue-row-detail.tsx
// Already shows: expected vs actual values, surrounding rows context
// NEEDS: cross-reference with audit_logs to show "after cleaning" value
// Query: getAuditLogs("dataset", datasetId) -> filter clean.auto/clean.ai_fix
// -> match metadata.row === issue.row_number && metadata.column === issue.column_name
```

### Re-Run Config (Already Stored)
```typescript
// Source: src/lib/types/validation.ts
export interface ValidationRun {
  // ...
  config_snapshot: ProfileConfig | null  // Full config stored per run
  profile_id: string | null
}
// Re-run: pass config_snapshot directly to POST /api/validate body
```

### Current Auto-Clean Audit (Needs Enhancement)
```typescript
// Source: stage-clean.tsx line 91-106
// CURRENT: Only logs summary counts
logAuditClient({
  action: "clean.auto",
  entityType: "dataset",
  metadata: {
    duplicatesRemoved: result.summary.duplicatesRemoved,
    totalActions: result.summary.totalActions,
    // MISSING: individual changes array
  },
})

// ENHANCED: Include row-level diffs (capped)
logAuditClient({
  action: "clean.auto",
  entityType: "dataset",
  metadata: {
    ...result.summary,
    changes: result.actions.slice(0, 100).map(a => ({
      type: a.type,
      row: a.row,
      column: a.column,
      before: a.before,
      after: a.after,
      explanation: a.explanation,
    })),
    totalChanges: result.actions.length,
    changesTruncated: result.actions.length > 100,
  },
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No audit trail | Basic audit_logs table + timeline | Phase 8/16 | Foundation exists |
| Summary-only clean logs | Row-level change diffs | Phase 17 (this phase) | Enables before/after traceability |
| No config reproducibility | config_snapshot on validation_runs | Phase 6 | Re-run already possible, just needs UI |

## Gap Analysis: What Exists vs What's Needed

### Actions Currently Logged
| Action | Where Logged | Entity Type | Metadata |
|--------|-------------|-------------|----------|
| validation.run | /api/validate route | dataset | source, hasCustomConfig |
| validation.complete | stage-validate.tsx (pipeline only) | dataset | source, fileName, issue counts |
| clean.auto | stage-clean.tsx | dataset | summary counts only |
| clean.ai_fix | stage-clean.tsx | dataset | row, column, before, after, confidence, explanation |
| clean.ai_reject | stage-clean.tsx | dataset | row, column, suggestedValue, confidence |
| export.download | stage-export.tsx | dataset | fileName, format, fileSize, rowCount |
| dataset.save_to_project | stage-export.tsx | dataset | projectName, jobName, surveyType |

### Actions NOT Logged (Gaps to Fill)
| Action | Where to Add | Entity Type | Metadata to Include |
|--------|-------------|-------------|---------------------|
| dataset.upload | file upload success handler | dataset | fileName, fileSize, fileType |
| dataset.parse | /api/parse route (on success) | dataset | totalRows, columnCount, headerRow, warnings count |
| dataset.map | file-detail-view handleConfirmMappings | dataset | mappingCount, mappedTypes list |
| profile.select | file-detail-view handleProfileChange | dataset | profileId, profileName, isTemplate |
| validation.complete | FileDetailView Realtime handler (project flow) | dataset | issue counts from validation run |
| report.generate | report download handler | dataset | reportType, format |

### UI Enhancements Needed
| Component | Current State | Enhancement |
|-----------|---------------|-------------|
| AuditTimeline | 9 action configs, basic expand | Add 3-4 new action configs, date grouping headers |
| ActionSummary | Handles 7 action types | Add summaries for parse, map, profile events |
| MetadataDisplay | Generic grid + AI explanation | Add before/after diff display for clean.auto changes array |
| IssueRowDetail | Shows expected/actual + context rows | Add "After Cleaning" value by cross-referencing audit logs |
| RunSwitcher | Shows run list with re-run button | Add "Re-run with this config" that uses config_snapshot |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest + jsdom |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUDT-01 | All dataset actions are logged with correct action type and metadata | unit | `npx vitest run tests/audit/audit-logging.test.ts -x` | No - Wave 0 |
| AUDT-02 | AuditTimeline renders all event types with correct icons and labels | unit | `npx vitest run tests/audit/audit-timeline.test.tsx -x` | No - Wave 0 |
| AUDT-03 | IssueRowDetail shows before/after values from audit cross-reference | unit | `npx vitest run tests/audit/issue-traceability.test.tsx -x` | No - Wave 0 |
| AUDT-04 | Auto-clean stores row-level diffs in audit metadata | unit | `npx vitest run tests/audit/clean-snapshots.test.ts -x` | No - Wave 0 |
| AUDT-05 | Re-run validation passes config_snapshot to API | unit | `npx vitest run tests/audit/rerun-validation.test.tsx -x` | No - Wave 0 |
| AUDT-06 | ActionSummary renders rich metadata for all event types | unit | `npx vitest run tests/audit/action-summary.test.tsx -x` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/audit/ -x`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/audit/audit-logging.test.ts` -- covers AUDT-01 (action type definitions, metadata shape)
- [ ] `tests/audit/audit-timeline.test.tsx` -- covers AUDT-02 (ACTION_CONFIG completeness, rendering)
- [ ] `tests/audit/issue-traceability.test.tsx` -- covers AUDT-03 (before/after cross-reference)
- [ ] `tests/audit/clean-snapshots.test.ts` -- covers AUDT-04 (row-level diff storage)
- [ ] `tests/audit/rerun-validation.test.tsx` -- covers AUDT-05 (config_snapshot passthrough)
- [ ] `tests/audit/action-summary.test.tsx` -- covers AUDT-06 (rich metadata rendering)

## Open Questions

1. **How large can metadata JSONB get before performance degrades?**
   - What we know: Supabase/PostgreSQL handles JSONB efficiently for typical sizes. Rows with 50-100 change entries (~10KB) are fine.
   - What's unclear: Whether auto-clean on very large datasets (50MB files, 100K+ rows) could produce thousands of changes.
   - Recommendation: Cap changes array at 100 entries. Store totalChanges count. This is sufficient for audit/traceability.

2. **Should the backend FastAPI also write audit logs directly?**
   - What we know: Currently only Next.js writes to audit_logs. FastAPI has Supabase service role access but never writes audits.
   - What's unclear: Whether validation.complete should be logged from FastAPI (most accurate timing) or from the Next.js Realtime handler.
   - Recommendation: Keep audit writes in Next.js layer only. The Realtime handler in FileDetailView already detects validation completion -- add a logAudit call there. Simpler architecture, no backend changes needed.

## Sources

### Primary (HIGH confidence)
- `supabase/migrations/00008_audit_logs.sql` -- audit_logs table schema, RLS policies, indexes
- `src/lib/actions/audit.ts` -- server-side audit write functions, AuditAction type union
- `src/components/files/audit-timeline.tsx` -- AuditTimeline component, ACTION_CONFIG, ActionSummary, MetadataDisplay
- `src/lib/audit-client.ts` -- client-side fire-and-forget audit logging
- `src/app/api/audit/route.ts` -- audit API endpoint
- `src/app/api/audit/backfill/route.ts` -- entity_id backfill for pipeline sessions
- `src/lib/types/validation.ts` -- ValidationRun with config_snapshot field
- `supabase/migrations/00006_validation_tables.sql` -- validation_runs and validation_issues schema
- `supabase/migrations/00007_validation_profiles.sql` -- config_snapshot column on validation_runs
- `src/components/files/issue-row-detail.tsx` -- issue detail with expected/actual and surrounding rows
- `src/components/files/file-detail-view.tsx` -- file detail tabs including Audit Trail tab
- `src/app/(dashboard)/pipeline/components/stage-clean.tsx` -- auto-clean and AI fix with existing audit calls
- `src/app/(dashboard)/pipeline/components/stage-validate.tsx` -- validation with existing audit calls

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies, everything builds on existing infrastructure
- Architecture: HIGH - Extending existing patterns, no new architectural decisions needed
- Pitfalls: HIGH - Based on direct code analysis of gaps in current logging
- Gap analysis: HIGH - Systematic review of every log call site vs every dataset lifecycle event

**Research date:** 2026-04-07
**Valid until:** 2026-05-07 (stable -- no external dependencies involved)
