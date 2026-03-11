# Phase 3: File Upload & Storage - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can upload survey data files (CSV, Excel) that are securely stored in Supabase Storage and associated with their jobs. This phase delivers: drag-and-drop upload interface, file storage in Supabase, file management (view, download, delete), and a job detail page with tabs. Column detection, data parsing, and validation are out of scope (Phase 4+).

</domain>

<decisions>
## Implementation Decisions

### Upload Experience
- Drag-and-drop zone with dashed border — users can drag files or click to browse
- Drop zone shows accepted formats and 50MB limit hint
- Active drop state: border changes to brand teal, background gets subtle tint, icon animates
- Multi-file upload supported — users can drop or select multiple files at once
- Files queue up after drop/browse — manual "Upload All" button to start (not auto-upload)
- Each queued file has an X button to remove it from queue before upload, plus "Clear All"
- Per-file progress bars with percentage, filename, and size during upload
- Per-file cancel button during upload — cancelled files show as "Cancelled"
- Client-side validation before upload: reject wrong file types and files over 50MB with inline errors
- Per-file status on completion: success (green checkmark), failed (error message + Retry button), cancelled
- Partial batch failure handled gracefully — successful files kept, failed files show Retry
- After successful upload, files stay visible with checkmarks; drop zone resets above list for more files
- Duplicate filename warning: user chooses Replace, Keep Both (auto-rename), or Skip

### File-to-Job Association
- Upload interface lives on the job detail page — files automatically tied to the job
- Job detail page is a new page at /projects/[projectId]/jobs/[jobId]
- Accessed by clicking a job row in the project detail page (consistent with project list → project detail pattern)
- Job detail page uses tabs layout: "Files" tab (upload + file list) and "Results" tab (placeholder for Phase 8)
- Job header shows job name, survey type badge, status badge, and description
- Breadcrumb navigation: Projects › [Project Name] › [Job Name]
- No hard file count limit per job for MVP — 50MB per-file limit is sufficient constraint
- No total user storage limit for MVP — defer to subscription tiers in Phase 10

### File Management
- Uploaded files displayed in a table: filename, size, upload date, status columns
- Table pattern consistent with projects list from Phase 2
- Three-dot dropdown menu per file row with: Download, Delete
- Download generates a signed URL from Supabase Storage
- Delete requires confirmation dialog before actual deletion (removes from Storage + database)

### Upload Constraints
- Accepted formats: .csv, .xlsx, .xls (legacy Excel for compatibility)
- Max file size: 50MB per file (enforced client-side + server-side)
- Network error: file shows "Upload failed" with reason and Retry button

### Claude's Discretion
- Upload component library choice (native HTML5 drag-and-drop vs library like react-dropzone)
- Supabase Storage bucket structure and naming convention
- Database schema for files/datasets table
- RLS policies for file access isolation
- Signed URL expiration time for downloads
- File status values and transitions
- Results tab placeholder content
- Empty state for job with no files
- Exact animation and transition details for drop zone

</decisions>

<specifics>
## Specific Ideas

- Upload UX should feel polished — progress bars, per-file status, cancel/retry give users confidence and control
- Table for file list keeps it consistent with Phase 2's projects table — efficient for scanning
- Tabs on job detail page create a clean separation between files and future results
- Duplicate filename handling prevents accidental data loss (warn, don't silently overwrite)
- Drop zone visual feedback (teal highlight + overlay) makes it obvious where to drop

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- shadcn/ui components: Dialog, Table, Button, Badge, Card, DropdownMenu, Skeleton — all available
- Supabase client setup (src/lib/supabase/server.ts, client.ts) — ready for Storage API calls
- Server actions pattern (src/lib/actions/projects.ts) — use same pattern for file upload actions
- useActionState + Sonner toast pattern for form feedback
- Project types and job types (src/lib/types/projects.ts) — extend with file/dataset types

### Established Patterns
- Server Components for data fetching, Client Components for interactivity
- Dialog component for confirmation flows (existing create-job-dialog pattern)
- Table component for list views (projects list pattern)
- getUser() for server-side auth checks
- Breadcrumb component available in shadcn/ui

### Integration Points
- Job detail page: new route at src/app/(dashboard)/projects/[projectId]/jobs/[jobId]/page.tsx
- Jobs list in project detail page needs clickable rows linking to job detail
- Supabase Storage bucket needs creation (new infrastructure)
- Database migration needed for files/datasets table with job_id foreign key
- RLS policies needed for file access isolation (user can only access own files)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-file-upload-storage*
*Context gathered: 2026-03-11*
