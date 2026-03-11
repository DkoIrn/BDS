# Phase 4: Ingestion Pipeline - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

The system can parse uploaded files, detect column types, and let users confirm or correct mappings before processing. This phase delivers: CSV/Excel parsing, column auto-detection with confidence scoring, a mapping interface, data preview, and messy data handling (BOM, encodings, metadata rows). Validation rules and async processing are out of scope (Phases 5, 7).

</domain>

<decisions>
## Implementation Decisions

### Column Mapping Interface
- Table layout with dropdown selectors per column — consistent with table patterns from Phases 2-3
- Each row shows: original column name, auto-detected type (dropdown), confidence badge (High/Medium/Low)
- Unrecognized columns shown inline with an 'Unmapped' badge and dropdown to assign type or mark 'Ignore'
- Survey-type-aware detection: if job is 'DOB', system expects KP + depth columns and warns if missing
- Expected column types informed by the survey type already stored on the job (from Phase 2)

### Data Preview
- Preview table positioned below the column mapping table — vertical flow
- Shows first 50 rows with a note like "Showing 50 of 12,450 rows"
- Column headers show both original file header name and mapped survey field type as a badge/tag below
- Mapped columns displayed first, unmapped/ignored columns pushed to the end
- Horizontal scroll for files with many columns

### Parsing & Messy Data Handling
- Parsing runs in Next.js API routes using JS libraries (Papa Parse, SheetJS) — no FastAPI backend for this phase
- Auto-detect data start row: system scans for the first row that looks like column headers, shows detected start row to user who can adjust if wrong
- Auto-parse after upload: as soon as a file uploads, parsing starts automatically with loading state, then mapping interface appears
- Warning banner for parsing issues: yellow banner above preview showing "Fixed 3 issues: BOM removed, 2 rows with encoding errors." Auto-fix what's possible, expandable details for the rest

### Post-Mapping Workflow
- Explicit "Confirm Mappings" button to lock in column assignments — saves to database, sets file status to 'mapped'
- "Edit Mappings" button available after confirmation to reopen mapping interface and re-confirm
- Dedicated file detail page at /projects/[projectId]/jobs/[jobId]/files/[fileId] — consistent drill-down pattern
- File list table on job detail page shows status badges: 'Uploaded' → 'Parsed' → 'Mapped'
- Clicking an unmapped file navigates to the mapping page

### Claude's Discretion
- Papa Parse vs SheetJS library choices and configuration
- Column detection algorithm and heuristics
- Database schema for storing column mappings and parsed metadata
- API route structure for parsing endpoints
- Loading states and skeleton design during parsing
- Exact confidence scoring algorithm
- Header row detection heuristics
- Error handling for completely unparseable files

</decisions>

<specifics>
## Specific Ideas

- Survey-type-aware detection leverages the survey type already captured on jobs in Phase 2 — connects existing data to new functionality
- Auto-parse after upload creates a seamless flow: drop file → see mappings → confirm → done
- Warning banner approach mirrors how professional data tools handle messy inputs — fix silently, inform clearly
- Confidence badges help survey engineers know which auto-detections to trust vs double-check
- File detail page follows the existing drill-down pattern: Projects → Jobs → Files

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- Table component (src/components/ui/table.tsx) — for mapping table and preview table
- Badge component (src/components/ui/badge.tsx) — for confidence levels and status indicators
- Select/Dropdown component (src/components/ui/select.tsx) — for column type dropdowns
- Dialog component (src/components/ui/dialog.tsx) — for confirmation flows
- Tabs component (src/components/ui/tabs.tsx) — already used on job detail page
- FileList component (src/components/files/file-list.tsx) — needs status badge addition
- Skeleton component (src/components/ui/skeleton.tsx) — for loading states during parsing

### Established Patterns
- Server Components for data fetching, Client Components for interactivity
- useActionState (React 19) for form handling with server actions
- Sonner toast for success/error feedback
- getUser() for server-side auth checks
- Table pattern with sortable columns (projects list, file list)
- Drill-down page pattern: /projects/[id] → /projects/[id]/jobs/[id]
- Dataset type (src/lib/types/files.ts) with status field — currently only 'uploaded', needs extension

### Integration Points
- Job detail page (src/app/(dashboard)/projects/[projectId]/jobs/[jobId]/page.tsx) — file clicking needs to route to file detail page
- Dataset status in files.ts needs new states: 'parsing', 'parsed', 'mapped', 'error'
- New file detail page route: src/app/(dashboard)/projects/[projectId]/jobs/[jobId]/files/[fileId]/page.tsx
- New API route needed for parsing: src/app/api/parse/route.ts or similar
- Database migration needed for column_mappings table and parsed file metadata
- FileUploadZone needs to trigger auto-parse after successful upload

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-ingestion-pipeline*
*Context gathered: 2026-03-11*
