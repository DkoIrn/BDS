# Phase 3: File Upload & Storage - Research

**Researched:** 2026-03-11
**Domain:** File upload UX, Supabase Storage, Next.js client-side upload architecture
**Confidence:** HIGH

## Summary

This phase delivers drag-and-drop file upload (CSV/Excel, up to 50MB) to Supabase Storage, tied to survey jobs. The most critical architectural finding is that **Vercel serverless functions have a 4.5MB body size limit**, meaning files MUST be uploaded directly from the browser to Supabase Storage using the client-side Supabase SDK -- they cannot be proxied through Next.js API routes or server actions.

The recommended approach is: client-side upload via `supabase.storage.from('datasets').upload()` using the browser Supabase client (which carries the user's auth session), combined with a server action to create the database record (metadata only, not the file itself). RLS policies on `storage.objects` enforce per-user isolation using folder-based paths (`{user_id}/{job_id}/{filename}`).

**Primary recommendation:** Use react-dropzone for the drop zone UI, upload directly from browser to Supabase Storage (bypassing Vercel's 4.5MB limit), then call a server action to record file metadata in the database.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Drag-and-drop zone with dashed border, click-to-browse fallback
- Drop zone shows accepted formats and 50MB limit hint
- Active drop state: border changes to brand teal, background tint, icon animation
- Multi-file upload with manual "Upload All" button (not auto-upload)
- Per-file: X to remove from queue, progress bars with percentage, cancel during upload
- Client-side validation before upload: reject wrong types and files over 50MB
- Per-file completion status: success (green checkmark), failed (error + Retry), cancelled
- Partial batch failure: successful files kept, failed files show Retry
- Duplicate filename warning: Replace, Keep Both (auto-rename), or Skip
- Upload interface lives on job detail page at /projects/[projectId]/jobs/[jobId]
- Job detail page uses tabs: "Files" tab (upload + file list), "Results" tab (placeholder)
- Job header: name, survey type badge, status badge, description
- Breadcrumb: Projects > [Project Name] > [Job Name]
- No hard file count limit per job; no total user storage limit for MVP
- File table: filename, size, upload date, status columns
- Three-dot dropdown per file: Download, Delete
- Download via signed URL from Supabase Storage
- Delete requires confirmation dialog
- Accepted formats: .csv, .xlsx, .xls
- Max file size: 50MB per file (client + server enforced)
- Network error: "Upload failed" with reason and Retry button

### Claude's Discretion
- Upload component library choice (native HTML5 vs react-dropzone)
- Supabase Storage bucket structure and naming convention
- Database schema for files/datasets table
- RLS policies for file access isolation
- Signed URL expiration time for downloads
- File status values and transitions
- Results tab placeholder content
- Empty state for job with no files
- Exact animation and transition details for drop zone

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FILE-01 | User can upload CSV and Excel files (up to 50MB) via drag-and-drop | react-dropzone for UI, direct client-to-Supabase upload bypassing Vercel 4.5MB limit, bucket-level MIME type + size enforcement |
| FILE-06 | Files are stored securely in Supabase Storage tied to user account | Private bucket with RLS policies on storage.objects, user_id folder-based path isolation, database metadata table with user_id FK |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-dropzone | 15.x | Drag-and-drop file selection UI | 4400+ dependents, handles HTML5 DnD edge cases (Safari quirks, nested drops), provides isDragActive/isDragAccept/isDragReject states |
| @supabase/supabase-js | 2.99.x (already installed) | Client-side file upload to Storage | Direct browser-to-storage upload, carries auth session automatically |
| @supabase/ssr | 0.9.x (already installed) | Server-side Supabase client | For server actions (metadata CRUD, signed URLs, delete operations) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn/ui Tabs | latest | Job detail page tabs (Files/Results) | Needs to be installed via `npx shadcn@latest add tabs` |
| shadcn/ui Dialog | already installed | Delete confirmation dialog | Reuse existing pattern |
| shadcn/ui Table | already installed | File list table | Consistent with projects/jobs list pattern |
| shadcn/ui DropdownMenu | already installed | Three-dot file actions menu | Download/Delete actions per file |
| shadcn/ui Breadcrumb | already installed | Navigation breadcrumb | Projects > Project > Job |
| lucide-react | already installed | Icons (Upload, X, Check, MoreHorizontal, FileSpreadsheet) | UI icons throughout |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-dropzone | Native HTML5 DnD API | react-dropzone handles browser quirks (Safari file type detection, nested elements stealing events), provides clean hook API. Native would require reimplementing ~200 lines of edge case handling |
| Standard upload | TUS resumable upload | TUS recommended for files >6MB, but adds tus-js-client dependency and complexity. Standard upload works up to 5GB. For MVP with 50MB limit, standard is sufficient -- can upgrade later if reliability issues arise |

**Installation:**
```bash
npm install react-dropzone
npx shadcn@latest add tabs
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  app/(dashboard)/projects/[projectId]/jobs/[jobId]/
    page.tsx                    # Server component: job detail with tabs
  components/
    files/
      file-upload-zone.tsx      # Client component: react-dropzone + upload logic
      file-list.tsx             # Client component: table with file rows
      file-row-actions.tsx      # Client component: dropdown menu (download/delete)
      delete-file-dialog.tsx    # Client component: confirmation dialog
  lib/
    actions/
      files.ts                  # Server actions: createFileRecord, deleteFile, getSignedUrl
    types/
      files.ts                  # TypeScript types for files/datasets
  supabase/
    migrations/
      00003_datasets.sql        # Migration: datasets table + RLS
      00004_storage_bucket.sql  # Migration: storage bucket + storage RLS policies
```

### Pattern 1: Client-Side Direct Upload (CRITICAL)
**What:** Upload files directly from browser to Supabase Storage, then record metadata via server action
**When to use:** Always -- Vercel serverless functions have 4.5MB body limit, files cannot pass through API routes
**Example:**
```typescript
// Source: Supabase Storage docs + Vercel limits
// In a client component:
import { createClient } from '@/lib/supabase/client'

async function uploadFile(file: File, jobId: string, userId: string) {
  const supabase = createClient()
  const filePath = `${userId}/${jobId}/${Date.now()}-${file.name}`

  const { data, error } = await supabase.storage
    .from('datasets')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (error) throw error

  // Then call server action to create DB record
  return { storagePath: filePath, ...data }
}
```

### Pattern 2: Two-Step Upload-Then-Record
**What:** Upload to storage first, then create database record with metadata
**When to use:** Every file upload -- ensures storage and DB stay in sync
**Example:**
```typescript
// Step 1: Upload file to Supabase Storage (client-side)
const { data: storageData, error: storageError } = await supabase.storage
  .from('datasets')
  .upload(filePath, file)

// Step 2: Create database record (server action)
if (!storageError) {
  const result = await createFileRecord({
    jobId,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
    storagePath: filePath,
  })
  // If DB insert fails, clean up storage
  if (result.error) {
    await supabase.storage.from('datasets').remove([filePath])
  }
}
```

### Pattern 3: Server Action for Downloads (Signed URLs)
**What:** Generate signed URLs server-side, return to client for download
**When to use:** File download -- signed URLs expire, so generate on-demand
**Example:**
```typescript
// Server action in src/lib/actions/files.ts
'use server'
export async function getDownloadUrl(storagePath: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Verify ownership via DB before generating URL
  const { data: file } = await supabase
    .from('datasets')
    .select('id')
    .eq('storage_path', storagePath)
    .eq('user_id', user.id)
    .single()

  if (!file) return { error: 'File not found' }

  const { data, error } = await supabase.storage
    .from('datasets')
    .createSignedUrl(storagePath, 300) // 5 min expiry

  if (error) return { error: error.message }
  return { url: data.signedUrl }
}
```

### Pattern 4: Server Action for Delete (Storage + DB)
**What:** Delete from both Storage and database in one server action
**When to use:** File deletion -- must clean up both storage and DB record
**Example:**
```typescript
'use server'
export async function deleteFile(fileId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Get file record (RLS ensures ownership)
  const { data: file } = await supabase
    .from('datasets')
    .select('storage_path')
    .eq('id', fileId)
    .eq('user_id', user.id)
    .single()

  if (!file) return { error: 'File not found' }

  // Delete from storage first, then DB
  const { error: storageError } = await supabase.storage
    .from('datasets')
    .remove([file.storage_path])

  if (storageError) return { error: storageError.message }

  const { error: dbError } = await supabase
    .from('datasets')
    .delete()
    .eq('id', fileId)

  if (dbError) return { error: dbError.message }

  revalidatePath('/projects')
  return { success: true }
}
```

### Anti-Patterns to Avoid
- **Proxying files through API routes:** Vercel has 4.5MB body limit on serverless functions. Files over 4.5MB will fail with 413 error. Always upload directly from browser.
- **Using server actions for file upload:** Server actions are serverless functions -- same 4.5MB limit applies. Only use for metadata operations.
- **Storing files without DB records:** Always create a database record alongside storage upload. Storage alone makes querying/listing impossible.
- **Using `upsert: true` by default:** CDN propagation delays mean overwritten files may serve stale content. Use unique paths (timestamp prefix) instead.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-and-drop file selection | Custom HTML5 DnD handlers | react-dropzone `useDropzone` hook | Safari file type detection, nested element event stealing, keyboard accessibility, ARIA attributes |
| File type validation | Manual extension checking | react-dropzone `accept` prop + Supabase bucket `allowed_mime_types` | MIME type vs extension mismatches, case sensitivity, compound types (.xlsx is application/vnd.openxmlformats...) |
| Upload progress tracking | Custom XHR with onprogress | Supabase SDK handles progress internally; use state machine for UI states | Edge cases with network interruption, retry logic |
| Tabs component | Custom tab switching logic | shadcn/ui Tabs (Radix-based) | Keyboard navigation, ARIA roles, focus management |

**Key insight:** The upload flow has three independent failure points (client validation, storage upload, DB record creation) -- each needs separate error handling rather than one try/catch.

## Common Pitfalls

### Pitfall 1: Vercel 4.5MB Body Size Limit
**What goes wrong:** Files uploaded through Next.js API routes or server actions fail with 413 error for anything over 4.5MB
**Why it happens:** Vercel serverless functions enforce a hard 4.5MB request body limit
**How to avoid:** Upload directly from browser to Supabase Storage using the client-side SDK. Only use server actions for metadata (file records, signed URLs, delete operations)
**Warning signs:** "413 Payload Too Large" or "FUNCTION_PAYLOAD_TOO_LARGE" errors

### Pitfall 2: Storage/DB Inconsistency
**What goes wrong:** File exists in Storage but no DB record (or vice versa) -- orphaned files or broken references
**Why it happens:** Upload succeeds but DB insert fails, or delete removes DB record but storage delete fails
**How to avoid:** Upload to storage first, then create DB record. If DB insert fails, delete from storage (compensating transaction). For deletes, delete from storage first, then DB record.
**Warning signs:** Files not appearing in list despite successful upload toast

### Pitfall 3: MIME Type Mismatch for Excel Files
**What goes wrong:** `.xlsx` files rejected by type validation
**Why it happens:** The MIME type for `.xlsx` is `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (not `application/xlsx`). `.xls` is `application/vnd.ms-excel`.
**How to avoid:** Use the correct MIME types in react-dropzone `accept` and Supabase bucket `allowed_mime_types`:
```typescript
const accept = {
  'text/csv': ['.csv'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
}
```
**Warning signs:** Users report "file type not accepted" when dropping Excel files

### Pitfall 4: Missing Storage RLS Policies
**What goes wrong:** Upload fails with "new row violates row-level security policy"
**Why it happens:** Supabase Storage blocks all operations by default without RLS policies on `storage.objects`
**How to avoid:** Create explicit INSERT, SELECT, DELETE policies on `storage.objects` for authenticated users, scoped to the bucket and user folder
**Warning signs:** 403 or RLS violation errors on first upload attempt

### Pitfall 5: Duplicate Filename Handling
**What goes wrong:** Uploading a file with the same name as an existing file returns "400 Asset Already Exists"
**Why it happens:** Supabase Storage rejects uploads to existing paths by default (`upsert: false`)
**How to avoid:** Prefix filenames with timestamps for unique paths: `${userId}/${jobId}/${Date.now()}-${filename}`. For user-facing duplicate detection, query the DB for matching filenames in the same job before upload.
**Warning signs:** Upload errors on second file with same name

## Code Examples

### Database Migration: datasets table
```sql
-- Source: Follows existing projects/jobs pattern from 00002_projects_jobs.sql

CREATE TABLE public.datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'uploaded',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_datasets_job_id ON public.datasets(job_id);
CREATE INDEX idx_datasets_user_id ON public.datasets(user_id);

ALTER TABLE public.datasets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own datasets"
  ON public.datasets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own datasets"
  ON public.datasets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own datasets"
  ON public.datasets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own datasets"
  ON public.datasets FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER on_dataset_updated
  BEFORE UPDATE ON public.datasets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
```

### Database Migration: Storage bucket + RLS
```sql
-- Source: Supabase Storage docs - creating buckets + access control

-- Create private bucket with file restrictions
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'datasets',
  'datasets',
  false,
  52428800, -- 50MB in bytes
  ARRAY['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
);

-- Storage RLS: Users can upload to their own folder
CREATE POLICY "Users can upload to own folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'datasets' AND
    (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- Storage RLS: Users can view/download own files
CREATE POLICY "Users can view own files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'datasets' AND
    (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- Storage RLS: Users can delete own files
CREATE POLICY "Users can delete own files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'datasets' AND
    (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- Storage RLS: Users can update/upsert own files
CREATE POLICY "Users can update own files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'datasets' AND
    (storage.foldername(name))[1] = (select auth.uid()::text)
  );
```

### react-dropzone Configuration
```typescript
// Source: react-dropzone GitHub docs
import { useDropzone } from 'react-dropzone'

const ACCEPTED_TYPES = {
  'text/csv': ['.csv'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
}

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB in bytes

const { getRootProps, getInputProps, isDragActive, isDragAccept, isDragReject } = useDropzone({
  accept: ACCEPTED_TYPES,
  maxSize: MAX_FILE_SIZE,
  multiple: true,
  onDrop: (acceptedFiles, fileRejections) => {
    // Add accepted files to queue (don't auto-upload)
    // Show inline errors for rejections (wrong type, too large)
  },
  onDropRejected: (fileRejections) => {
    // Each rejection has file + errors array with code/message
    // codes: 'file-too-large', 'file-invalid-type'
  },
})
```

### File Status State Machine
```typescript
// Recommended status values and transitions
type FileUploadStatus = 'queued' | 'uploading' | 'uploaded' | 'failed' | 'cancelled'

// Transitions:
// queued -> uploading (user clicks "Upload All")
// queued -> removed (user clicks X, file removed from queue entirely)
// uploading -> uploaded (upload succeeds + DB record created)
// uploading -> failed (upload or DB record fails)
// uploading -> cancelled (user clicks cancel during upload)
// failed -> uploading (user clicks Retry)
// cancelled -> uploading (user clicks Retry)

// DB status (stored in datasets table):
type DatasetStatus = 'uploaded' // only successful files get DB records
```

### Signed URL Generation
```typescript
// Source: Supabase docs - createSignedUrl
const { data, error } = await supabase.storage
  .from('datasets')
  .createSignedUrl(storagePath, 300) // 300 seconds = 5 minutes

// Returns: { signedUrl: 'https://...' }
// Use 300s (5 min) for downloads -- long enough to start download, short enough for security
```

### Storage Path Convention
```
datasets/                          # bucket name
  {user_id}/                       # user isolation (RLS enforced)
    {job_id}/                      # job association
      {timestamp}-{filename}       # unique filename (avoids collisions)

Example: datasets/abc-123/def-456/1710100000000-survey_data.csv
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Proxy uploads through API routes | Direct client-to-storage upload | Vercel 4.5MB limit (longstanding) | Architecture must account for this from day one |
| Custom file input styling | react-dropzone useDropzone hook | react-dropzone 14+ (hooks API) | Clean, accessible drop zone with minimal code |
| Manual bucket creation in dashboard | SQL migration for bucket creation | Supabase supports `storage.buckets` table inserts | Reproducible infrastructure as code |

**Deprecated/outdated:**
- Supabase Storage v1 API (`supabase.storage.from().upload()` signature unchanged, but v1 client deprecated)
- Node.js 18 support dropped from Supabase (October 2025)

## Open Questions

1. **Upload progress granularity**
   - What we know: Supabase standard upload does not expose per-byte progress events (it is a single fetch/XHR call)
   - What's unclear: Whether we can get real progress bars or just indeterminate spinners for standard uploads
   - Recommendation: Use XHR-based upload or check if `onUploadProgress` is available in the current Supabase JS SDK. Fallback: show indeterminate progress bar per file. For MVP, indeterminate "uploading" state per file is acceptable -- the upload completes quickly for files under 50MB on decent connections.

2. **Duplicate detection scope**
   - What we know: User wants Replace/Keep Both/Skip for duplicate filenames
   - What's unclear: Whether duplicates should be detected across the entire job or just current upload batch
   - Recommendation: Check database for existing files with same `file_name` in same `job_id`. This covers both scenarios. Present the dialog before starting upload for any file that matches.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x + @testing-library/react 16.x + jsdom |
| Config file | vitest.config.ts (exists) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FILE-01 | Drop zone accepts CSV/XLS/XLSX, rejects others | unit | `npx vitest run tests/components/file-upload-zone.test.tsx -t "accepts"` | No -- Wave 0 |
| FILE-01 | Files over 50MB rejected with error | unit | `npx vitest run tests/components/file-upload-zone.test.tsx -t "rejects large"` | No -- Wave 0 |
| FILE-01 | Upload calls Supabase Storage then creates DB record | unit | `npx vitest run tests/components/file-upload-zone.test.tsx -t "upload flow"` | No -- Wave 0 |
| FILE-06 | Server action verifies user ownership before operations | unit | `npx vitest run tests/actions/files.test.ts -t "ownership"` | No -- Wave 0 |
| FILE-06 | Delete removes from both Storage and DB | unit | `npx vitest run tests/actions/files.test.ts -t "delete"` | No -- Wave 0 |
| FILE-06 | Signed URL generated only for owned files | unit | `npx vitest run tests/actions/files.test.ts -t "signed url"` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/components/file-upload-zone.test.tsx` -- covers FILE-01 upload UI
- [ ] `tests/actions/files.test.ts` -- covers FILE-06 server actions
- [ ] Supabase client mock setup for storage operations

## Sources

### Primary (HIGH confidence)
- [Supabase Storage Standard Uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads) - upload API, size limits, upsert behavior
- [Supabase Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control) - RLS policies on storage.objects, helper functions
- [Supabase Storage Bucket Creation](https://supabase.com/docs/guides/storage/buckets/creating-buckets) - SQL migration for buckets, file_size_limit, allowed_mime_types
- [Supabase Storage Helper Functions](https://supabase.com/docs/guides/storage/schema/helper-functions) - storage.foldername(), storage.filename(), storage.extension()
- [Supabase JS upload reference](https://supabase.com/docs/reference/javascript/storage-from-upload) - upload method signature and options
- [Supabase JS createSignedUrl](https://supabase.com/docs/reference/javascript/storage-from-createsignedurl) - signed URL generation
- [Supabase JS remove](https://supabase.com/docs/reference/javascript/storage-from-remove) - file deletion API
- [react-dropzone GitHub](https://github.com/react-dropzone/react-dropzone) - useDropzone API, v15.x
- [Vercel Function Limits](https://vercel.com/docs/functions/limitations) - 4.5MB body size limit

### Secondary (MEDIUM confidence)
- [Vercel KB: bypass 4.5MB limit](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions) - confirms direct-to-storage pattern
- [supalaunch.com guide](https://supalaunch.com/blog/file-upload-nextjs-supabase) - client-side upload pattern validation

### Tertiary (LOW confidence)
- Upload progress events -- unclear if Supabase JS SDK exposes granular progress for standard uploads; needs runtime validation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - react-dropzone is the de facto standard (4400+ dependents), Supabase Storage is well-documented
- Architecture: HIGH - Vercel 4.5MB limit is well-documented and dictates the direct-upload pattern; Supabase Storage RLS is well-documented
- Pitfalls: HIGH - all pitfalls verified against official docs (Vercel limits, Supabase RLS defaults, MIME types)
- Upload progress: LOW - needs runtime validation of Supabase SDK behavior

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (stable APIs, unlikely to change)
