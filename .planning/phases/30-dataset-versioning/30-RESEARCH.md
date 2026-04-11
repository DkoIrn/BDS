# Phase 30: Dataset Versioning - Research

**Researched:** 2026-04-11
**Domain:** Supabase Storage snapshots, pandas diff computation, Next.js tab UI
**Confidence:** HIGH

## Summary

Dataset versioning requires three distinct technical areas: (1) snapshot creation triggered from the existing procrastinate task completion handler, (2) a diff computation endpoint on FastAPI using pandas DataFrame comparison, and (3) a new Versions tab in the dataset detail UI with timeline, comparison selection, and paginated diff display.

The existing codebase provides strong foundations. The `tasks.py` completion handler (line 264) already dispatches webhooks post-validation -- snapshot creation slots in at the same point. The `compare.py` router and `compare_datasets()` transform demonstrate the exact pattern for row-level diff computation. The tab system in `file-detail-view.tsx` uses shadcn Tabs and is straightforward to extend.

**Primary recommendation:** Insert snapshot creation directly into the `validate_dataset` task (between step 8 and step 9), not as a separate webhook consumer. This keeps it atomic with the validation flow and avoids a second async hop.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Full file copy stored in Supabase Storage per version (not metadata-only, not row-level DB storage)
- Storage path: `datasets/{user_id}/{dataset_id}/versions/v{N}_{timestamp}.csv`
- Snapshot triggered automatically on validation completion via procrastinate webhook (Phase 29 completion events)
- First version created on first validation, not on upload -- version count = validation count
- Raw file at validation time is copied (not the processed/normalized DataFrame)
- Version metadata stored in `dataset_versions` table: dataset_id, version_number, storage_path, row_count, column_count, file_size, validation_run_id, issue_count, created_at
- New "Versions" tab on the dataset detail page (between Preview and Audit tabs)
- Vertical timeline layout, newest version at top
- Each version card shows: version number, timestamp, row count, column count, file size, issue count (with severity breakdown), validation profile used
- Trend summary header at top of tab: total versions, issue trend (e.g. "24 -> 12, down 50%"), row count change
- Checkbox selection for comparison -- user checks exactly 2 versions, sticky footer bar appears with "Compare v1 <-> v3" button (disabled until 2 selected)
- Summary-first with drill-down -- not side-by-side tables
- Summary card shows: rows before/after, added/removed/modified counts, issues before/after
- Expandable sections for each change category (Added rows, Removed rows, Modified rows)
- Modified rows use inline before/after format: `column: old_value -> new_value` (only changed columns shown per row)
- Diff computation happens on FastAPI backend -- downloads both version files from storage, parses with pandas, computes row-level diff, returns structured JSON
- Diff response is paginated: summary always returns in full, row-level details paginated at 50 rows per page with load-more
- Hard constant of 10 versions per dataset (all tiers, not configurable)
- Silent auto-prune -- oldest version deleted when 11th is created, no user notification
- Pruning is synchronous -- happens in same transaction as version creation (atomic, count never exceeds 10)
- Storage file deletion happens async after DB transaction commits
- Only version file and dataset_versions row are deleted -- linked validation_runs, validation_issues, and job_runs records are preserved
- Users cannot pin or protect versions from pruning

### Claude's Discretion
- Exact version number formatting (v1, v2... or #1, #2...)
- Timeline card visual design (spacing, colors, icons)
- Diff loading states and empty states
- Error handling for corrupted/missing version files
- How to handle the diff when columns were added/removed between versions

### Deferred Ideas (OUT OF SCOPE)
- Cell-level diff highlighting (DVER-06) -- deferred to v1.2
- Pin/protect versions from pruning -- not needed at current scale
- Tier-based version limits -- keep simple with hard constant for now
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DVER-01 | Each validation run creates an immutable snapshot of the dataset state | Snapshot creation in task.py after validation completes; raw file copy to versioned storage path; dataset_versions table insert |
| DVER-02 | User can view version history for a dataset showing all snapshots with timestamps | Versions tab in file-detail-view.tsx; query dataset_versions ordered by version_number DESC; vertical timeline layout |
| DVER-03 | User can compare any two versions and see row-level changes with summary stats | FastAPI diff endpoint downloads both version files, pandas merge/compare, paginated JSON response; comparison UI with checkbox selection |
| DVER-04 | Version history shows linked validation results (issue count per version) | dataset_versions.issue_count + severity breakdown stored at snapshot time; validation_run_id FK for drill-through |
| DVER-05 | Storage retention limits snapshots to 10 versions per dataset (oldest auto-pruned) | MAX_VERSIONS=10 constant; prune oldest before insert in same DB transaction; async storage cleanup after commit |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Supabase Storage | (project standard) | Store version CSV files | Already used for dataset file storage; `supabase.storage.from_("datasets")` pattern established |
| Supabase JS Client | ^2.99.0 | Frontend queries for version list | Already in use across the app |
| pandas | (project standard) | Diff computation between versions | Already used in validation pipeline and compare transform |
| FastAPI | (project standard) | Diff endpoint | Already used for all backend processing endpoints |
| shadcn/ui Tabs | (project standard) | Versions tab in dataset detail | Already used in file-detail-view.tsx |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | (project standard) | Icons for timeline, diff indicators | Timeline cards, change type icons |
| sonner | (project standard) | Toast notifications for errors | Diff computation failures, version load errors |
| Supabase Realtime | (project standard) | Live version list updates | New version appears after validation completes |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Full file copy | Delta/patch storage | Delta saves storage but adds complexity; full copy is simpler and storage is cheap at 10-version cap |
| pandas merge for diff | Row-by-row Python loop | pandas merge is faster and handles edge cases (reordered rows, missing columns); established in compare.py |
| Inline diff format | Side-by-side table | Side-by-side is harder to read on mobile; inline `old -> new` is the locked decision |

## Architecture Patterns

### Recommended Project Structure
```
backend/
  app/
    services/
      versioning.py       # Snapshot creation + pruning logic
    routers/
      versions.py         # GET /datasets/{id}/versions, POST /datasets/{id}/diff
src/
  components/
    files/
      version-timeline.tsx    # Versions tab content (timeline + trend header)
      version-diff-view.tsx   # Comparison results display
  lib/
    types/
      versions.ts             # DatasetVersion, VersionDiff types
    actions/
      versions.ts             # Server actions or fetch helpers
  app/
    api/
      versions/
        route.ts              # Proxy to FastAPI for version list
      version-diff/
        route.ts              # Proxy to FastAPI for diff computation
supabase/
  migrations/
    20260411_dataset_versions.sql  # New table + RLS + indexes
```

### Pattern 1: Snapshot Creation in Task Completion
**What:** After validation completes (step 8 in tasks.py), copy the raw file to a versioned storage path and insert a `dataset_versions` row.
**When to use:** Every successful validation run.
**Example:**
```python
# Insert between step 8 (update dataset status) and step 9 (record job run) in tasks.py
# Source: Follows existing pattern from tasks.py lines 144, 210-238

from app.services.versioning import create_version_snapshot

# After validation completes successfully:
create_version_snapshot(
    supabase=supabase,
    dataset_id=dataset_id,
    user_id=dataset["user_id"],
    validation_run_id=run_id,
    issue_count=total_issues,
    critical_count=critical_count,
    warning_count=warning_count,
    info_count=info_count,
    row_count=len(df),
    column_count=len(df.columns),
    file_size=len(file_bytes),
    storage_path=dataset["storage_path"],
)
```

### Pattern 2: Atomic Prune-Then-Insert
**What:** Before inserting a new version, count existing versions. If >= 10, delete the oldest row in the same DB call sequence. Storage file deletion is deferred.
**When to use:** Every version creation.
**Example:**
```python
def create_version_snapshot(supabase, dataset_id, user_id, ...):
    # 1. Count existing versions
    existing = (supabase.table("dataset_versions")
        .select("id, version_number, storage_path")
        .eq("dataset_id", dataset_id)
        .order("version_number", desc=False)
        .execute())
    
    versions = existing.data or []
    paths_to_delete = []
    
    # 2. Prune if at limit
    MAX_VERSIONS = 10
    while len(versions) >= MAX_VERSIONS:
        oldest = versions.pop(0)
        supabase.table("dataset_versions").delete().eq("id", oldest["id"]).execute()
        paths_to_delete.append(oldest["storage_path"])
    
    # 3. Determine next version number
    next_version = (versions[-1]["version_number"] + 1) if versions else 1
    
    # 4. Copy file to versioned path
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    version_path = f"{user_id}/{dataset_id}/versions/v{next_version}_{timestamp}.csv"
    
    file_bytes = supabase.storage.from_("datasets").download(storage_path)
    supabase.storage.from_("datasets").upload(version_path, file_bytes)
    
    # 5. Insert version record
    supabase.table("dataset_versions").insert({
        "dataset_id": dataset_id,
        "version_number": next_version,
        "storage_path": version_path,
        "row_count": row_count,
        "column_count": column_count,
        "file_size": file_size,
        "validation_run_id": validation_run_id,
        "issue_count": issue_count,
        "severity_breakdown": {"critical": critical_count, "warning": warning_count, "info": info_count},
    }).execute()
    
    # 6. Async cleanup of pruned storage files (non-blocking)
    for path in paths_to_delete:
        try:
            supabase.storage.from_("datasets").remove([path])
        except Exception as e:
            logger.warning("Failed to delete pruned version file %s: %s", path, e)
```

### Pattern 3: Pandas DataFrame Diff
**What:** Download both version files, parse as DataFrames, compute row-level diff using index-based comparison.
**When to use:** When user requests comparison of two versions.
**Example:**
```python
# Source: Extends pattern from backend/app/transforms/compare.py

def compute_version_diff(df_old, df_new):
    """Compute row-level diff between two version DataFrames.
    
    Uses index-based comparison (row position), not key-column matching,
    since the same dataset may not have a unique key column.
    """
    # Align columns
    all_cols = list(dict.fromkeys(list(df_old.columns) + list(df_new.columns)))
    
    max_rows = max(len(df_old), len(df_new))
    added_rows = []
    removed_rows = []
    modified_rows = []
    
    for i in range(max_rows):
        if i >= len(df_old):
            added_rows.append({"row": i + 1, "values": df_new.iloc[i].to_dict()})
        elif i >= len(df_new):
            removed_rows.append({"row": i + 1, "values": df_old.iloc[i].to_dict()})
        else:
            changes = {}
            for col in all_cols:
                old_val = str(df_old.iloc[i].get(col, "")) if col in df_old.columns else ""
                new_val = str(df_new.iloc[i].get(col, "")) if col in df_new.columns else ""
                if old_val != new_val:
                    changes[col] = {"old": old_val, "new": new_val}
            if changes:
                modified_rows.append({"row": i + 1, "changes": changes})
    
    return {
        "summary": {
            "rows_before": len(df_old),
            "rows_after": len(df_new),
            "added_count": len(added_rows),
            "removed_count": len(removed_rows),
            "modified_count": len(modified_rows),
            "columns_before": len(df_old.columns),
            "columns_after": len(df_new.columns),
        },
        "added": added_rows,
        "removed": removed_rows,
        "modified": modified_rows,
    }
```

### Pattern 4: Next.js API Route Proxy (established pattern)
**What:** Thin proxy route that authenticates via Supabase, then forwards to FastAPI.
**When to use:** All FastAPI endpoint access from the frontend.
**Example:**
```typescript
// Source: Follows pattern from src/app/api/compare/route.ts
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json()
  const response = await fetch(`${process.env.FASTAPI_URL}/api/v1/datasets/${body.datasetId}/diff`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  // ... forward response
}
```

### Anti-Patterns to Avoid
- **Storing diff results in DB:** Diffs should be computed on-demand, not pre-computed. Storage cost and staleness issues outweigh the latency savings.
- **Using dataset file_bytes from memory for snapshot:** Always re-download from storage to create the version copy. The in-memory bytes may have been modified during parsing.
- **Monotonically increasing version numbers with gaps:** If versions 1-3 exist and 1 is pruned, keep 2 and 3 (don't renumber). The next version is always max(existing) + 1.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DataFrame row comparison | Custom row-by-row dict comparison | pandas DataFrame alignment + vectorized comparison | Handles NaN, type coercion, missing columns correctly |
| File copy in storage | Manual byte download + re-upload | `supabase.storage.from_().download()` then `.upload()` | Already the established pattern; handles auth, retries |
| Paginated API response | Custom offset/limit with cursor | Simple offset/limit with total count | 10 versions max means small result sets; no cursor needed |
| Realtime version updates | Polling | Supabase Realtime subscription on `dataset_versions` table | Already established pattern with `job_runs` table |

**Key insight:** The existing compare.py transform provides 80% of the diff logic needed. The version diff is simpler because both files are from the same dataset (same schema, no key-column matching needed -- use row index).

## Common Pitfalls

### Pitfall 1: Race Condition on Concurrent Validations
**What goes wrong:** Two validation runs for the same dataset complete simultaneously, both try to create version 11, neither prunes correctly.
**Why it happens:** Supabase client doesn't support DB-level transactions; count-then-insert is not atomic.
**How to avoid:** Use a unique constraint on `(dataset_id, version_number)` to prevent duplicate versions. The second insert will fail and can retry with the correct version number. In practice, procrastinate serializes jobs per queue, so concurrent validations for the same dataset are unlikely but should be guarded.
**Warning signs:** Duplicate version numbers in the dataset_versions table.

### Pitfall 2: Storage Path Collision
**What goes wrong:** Two versions created in the same second get the same storage path.
**Why it happens:** Timestamp-based paths with only second precision.
**How to avoid:** Include the version number in the path (already in the locked decision: `v{N}_{timestamp}.csv`). Version number + timestamp together are unique.
**Warning signs:** Upload failures with "already exists" errors.

### Pitfall 3: Orphaned Storage Files After Failed Prune
**What goes wrong:** DB row is deleted but storage file deletion fails. Files accumulate.
**Why it happens:** Storage deletion is async and can fail silently.
**How to avoid:** Log warnings on storage deletion failure. Consider a periodic cleanup job later, but for v1.1 just log. The 10-version cap means at most 10 orphaned files per dataset.
**Warning signs:** Storage usage growing beyond expected (10 files per dataset).

### Pitfall 4: Large File Diff Memory Pressure
**What goes wrong:** Diff computation loads two full DataFrames into memory. For 50MB files, this means ~100MB+ RAM.
**Why it happens:** pandas reads entire files into memory.
**How to avoid:** The 50MB file size limit (from MAX_FILE_SIZE in types/files.ts) bounds this naturally. For the diff endpoint, set a response timeout (60s) matching the existing `maxDuration = 60` in compare/route.ts.
**Warning signs:** FastAPI worker OOM kills during diff computation.

### Pitfall 5: Version Number After Pruning
**What goes wrong:** After pruning version 1, new version gets number 1 again (if using count-based numbering).
**Why it happens:** Using `len(versions) + 1` instead of `max(version_number) + 1`.
**How to avoid:** Always use `max(existing version_numbers) + 1` for the next version number. Version numbers should be monotonically increasing and never reused.
**Warning signs:** Non-unique version numbers, confusing version history.

### Pitfall 6: Missing Realtime Publication
**What goes wrong:** New versions don't appear in the UI until page refresh.
**Why it happens:** Forgot to add `dataset_versions` to Supabase Realtime publication.
**How to avoid:** Include `ALTER PUBLICATION supabase_realtime ADD TABLE dataset_versions;` in the migration, following the pattern from `20260411_job_tracking.sql` line 36.
**Warning signs:** Versions only appear after manual page refresh.

## Code Examples

### Migration: dataset_versions table
```sql
-- Source: Follows pattern from 20260411_job_tracking.sql

CREATE TABLE public.dataset_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID REFERENCES datasets(id) ON DELETE CASCADE NOT NULL,
  version_number INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  row_count INTEGER NOT NULL,
  column_count INTEGER NOT NULL,
  file_size BIGINT NOT NULL,
  validation_run_id UUID REFERENCES validation_runs(id) ON DELETE SET NULL,
  issue_count INTEGER NOT NULL DEFAULT 0,
  severity_breakdown JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(dataset_id, version_number)
);

-- Fast lookup: versions for a dataset, newest first
CREATE INDEX idx_dataset_versions_dataset ON dataset_versions(dataset_id, version_number DESC);

-- Enable Realtime for live UI updates
ALTER PUBLICATION supabase_realtime ADD TABLE dataset_versions;

-- RLS
ALTER TABLE public.dataset_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view versions for their org datasets"
  ON public.dataset_versions FOR SELECT
  USING (
    dataset_id IN (
      SELECT d.id FROM datasets d
      JOIN jobs j ON j.id = d.job_id
      JOIN projects p ON p.id = j.project_id
      JOIN org_members om ON om.org_id = p.org_id
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role has full access to dataset_versions"
  ON public.dataset_versions FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
```

### Versions Tab Integration Point
```typescript
// Source: Extends file-detail-view.tsx tab system (lines 530-708)
// Add between "preview" and "audit" TabsTrigger/TabsContent

<TabsTrigger value="versions">Versions</TabsTrigger>

<TabsContent value="versions">
  <VersionTimeline datasetId={dataset.id} />
</TabsContent>
```

### Diff Endpoint Router
```python
# Source: Follows pattern from backend/app/routers/compare.py

router = APIRouter(prefix="/api/v1/datasets", tags=["versions"])

@router.get("/{dataset_id}/versions")
def list_versions(dataset_id: str):
    """List all versions for a dataset, newest first."""
    supabase = get_supabase_client()
    result = (supabase.table("dataset_versions")
        .select("*")
        .eq("dataset_id", dataset_id)
        .order("version_number", desc=True)
        .execute())
    return {"versions": result.data or []}

@router.post("/{dataset_id}/diff")
def compute_diff(dataset_id: str, body: DiffRequest):
    """Compare two versions of a dataset."""
    # Download both version files from storage
    # Parse with pandas
    # Compute diff
    # Return paginated results
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Metadata-only versioning | Full file snapshots | Current design | Enables true diff computation, not just "something changed" |
| Side-by-side table diff | Summary-first with drill-down | Current design | Better UX for large datasets, less overwhelming |
| Manual version management | Auto-snapshot on validation | Current design | Zero friction, version count = validation count |

## Open Questions

1. **Row matching strategy for diff**
   - What we know: User decided on row-level diff, not cell-level. The existing compare.py uses key-column matching.
   - What's unclear: Should version diff use row-index matching (position-based) or attempt to find a key column? Position-based is simpler but won't detect row reordering.
   - Recommendation: Use position-based (row index) matching. The same dataset between validations typically has the same row order. Key-column matching adds complexity and requires the user to specify keys. This is Claude's discretion territory -- use position-based and note it in the UI.

2. **Handling column schema changes between versions**
   - What we know: Users may re-upload with different columns between validation runs.
   - What's unclear: How to present columns that exist in one version but not the other.
   - Recommendation: Show added/removed columns in the summary. For modified rows, only show columns present in both versions. Added columns show as `column: (new) value`. Removed columns show as `column: value (removed)`. This is explicitly in Claude's discretion.

3. **Version number formatting**
   - Recommendation: Use `v1`, `v2`, etc. (lowercase "v" prefix). Matches common git/software versioning conventions. Short, clean, recognizable.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (backend), Vitest would be ideal for frontend but no config exists |
| Config file | `backend/pyproject.toml` [tool.pytest.ini_options] |
| Quick run command | `cd backend && python -m pytest tests/test_versioning.py -x` |
| Full suite command | `cd backend && python -m pytest tests/ -x` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DVER-01 | Snapshot created after validation | unit | `cd backend && python -m pytest tests/test_versioning.py::test_create_snapshot -x` | No -- Wave 0 |
| DVER-02 | Version list returned for dataset | unit | `cd backend && python -m pytest tests/test_versioning.py::test_list_versions -x` | No -- Wave 0 |
| DVER-03 | Diff computed between two versions | unit | `cd backend && python -m pytest tests/test_versioning.py::test_compute_diff -x` | No -- Wave 0 |
| DVER-04 | Issue count stored per version | unit | `cd backend && python -m pytest tests/test_versioning.py::test_version_issue_count -x` | No -- Wave 0 |
| DVER-05 | Oldest version pruned at limit | unit | `cd backend && python -m pytest tests/test_versioning.py::test_auto_prune -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && python -m pytest tests/test_versioning.py -x`
- **Per wave merge:** `cd backend && python -m pytest tests/ -x`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/test_versioning.py` -- covers DVER-01 through DVER-05
- [ ] `backend/tests/fixtures/version_test_data/` -- sample CSV files for diff testing
- [ ] Test mocking for Supabase storage upload/download (follow pattern from existing conftest.py)

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `backend/app/queue/tasks.py` -- task completion flow, snapshot insertion point
- Codebase inspection: `backend/app/transforms/compare.py` -- existing diff computation pattern
- Codebase inspection: `backend/app/routers/compare.py` -- existing diff endpoint pattern
- Codebase inspection: `src/components/files/file-detail-view.tsx` -- tab system structure
- Codebase inspection: `supabase/migrations/20260411_job_tracking.sql` -- migration pattern with RLS + Realtime
- Codebase inspection: `src/components/realtime-provider.tsx` -- Realtime subscription pattern
- Codebase inspection: `src/components/jobs/job-history-table.tsx` -- list + Realtime pattern

### Secondary (MEDIUM confidence)
- pandas DataFrame comparison patterns -- well-established, verified against existing compare.py usage

### Tertiary (LOW confidence)
- None -- all findings verified against existing codebase patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use in the project
- Architecture: HIGH -- patterns directly mirror existing codebase (compare.py, job_tracking migration, tasks.py)
- Pitfalls: HIGH -- identified from codebase analysis (race conditions, storage cleanup, memory)

**Research date:** 2026-04-11
**Valid until:** 2026-05-11 (stable -- internal architecture, no external API dependencies)
