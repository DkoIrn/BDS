---
phase: 03-file-upload-storage
plan: 01
subsystem: database, storage, api
tags: [supabase, rls, storage, server-actions, typescript]

requires:
  - phase: 02-project-structure
    provides: Jobs table, projects/jobs types, server action patterns
provides:
  - Datasets table with RLS policies
  - Supabase Storage bucket (datasets) with 50MB limit and MIME restrictions
  - File CRUD server actions (createFileRecord, deleteFile, getDownloadUrl, getJobFiles)
  - TypeScript types for Dataset, FileUploadItem, constants
  - Clickable job rows linking to job detail route
  - Wave 0 test stubs for file actions and upload component
affects: [03-file-upload-storage plan 02, 04-data-ingestion]

tech-stack:
  added: []
  patterns: [storage-path-by-user-id, ownership-verification-via-job, signed-url-download]

key-files:
  created:
    - supabase/migrations/00003_datasets.sql
    - supabase/migrations/00004_storage_bucket.sql
    - src/lib/types/files.ts
    - src/lib/actions/files.ts
    - tests/actions/files.test.ts
    - tests/components/file-upload-zone.test.tsx
  modified:
    - src/components/jobs/jobs-list.tsx

key-decisions:
  - "Storage path uses user UUID as folder prefix for RLS scoping"
  - "createFileRecord is a plain async function (not form action) called after client upload succeeds"
  - "Signed download URLs expire after 5 minutes (300s)"

patterns-established:
  - "Storage path pattern: {userId}/{jobId}/{fileName} for RLS folder matching"
  - "File ownership verified through job ownership (query jobs with user_id filter)"
  - "Server actions return discriminated union: { success, id } | { error }"

requirements-completed: [FILE-06]

duration: 4min
completed: 2026-03-11
---

# Phase 3 Plan 1: File Data Layer Summary

**Datasets table with RLS, storage bucket with 50MB/MIME limits, file CRUD server actions with ownership enforcement, and clickable job rows**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-11T00:49:46Z
- **Completed:** 2026-03-11T00:53:28Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- Created datasets table migration with full RLS policies and updated_at trigger
- Created Supabase Storage bucket with 50MB file size limit and CSV/Excel MIME restrictions
- Implemented four server actions (createFileRecord, deleteFile, getDownloadUrl, getJobFiles) all with auth and ownership checks
- Made job names in jobs list clickable links to job detail route
- Established Wave 0 test stubs for both Phase 3 plans (8 test cases)

## Task Commits

Each task was committed atomically:

1. **Task 0: Create Wave 0 test stubs** - `de24eb7` (test)
2. **Task 1: Database migrations and TypeScript types** - `2d5e9cc` (feat)
3. **Task 2: Server actions and clickable job rows** - `a44d724` (feat)

## Files Created/Modified
- `supabase/migrations/00003_datasets.sql` - Datasets table with RLS and trigger
- `supabase/migrations/00004_storage_bucket.sql` - Storage bucket with MIME/size limits and RLS
- `src/lib/types/files.ts` - Dataset, FileUploadItem types, ACCEPTED_FILE_TYPES, MAX_FILE_SIZE
- `src/lib/actions/files.ts` - createFileRecord, deleteFile, getDownloadUrl, getJobFiles
- `src/components/jobs/jobs-list.tsx` - Added Link import and clickable job name
- `tests/actions/files.test.ts` - Test stubs for file server actions
- `tests/components/file-upload-zone.test.tsx` - Test stubs for upload component

## Decisions Made
- Storage path uses user UUID as top-level folder for RLS folder-matching via `storage.foldername(name)[1]`
- createFileRecord is a plain async server action (not form action) since it is called programmatically after client-side upload completes
- Signed download URLs set to 5-minute (300s) expiry for security
- Job ownership verification pattern: query jobs table with user_id filter before allowing file operations

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - migrations will be applied when `supabase db push` is run. No new environment variables needed.

## Next Phase Readiness
- Data layer complete for Plan 02 (upload UI component)
- Types, constants, and server actions ready for client-side upload component to consume
- Test stubs in place for both plans' verification needs

---
*Phase: 03-file-upload-storage*
*Completed: 2026-03-11*
