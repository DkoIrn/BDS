---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: completed
stopped_at: Completed 21-02-PLAN.md
last_updated: "2026-04-10T16:38:33.055Z"
last_activity: 2026-04-10 -- Plan 21-02 complete (usage display + limit feedback UI)
progress:
  total_phases: 21
  completed_phases: 21
  total_plans: 48
  completed_plans: 48
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-10)

**Core value:** Engineers can upload survey data and receive automated QC reports with every flagged issue explained -- replacing hours of manual checking with minutes of automated validation.
**Current focus:** Phase 21 - Usage Tracking & Tier Enforcement

## Current Position

Phase: 21 of 21 (21-usage-tracking-tier-enforcement)
Plan: 2 of 2
Status: Complete
Last activity: 2026-04-10 -- Plan 21-02 complete (usage display + limit feedback UI)

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**
- Total plans completed: 14
- Average duration: 6min
- Total execution time: 1.33 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation-auth | 3/3 | 23min | 7.7min |
| 02-project-structure | 2/2 | 8min | 4min |
| 03-file-upload-storage | 2/2 | 11min | 5.5min |
| 04-ingestion-pipeline | 3/3 | 11min | 3.7min |
| 05-validation-engine | 2/3 | 16min | 8min |
| 06-validation-profiles | 2/4 | 4min | 2min |
| 07-async-processing | 2/2 | 5min | 2.5min |

**Recent Trend:**
- Last 5 plans: 05-02 (2min), 05-01 (14min), 06-02 (2min), 07-01 (2min), 07-02 (3min)
- Trend: Variable ~2-14min/plan

*Updated after each plan completion*
| Phase 10 P01 | 3min | 2 tasks | 8 files |
| Phase 10 P02 | 8min | 2 tasks | 8 files |
| Phase 01 P03 | 5min | 3 tasks | 3 files |
| Phase 11 P01 | 4min | 3 tasks | 11 files |
| Phase 12 P01 | 5min | 2 tasks | 14 files |
| Phase 12 P02 | 5min | 2 tasks | 3 files |
| Phase 13 P01 | 6min | 4 tasks | 18 files |
| Phase 13 P02 | 8min | 2 tasks | 8 files |
| Phase 14 P01 | 5min | 2 tasks | 13 files |
| Phase 14 P02 | 4min | 2 tasks | 8 files |
| Phase 16 P00 | 1min | 1 tasks | 4 files |
| Phase 16 P01 | 10min | 2 tasks | 12 files |
| Phase 16 P02 | 12min | 3 tasks | 7 files |
| Phase 17 P01 | 3min | 2 tasks | 10 files |
| Phase 17 P02 | 3min | 3 tasks | 4 files |
| Phase 18 P01 | 3min | 2 tasks | 5 files |
| Phase 18 P02 | 2min | 2 tasks | 1 files |
| Phase 19 P01 | 5min | 2 tasks | 6 files |
| Phase 19 P02 | 4min | 3 tasks | 3 files |
| Phase 20 P01 | 5min | 2 tasks | 9 files |
| Phase 20 P02 | 6min | 2 tasks | 5 files |
| Phase 21 P01 | 7min | 2 tasks | 6 files |
| Phase 21 P02 | 5min | 3 tasks | 7 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: 10 phases derived from 36 v1 requirements at fine granularity
- Architecture: Two-service split (Next.js on Vercel + FastAPI on Railway) with Supabase as communication bus
- Auth: Use getUser() not getSession() for server-side checks (security pitfall from research)
- Stack: Accepted Next.js 16.1.6 from create-next-app@latest instead of pinning to 15.x
- Theme: Hex color values in CSS vars (not oklch) for brand color clarity
- Forms: useActionState (React 19) for server action integration with loading/error states
- Components: shadcn/ui v4 Button does not support asChild -- use styled Link elements instead
- DialogTrigger: base-ui render prop requires ReactElement, not ReactNode -- pass element directly
- Tables: Client-side sorting for small datasets (<100 rows) with useState for column/direction
- Supabase: Relational queries via select('*, jobs(count)') for aggregated counts
- Select: base-ui Select onValueChange returns string|null -- use hidden input for form submission
- Detail pages: Server component with params Promise, auth check, ownership filter, notFound() for missing
- Storage: User UUID as folder prefix for RLS scoping on storage.objects
- File actions: createFileRecord is plain async (not form action), called after client upload succeeds
- Download URLs: Signed URLs with 5-minute (300s) expiry
- Upload UI: react-dropzone for drag-and-drop, sequential upload with AbortController cancel
- DropdownMenuTrigger: base-ui uses render prop pattern (not asChild) for custom trigger elements
- Parsing: PapaParse with header:false for raw string[][] output, SheetJS raw:false with defval:'' for consistent strings
- Column detection: Confidence scoring (high=name+data, medium=name only, low=data only) with 14 survey column types
- Auto-parse: Fire-and-forget after upload, does not block upload queue
- Parse API: Always updates status to 'error' on failure to prevent stuck 'parsing' state
- Column mappings: JSONB storage for flexible schema evolution
- FileDetailView: Client orchestrator pattern -- server page fetches, client component manages interactive state
- Column reorder in preview: mapped first, unmapped second, ignored last
- Confidence badges: green (high), yellow (medium), gray (low) using Badge component
- FastAPI proxy: API route handles auth/ownership, delegates to FastAPI, returns 202 Accepted (fire-and-forget)
- Async validation: Next.js sets 'validating' status (not FastAPI) to avoid race conditions
- Background error safety: broad try/except ensures datasets never stuck in 'validating' state
- Severity sorting: client-side sort in server action since Supabase order() lacks custom ordinals
- Validators: Pure functions over classes -- simpler to test and compose, no state
- KP gaps: Dynamic threshold (median*3) adapts to each dataset's KP density
- Range defaults: Generous thresholds (DOB/DOC: 0-10m, depth: 0-500m) to avoid false positives
- FastAPI endpoints: Sync def (not async def) for supabase-py compatibility
- Validation templates: Typed constants with `as const satisfies` for compile-time safety
- Profile config: JSONB cast via unknown for Supabase insert compatibility (same pattern as column_mappings)
- EnabledChecks: Separate interface for reuse in reset/default functionality
- Realtime toasts: RealtimeProvider handles global toast notifications; FileDetailView handles local state only -- no duplicate toasts
- FileList Realtime: Local state synced with Realtime subscription for live status updates without page refresh
- [Phase 10]: Server components for landing sections (no use client needed for presentational content)
- [Phase 10]: GBP as base currency for pricing tiers (Starter £39, Professional £119)
- [Phase 10]: Extracted pricing tiers to shared module (src/lib/pricing-tiers.ts) for reuse in subscription flows
- [Phase 11]: ParseResult dataclass as shared contract -- string[][] rows for column detection pipeline compatibility
- [Phase 11]: KML parser uses lxml with namespace-aware XPath (not fastkml) for reliable parsing
- [Phase 11]: flatten_geometry helper shared across parsers for consistent coordinate normalization
- [Phase 12]: Shared _coords.py helper for coordinate column detection across writers
- [Phase 12]: Writer functions return (bytes, warnings) tuple for consistent partial conversion handling
- [Phase 12]: CSV/Excel parsers use stdlib csv.reader and openpyxl (not pandas) for lightweight parsing
- [Phase 12]: Inline react-dropzone for converter (not FileUploadZone) to avoid dataset-specific dependencies
- [Phase 12]: Raw body forwarding preserves multipart boundaries in auth proxy
- [Phase 12]: Blob URL download via hidden anchor element for cross-browser file download
- [Phase 13]: Public route group (public) with passthrough layout for unauthenticated tool pages
- [Phase 13]: circleMarker instead of icon markers to avoid Leaflet broken icon path issue
- [Phase 13]: Inline react-dropzone in upload panel (same pattern as converter)
- [Phase 13]: sessionStorage for layer persistence (no server storage, no database)
- [Phase 13]: ESRI World Imagery for satellite tiles (free, no API key)
- [Phase 13]: leaflet-simple-map-screenshoter plugin for PNG export (hidden control, programmatic capture)
- [Phase 14]: Import WRITERS from conversion router (no duplication)
- [Phase 14]: Default output format matches input extension, fallback to GeoJSON
- [Phase 14]: Split returns ZIP for multiple outputs, single file for single_value/single_range retrieval
- [Phase 14]: CRS detection heuristics: WGS84 lon/lat ranges, OSGB36 easting/northing ranges, UTM ambiguous returns None
- [Phase 14]: OutputPreviewTable as lightweight shared component (not reusing data-preview-table.tsx)
- [Phase 14]: Dual text/blob response reading for preview + download in transform tools
- [Phase 16]: All test stubs use it.todo() exclusively to avoid import errors from non-existent modules
- [Phase 16]: useReducer with lazy initializer for sessionStorage hydration (no HYDRATE action needed)
- [Phase 16]: Pipeline state machine: discriminated union PipelineAction with exhaustive switch in pipelineReducer
- [Phase 16]: Smart gating via canNavigateTo: import always navigable, validate/clean skippable, export after import
- [Phase 16]: SerializablePipelineState omits parsedData and cleanedData from sessionStorage
- [Phase 16]: fileRef pattern: File object in useRef at workflow level, passed to stages needing file access
- [Phase 16]: Client-side CSV/Excel parsing in Inspect stage for instant preview without server round-trip
- [Phase 17]: Row-level diff cap at 100 entries with totalChanges count for full audit trail without unbounded metadata
- [Phase 17]: Reuse existing POST /api/validate for config snapshot re-run instead of creating a new API route
- [Phase 18]: Review stage auto-skips with toast when validation finds 0 issues
- [Phase 18]: Issue ID convention: type-row-column-index for triage decision mapping
- [Phase 18]: Inline severity colors to avoid ValidationSeverity type mismatch with client-side types
- [Phase 18]: Bulk reject uses Dialog modal since one justification applies to many issues
- [Phase 19]: Use matplotlib Figure directly (not pyplot) for thread safety in FastAPI
- [Phase 19]: Temp file approach for PIL-to-FPDF image embedding (fpdf2 image() needs file path)
- [Phase 19]: Executive mode returns early after top issues + SoQ (no methodology, no full table)
- [Phase 19]: KP density uses scatter strip plot (y-axis hidden) for compact visualization
- [Phase 19]: Click-outside dropdown pattern for PDF report mode selection (useRef + useEffect)
- [Phase 19]: Fetch-based blob download (not window.open) for consistent cross-browser PDF downloads
- [Phase 20]: KP drift uses coordinate distance in km for consistent KP comparison
- [Phase 20]: Severity overrides per pack via string fields on ProfileConfig for JSON compat
- [Phase 20]: RangeThreshold tolerance only flattened when > 0 to keep config clean
- [Phase 20]: suggestProfileFromHeaders for pipeline context where ColumnMapping objects unavailable
- [Phase 20]: Chain check numeric inputs disabled with opacity-50 when toggle off
- [Phase 20]: KP drift tolerance displayed as percentage for user-friendly editing
- [Phase 20]: Domain QC packs complete: 4 packs replace old templates, chain-aware validators, auto-suggestion verified
- [Phase 21]: Pure function checkUsageLimit for testable tier enforcement; limitReached flag on errors for upgrade prompts
- [Phase 21]: Billing period clamping via Math.min(anchorDay, daysInMonth) for month-end edge cases
- [Phase 21]: Server action pattern for usage data fetch -- keeps auth on server, allows client-side rendering of progress bars

### Roadmap Evolution

- Phase 11 added: File Format Parsers (GeoJSON, Shapefile, KML, LandXML, DXF)
- Phase 12 added: Format Conversion Tool (standalone convert UI + API)
- Phase 13 added: Map Visualization (interactive Leaflet map for spatial data)
- Phase 14 added: Data Transform Tools (CRS conversion, merge, split, clean)
- Phase 15 added: Dataset Comparison (as-built vs as-designed diff)
- Phase 16 added: Pipeline Workflow (guided step-by-step processing flow)
- Phase 19 added: Client-Grade Reports (executive vs technical modes, visual QC summaries, Statement of Quality)
- Phase 20 added: Domain-Specific QC Packs (pre-built rule packs, tolerance-based validation, chain-aware checks)

### Pending Todos

None yet.

### Blockers/Concerns

- Research flag: Phase 4 ingestion needs real survey data samples to validate parsing approach
- Research flag: Phase 5 validation engine architecture is critical -- consider Great Expectations/Pandera patterns
- WeasyPrint system dependencies need verification on Railway Docker during Phase 9 -- RESOLVED: using fpdf2 instead (no system deps)
- PDF reports: fpdf2 with compression disabled for testability; QCReport(FPDF) subclass pattern
- Dataset export: openpyxl for Excel with PatternFill highlighting; pandas for CSV annotation

## Session Continuity

Last session: 2026-04-10T16:38:33.026Z
Stopped at: Completed 21-02-PLAN.md
Resume file: None
