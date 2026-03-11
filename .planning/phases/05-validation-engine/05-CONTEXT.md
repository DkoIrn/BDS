# Phase 5: Validation Engine - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

The system can run core QC checks on mapped survey data and produce explainable flags for every detected issue. This phase delivers: range/tolerance checks, missing data and KP gap detection, duplicate/near-duplicate detection, statistical outlier detection (z-score, IQR), KP monotonicity validation, and plain-English explanations for every flag. Also includes standing up the FastAPI backend service and deploying it. Validation profiles/templates (Phase 6), async background processing (Phase 7), and results dashboard UI (Phase 8) are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Where Validation Runs
- Python/FastAPI backend — not Next.js API routes
- FastAPI reads data directly from Supabase (has its own Supabase client/credentials)
- Next.js calls FastAPI via direct HTTP calls (not Supabase as message bus)
- FastAPI deployed on Railway in this phase — validation works end-to-end
- Full deployment: click "Run QC" button → Next.js API route → FastAPI → results in Supabase

### Validation Results & Severity
- Per-cell granularity — each flag points to a specific cell (row + column)
- 3 severity levels: Critical, Warning, Info
  - Critical = data integrity broken (out of range, duplicates)
  - Warning = suspicious but not definitive (statistical outliers)
  - Info = advisory (missing optional fields)
- Dedicated `validation_issues` table in Supabase — one row per flagged cell
  - Columns: dataset_id, row_number, column_name, rule_type, severity, message, expected, actual
- Dedicated `validation_runs` table for summary records
  - Columns: dataset_id, run_at, total_issues, critical_count, warning_count, info_count, pass_rate, completeness_score, status
- Re-runs create new validation_runs records — history is preserved (supports PROJ-05)

### Triggering & Workflow
- Manual "Run QC" button on the file detail page after mapping is confirmed
- User stays on the file detail page during validation — progress indicator with status text ('Running range checks...', 'Detecting outliers...')
- Dataset status extended: mapped → validating → validated (or validation_error)
- Users can re-run validation; each run creates a new record with full history

### Explanation Format
- Technical but clear tone — like a senior engineer's QC notes
  - Example: 'KP 12.450: DOB value 3.8m exceeds maximum threshold of 3.0m (tolerance: ±0.1m)'
- Both human-readable message AND structured fields stored per issue
  - Structured fields: expected_value, actual_value, row_number, column_name, kp_value
  - Message field: pre-formatted plain-English explanation
- KP value as primary location reference, row number as secondary
  - Format: 'At KP 12.450 (row 45): ...'
  - Falls back to row number when KP column is not mapped
- Statistical outlier explanations include full statistical context
  - Example: 'DOB value 8.2m is a statistical outlier (z-score: 3.4, mean: 2.1m, std: 1.8m). Values beyond ±3σ are flagged.'

### Claude's Discretion
- FastAPI project structure and endpoint design
- Python validation library choices (pandas, numpy, scipy vs lighter alternatives)
- Database migration schema details for validation_issues and validation_runs tables
- Railway deployment configuration
- Exact rule implementations (z-score threshold, IQR multiplier, duplicate tolerance)
- Progress reporting granularity from FastAPI to frontend
- Error handling for validation failures
- How parsed data flows from Supabase Storage to FastAPI processing

</decisions>

<specifics>
## Specific Ideas

- Survey engineers think in KP values (chainage), not row numbers — location referencing must reflect this
- Explanations should feel like a senior engineer wrote them, not a generic tool
- Statistical context in outlier flags lets engineers judge whether a flag is meaningful or noise
- Per-cell granularity matches how engineers review QC — they drill into specific values, not rows
- Validation history supports comparing results across re-runs after threshold adjustments (Phase 6)
- Progress indicator during validation provides immediate feedback rather than fire-and-forget pattern

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- Column detector (src/lib/parsing/column-detector.ts) — has SurveyColumnType enum and EXPECTED_COLUMNS map, useful for knowing what columns to validate
- Parsing types (src/lib/parsing/types.ts) — ColumnMapping, DetectedColumn types define the mapping structure validation will read
- Dataset type (src/lib/types/files.ts) — DatasetStatus type needs extension with 'validating' and 'validated'
- File detail page — will need "Run QC" button added and validation results display area

### Established Patterns
- Server Components for data fetching, Client Components for interactivity
- Supabase server client with getUser() for auth checks
- API routes at src/app/api/ for backend calls (existing: src/app/api/parse/)
- Sonner toast for feedback, Badge component for status indicators
- Dataset status progression: uploaded → parsing → parsed → mapped

### Integration Points
- File detail page (needs "Run QC" button and progress indicator)
- DatasetStatus type needs 'validating' | 'validated' | 'validation_error' added
- New API route needed: src/app/api/validate/ to proxy to FastAPI
- New Supabase tables: validation_runs, validation_issues
- FastAPI service needs Supabase credentials to read storage and write results
- Column mappings (JSONB on dataset) tell FastAPI which columns to validate and how

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-validation-engine*
*Context gathered: 2026-03-11*
