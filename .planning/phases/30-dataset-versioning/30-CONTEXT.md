# Phase 30: Dataset Versioning - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Every validation run creates a traceable snapshot so users can see how their data changed over time. Users can view version history, compare any two versions with row-level detail, and see linked issue counts per version. Storage is capped at 10 versions per dataset with automatic pruning. This phase does NOT include cell-level diff highlighting (deferred to DVER-06/v1.2).

</domain>

<decisions>
## Implementation Decisions

### Snapshot Strategy
- Full file copy stored in Supabase Storage per version (not metadata-only, not row-level DB storage)
- Storage path: `datasets/{user_id}/{dataset_id}/versions/v{N}_{timestamp}.csv`
- Snapshot triggered automatically on validation completion via procrastinate webhook (Phase 29 completion events)
- First version created on first validation, not on upload — version count = validation count
- Raw file at validation time is copied (not the processed/normalized DataFrame)
- Version metadata stored in `dataset_versions` table: dataset_id, version_number, storage_path, row_count, column_count, file_size, validation_run_id, issue_count, created_at

### Version History UI
- New "Versions" tab on the dataset detail page (between Preview and Audit tabs)
- Vertical timeline layout, newest version at top
- Each version card shows: version number, timestamp, row count, column count, file size, issue count (with severity breakdown), validation profile used
- Trend summary header at top of tab: total versions, issue trend (e.g. "24 -> 12, down 50%"), row count change
- Checkbox selection for comparison — user checks exactly 2 versions, sticky footer bar appears with "Compare v1 <-> v3" button (disabled until 2 selected)

### Version Diff Experience
- Summary-first with drill-down — not side-by-side tables
- Summary card shows: rows before/after, added/removed/modified counts, issues before/after
- Expandable sections for each change category (Added rows, Removed rows, Modified rows)
- Modified rows use inline before/after format: `column: old_value -> new_value` (only changed columns shown per row)
- Diff computation happens on FastAPI backend — downloads both version files from storage, parses with pandas, computes row-level diff, returns structured JSON
- Diff response is paginated: summary always returns in full, row-level details paginated at 50 rows per page with load-more

### Auto-Pruning
- Hard constant of 10 versions per dataset (all tiers, not configurable)
- Silent auto-prune — oldest version deleted when 11th is created, no user notification
- Pruning is synchronous — happens in same transaction as version creation (atomic, count never exceeds 10)
- Storage file deletion happens async after DB transaction commits
- Only version file and dataset_versions row are deleted — linked validation_runs, validation_issues, and job_runs records are preserved
- Users cannot pin or protect versions from pruning

### Claude's Discretion
- Exact version number formatting (v1, v2... or #1, #2...)
- Timeline card visual design (spacing, colors, icons)
- Diff loading states and empty states
- Error handling for corrupted/missing version files
- How to handle the diff when columns were added/removed between versions

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/queue/tasks.py`: Validation task dispatches webhooks on completion (line 265) — hook snapshot creation here
- `src/components/files/file-detail-view.tsx`: Dataset detail page with tab system (mapping/results/preview/audit) — add Versions tab
- `src/components/jobs/job-history-table.tsx`: Job history with Realtime subscriptions — reference pattern for version list
- `src/components/realtime-provider.tsx`: Global Supabase Realtime subscription — extend for version updates
- `backend/app/services/validation.py`: Core validation logic with pandas — reuse pandas for diff computation

### Established Patterns
- Supabase Realtime for live UI updates (job status, dataset status)
- Procrastinate job queue with webhook dispatch on completion
- Tab-based layout on dataset detail page
- Storage path structure: `{user_id}/{filename}` in datasets bucket
- FastAPI POST endpoints with structured JSON responses

### Integration Points
- `backend/app/queue/tasks.py` completion handler — trigger snapshot creation after validation completes
- `src/components/files/file-detail-view.tsx` tab array — add Versions tab
- `supabase/migrations/` — new `dataset_versions` table
- `backend/app/routers/` — new diff endpoint (POST /datasets/{id}/diff)
- `src/app/api/` — Next.js API route proxy for diff requests

</code_context>

<specifics>
## Specific Ideas

- Version count equals validation count — clean mental model for users
- Trend summary at top gives instant "is the data getting cleaner?" signal
- Diff should feel like reviewing changes, not overwhelming with raw data — summary first, details on demand
- Pruning should be invisible — engineers care about recent versions, not historical ones

</specifics>

<deferred>
## Deferred Ideas

- Cell-level diff highlighting (DVER-06) — deferred to v1.2
- Pin/protect versions from pruning — not needed at current scale
- Tier-based version limits — keep simple with hard constant for now

</deferred>

---

*Phase: 30-dataset-versioning*
*Context gathered: 2026-04-11*
