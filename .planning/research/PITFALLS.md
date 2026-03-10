# Pitfalls Research

**Domain:** Survey Data QA & Validation Platform (Pipeline/Seabed Engineering)
**Researched:** 2026-03-10
**Confidence:** HIGH (stack-level); MEDIUM (domain-specific QC logic)

## Critical Pitfalls

### Pitfall 1: Vercel Serverless Cannot Process Files -- Do Not Route Uploads Through Next.js

**What goes wrong:**
Developers route file uploads through Next.js API routes on Vercel, which has a 4.5MB request body limit on serverless functions and a 10-second timeout on the free tier (60s with Fluid Compute on free, up to 5 minutes on Pro). A 50MB CSV upload will fail immediately. Even if the upload succeeds, any processing in the Next.js API route will timeout long before pandas finishes analyzing the data.

**Why it happens:**
The natural instinct is to build a unified upload endpoint in Next.js. Developers don't realize Vercel serverless functions have strict body size and duration limits until deployment.

**How to avoid:**
Upload files directly from the browser to Supabase Storage using the client-side Supabase SDK (bypassing Vercel entirely). Then trigger the FastAPI backend via a webhook or polling mechanism to process the file. The FastAPI backend reads the file from Supabase Storage, processes it, and writes results back to Supabase. Never proxy file uploads through Vercel serverless functions.

**Warning signs:**
- Any `api/upload` route in the Next.js codebase
- File processing logic inside Next.js API routes
- 413 errors or timeout errors in Vercel logs

**Phase to address:**
Phase 1 (Foundation) -- this architectural decision must be correct from day one. Retrofitting is painful.

---

### Pitfall 2: Using FastAPI BackgroundTasks for Heavy CSV Processing

**What goes wrong:**
FastAPI's built-in `BackgroundTasks` runs in the same event loop as the API server. A 50MB CSV file with pandas operations (statistical analysis, anomaly detection) is CPU-intensive and will block the event loop, making the entire API unresponsive for all users during processing. There is no job status tracking, no retry on failure, and no ability to scale workers independently.

**Why it happens:**
`BackgroundTasks` is the first thing in FastAPI docs and works perfectly for sending emails. Developers assume it scales to heavier workloads.

**How to avoid:**
For a solo developer with a 2-month timeline, use a lightweight task queue rather than full Celery (which requires Redis/RabbitMQ infrastructure). Options ranked by complexity:
1. **ARQ** (async Redis queue) -- asyncio-native, minimal setup, good fit for FastAPI. Requires a Redis instance (free tier available on Upstash/Railway).
2. **Supabase Database as a job queue** -- store job records in a `processing_jobs` table, have a worker poll for pending jobs. Simpler but less robust. Acceptable for MVP with low concurrency.
3. **Celery** -- production-proven but heavy infrastructure for a solo dev MVP.

Recommendation: Start with option 2 (database job queue) for MVP simplicity, migrate to ARQ when you need reliability guarantees.

**Warning signs:**
- API response times degrading when files are being processed
- Users reporting the app "freezes" during uploads
- No way to check processing status or retry failed jobs

**Phase to address:**
Phase 2 (File Upload & Processing) -- the async processing architecture must be designed before building the processing pipeline.

---

### Pitfall 3: Trusting `getSession()` Instead of `getUser()` in Server-Side Code

**What goes wrong:**
`supabase.auth.getSession()` reads the session from cookies but does NOT revalidate the auth token with Supabase's server. This means an expired or tampered token will still appear valid. Using it in middleware, server components, or API routes creates a security vulnerability where users can access resources after their session should have expired.

**Why it happens:**
`getSession()` is faster (no network call) and the naming suggests it's the right method. Older tutorials and examples use it everywhere. The distinction between `getSession()` and `getUser()` is subtle and poorly understood.

**How to avoid:**
Always use `supabase.auth.getUser()` in middleware and any server-side authorization check. It makes a request to Supabase Auth to revalidate the token every time. Use `getSession()` only on the client side for displaying UI state (not for authorization decisions).

**Warning signs:**
- `getSession()` calls in middleware.ts or server components
- Auth checks that never make network requests
- Users reporting they can still access pages after logout

**Phase to address:**
Phase 1 (Foundation/Auth) -- must be correct in the initial auth setup. Use the official `@supabase/ssr` package and follow the current (not legacy) Next.js auth guide.

---

### Pitfall 4: Loading Entire CSV/Excel Files Into Memory with Pandas

**What goes wrong:**
`pd.read_csv()` and `pd.read_excel()` load the entire file into memory as a DataFrame. A 50MB CSV can expand to 200-500MB in memory (pandas overhead is 5-10x the file size). With multiple concurrent users processing files, the server runs out of memory and crashes.

**Why it happens:**
Pandas is the default tool for CSV processing in Python, and the simplest usage pattern loads everything into memory. It works perfectly during development with small test files.

**How to avoid:**
- Use `chunksize` parameter: `pd.read_csv(file, chunksize=10000)` to process in chunks
- For validation rules that need the full dataset (e.g., cross-row comparisons, statistical outliers), load only the columns needed: `usecols=['KP', 'DOB', 'DOC']`
- Set explicit `dtype` mappings to prevent pandas from inferring types (which uses more memory and can misinterpret survey data -- e.g., treating KP values as dates)
- For Excel files, use `openpyxl` in read-only mode for large files
- Set memory limits on your processing container/worker

**Warning signs:**
- Memory usage spikes during processing visible in monitoring
- OOMKilled errors in container logs
- Processing works with test files but fails with real client data

**Phase to address:**
Phase 2 (Processing Pipeline) -- implement chunked processing from the start. Do not optimize later.

---

### Pitfall 5: Not Handling Real-World Survey Data Messiness

**What goes wrong:**
Survey data from the field is messy in ways that synthetic test data is not. Common issues:
- Mixed encodings (UTF-8, ISO-8859-1, Windows-1252) in the same batch of files
- Inconsistent delimiters (commas, semicolons, tabs) depending on export software
- Header rows that don't match expected schemas (extra columns, missing columns, different naming conventions between clients)
- Numeric fields containing text annotations ("12.5 (estimated)", "N/A", "-999")
- Mixed coordinate formats (decimal degrees, degrees-minutes-seconds)
- Empty rows or metadata rows embedded in data (export headers, timestamps)
- BOM (byte order mark) characters at the start of files

Engineers will upload data exported from various survey software packages (Eiva NaviPac, QPS Qinsy, Trimble, custom Excel templates), each with its own quirks.

**Why it happens:**
Developers test with clean, well-formatted data. Real survey data comes from multiple instruments, software packages, and manual entry. Each client's data looks slightly different.

**How to avoid:**
- Auto-detect encoding using `chardet` or `charset-normalizer` before reading
- Auto-detect delimiters using `csv.Sniffer` or pandas' `sep=None` with `engine='python'`
- Build a flexible file ingestion layer that normalizes data before validation rules run
- Define expected schemas per survey type but handle missing/extra columns gracefully
- Treat all numeric parsing as explicit (never rely on pandas auto-inference for survey data)
- Strip BOM characters and whitespace from headers
- Add a "file preview" step where users confirm the parsed structure before processing

**Warning signs:**
- UnicodeDecodeError or ParserError in production logs
- Validation rules passing on test data but producing nonsensical results on real data
- Users reporting "the system can't read my file" as the most common support request

**Phase to address:**
Phase 2 (File Upload & Processing) -- the ingestion/normalization layer is separate from validation logic and must be robust before validation rules are built on top.

---

### Pitfall 6: Validation Rules That Are Too Rigid or Too Opaque

**What goes wrong:**
Building validation rules that are hardcoded to specific thresholds, column names, or data formats. When a new client has slightly different data conventions, the entire rule engine breaks. Alternatively, rules that flag issues without clear explanations -- engineers won't trust a system that says "anomaly detected" without explaining why.

**Why it happens:**
It's faster to hardcode rules than to build a configurable rule engine. Explainability is treated as a nice-to-have rather than a core requirement.

**How to avoid:**
- Design validation profiles as configurable JSON/database records from the start, not hardcoded functions
- Every rule must produce: field name, row number, expected value/range, actual value, severity level, and a human-readable explanation
- Create default profiles per survey type (DOB, DOC, pipeline position) that users can clone and modify
- Separate rule definition (what to check) from rule execution (how to check) so new rules can be added without code changes
- Include context in flags: "KP 1234.5: DOB value 15.2m exceeds maximum threshold of 12.0m for this pipeline section"

**Warning signs:**
- Rules defined as if/else blocks in Python code rather than data-driven configurations
- Flag output that says "FAIL" without explaining what failed or why
- Every new client requiring code changes to support their data format
- Engineers asking "why was this flagged?" with no programmatic answer

**Phase to address:**
Phase 3 (Validation Engine) -- the rule engine architecture is the core product. Getting this wrong means a rewrite.

---

### Pitfall 7: RLS Performance Degradation on Data-Heavy Tables

**What goes wrong:**
Row-Level Security policies on tables that store validation results, flagged issues, or uploaded data rows execute per-row checks. When a single survey job produces thousands of validation flags, queries with RLS become extremely slow. The RLS function (e.g., checking `auth.uid()` against a join table of project permissions) gets called for every row returned, creating an O(n) performance problem that resembles n+1 queries.

**Why it happens:**
RLS works great for small tables (users, projects). Developers apply the same pattern to high-volume tables (validation results, data rows) without realizing the performance implications.

**How to avoid:**
- Add indexes on all columns used in RLS policies (especially `user_id`, `project_id`)
- Wrap `auth.uid()` calls in a subselect: `(SELECT auth.uid()) = user_id` -- this caches the function result instead of calling it per row
- Use RLS only for SELECT operations. Route all INSERT/UPDATE/DELETE through server-side functions using the service role key
- Consider using security definer functions for complex permission checks
- For high-volume result tables, filter by project/job ID first (indexed), then apply RLS as a secondary check
- Monitor query performance with `EXPLAIN ANALYZE` on queries that touch large tables

**Warning signs:**
- Dashboard loading slowly when displaying validation results
- Query times increasing linearly with the number of results
- Supabase dashboard showing high database CPU usage

**Phase to address:**
Phase 1 (Database Schema) for initial design; Phase 4 (Dashboard) when results tables grow large. Index creation and RLS optimization should be part of schema design.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Database polling instead of proper task queue | No Redis/queue infrastructure needed | Higher DB load, no retry logic, no dead letter queue | MVP only -- migrate to ARQ/queue before 50+ concurrent users |
| Hardcoded validation thresholds | Ship faster, fewer abstractions | Every new client needs code changes, can't offer user-configurable rules | Never -- build data-driven rules from Phase 3 |
| Single pandas DataFrame (no chunking) | Simpler code, faster development | OOM crashes with real-world file sizes | Development/testing only -- production must chunk |
| Storing processed results as JSON blobs | Flexible schema, fast to implement | Can't query/filter/sort results efficiently, reporting becomes painful | MVP if results are small; refactor to structured tables before GC reports |
| Skipping file format detection | Assume UTF-8 CSV with commas | First real client file breaks the system | Never -- detect encoding and delimiter from Phase 2 |
| `getSession()` everywhere | Faster responses (no auth roundtrip) | Security vulnerability, stale sessions | Client-side UI state only, never for authorization |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase Storage (uploads) | Routing uploads through Vercel serverless (4.5MB limit) | Upload directly from browser to Supabase Storage using client SDK, then notify FastAPI |
| Supabase Auth + Next.js SSR | Using `@supabase/auth-helpers` (deprecated) | Use `@supabase/ssr` package; create separate clients for server components, route handlers, and middleware |
| FastAPI + Supabase | Using anon key in FastAPI backend | Use service role key in FastAPI (server-to-server); never expose service role key to client |
| CORS (Next.js <-> FastAPI) | Adding CORSMiddleware after other middleware | CORSMiddleware must be the FIRST middleware added to the FastAPI app |
| Supabase Storage file overwrites | Overwriting files at the same path | Supabase CDN caches aggressively; use unique paths (include job ID/timestamp) to avoid stale file serving |
| Next.js middleware + Supabase PPR | Calling `getUser()` in middleware with PPR enabled | Rate limiting (429 errors) from uncached `getUser()` calls; consider caching strategy or conditional middleware |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Full DataFrame in memory | OOM kills, server crashes | Use `chunksize`, `usecols`, explicit `dtype` | Files > 20MB with multiple concurrent users |
| RLS on high-volume tables | Slow dashboard queries, high DB CPU | Index RLS columns, use subselect for `auth.uid()`, service role for writes | > 1000 rows returned per query |
| Synchronous file processing | API unresponsive during processing | Task queue (even simple DB-based queue) | Any file > 5MB or processing > 10 seconds |
| Unindexed query on validation results | Report generation takes minutes | Add composite indexes on (job_id, severity, rule_id) | > 10,000 validation flags per job |
| Supabase free tier connection limits | Random connection refused errors | Use connection pooling (Supavisor), limit concurrent DB connections from FastAPI | > 10 concurrent users on free tier |
| Pandas dtype auto-inference | Wrong types, memory bloat, KP values parsed as dates | Specify `dtype` dict explicitly for all columns | First file with ambiguous numeric/date-like values |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Exposing Supabase service role key to client | Full database access bypassing all RLS | Service role key only in FastAPI backend (server-side env var). Client uses anon key only |
| No file type validation on upload | Users upload malicious files (scripts, executables) | Validate MIME type and file extension server-side; accept only .csv, .xlsx, .xls |
| No per-user storage quotas | Single user fills storage, costs spike | Enforce upload limits per tier in both UI and backend; check cumulative storage before accepting uploads |
| Storing raw uploaded files without scanning | Malicious Excel macros (if .xlsm allowed) | Only accept .xlsx (not .xlsm); strip macros; process with openpyxl not xlrd |
| Cross-tenant data access via direct Supabase queries | User A sees User B's survey data | RLS policies on every table with tenant isolation; test with multiple user accounts |
| Processing untrusted formulas in Excel | Formula injection leading to SSRF or data exfiltration | Use `data_only=True` in openpyxl to read values not formulas; never evaluate formulas |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No processing progress indicator | Users re-upload files thinking it's stuck, creating duplicate jobs | Show clear status: uploaded -> queued -> processing (X%) -> complete/failed |
| Validation errors without context | Engineers can't understand what failed or where | Every flag includes: row number, column, expected value, actual value, rule name, plain-English explanation |
| Forcing users to configure rules before first upload | High friction for first-time users, abandonment | Provide sensible defaults per survey type; let users upload immediately and configure later |
| No file preview before processing | Users don't realize their file was parsed incorrectly | Show first 10 rows and detected columns before processing; let users confirm or adjust |
| Flat list of hundreds of validation flags | Overwhelming, unusable | Group flags by category (data gaps, threshold violations, format errors); show summary statistics first, drill into details |
| No way to dismiss false positives | Engineers mark the same false flags every time | Allow "acknowledge" or "ignore rule for this range" functionality; persist across re-runs |

## "Looks Done But Isn't" Checklist

- [ ] **File upload:** Often missing -- handling of files with BOM characters, mixed line endings (CRLF vs LF), or encoding other than UTF-8. Verify with real client files, not generated test data.
- [ ] **Validation engine:** Often missing -- explanations on every flag. A flag without an explanation is worthless to an engineer. Verify every rule produces a human-readable message.
- [ ] **GC report generation:** Often missing -- proper PDF formatting, company branding, page breaks, table overflow handling. A report that looks bad on print destroys credibility. Verify with 20+ page reports.
- [ ] **Auth flow:** Often missing -- password reset email delivery, session expiry handling, redirect after login. Verify the complete flow including edge cases (expired reset links, concurrent sessions).
- [ ] **Processing failure handling:** Often missing -- what happens when processing crashes midway? Verify: partial results are not saved as complete, user is notified of failure, retry is possible.
- [ ] **Multi-file jobs:** Often missing -- handling when one file in a batch fails but others succeed. Verify partial job completion is handled gracefully.
- [ ] **Download functionality:** Often missing -- large report downloads timing out, files generated with wrong encoding. Verify downloads work for reports > 10MB.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Vercel upload routing (wrong architecture) | MEDIUM | Refactor to client-side Supabase Storage upload; update all upload endpoints; test with large files |
| No task queue (BackgroundTasks) | MEDIUM | Add job table to DB, refactor processing to poll-based worker; existing processing logic reusable |
| `getSession()` security issue | LOW | Find-and-replace `getSession()` with `getUser()` in server code; update middleware |
| Full DataFrame memory issues | MEDIUM | Refactor to chunked processing; some validation logic needs rethinking for chunk boundaries |
| Hardcoded validation rules | HIGH | Requires redesigning rule storage and execution; existing rules must be migrated to data format |
| No file format detection | LOW | Add chardet + csv.Sniffer layer before pandas parsing; wrap in try/except with user-friendly errors |
| RLS performance on result tables | MEDIUM | Add indexes, optimize policies, potentially restructure queries; may require schema changes |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Vercel upload routing | Phase 1: Foundation | Upload a 50MB file successfully end-to-end |
| BackgroundTasks for processing | Phase 2: File Processing | Process a 50MB file while another user can still use the API |
| getSession() vs getUser() | Phase 1: Auth | Verify all server-side auth uses getUser(); no getSession() in middleware |
| Pandas memory management | Phase 2: Processing | Process 50MB file with < 512MB worker memory |
| Real-world data messiness | Phase 2: File Ingestion | Successfully parse 5 different real client file formats |
| Rigid validation rules | Phase 3: Validation Engine | Add a new validation rule without code changes |
| RLS performance | Phase 1: Schema + Phase 4: Dashboard | Query 10,000 validation results in < 500ms |
| Validation explainability | Phase 3: Validation Engine | Every flag in test output includes row, column, expected, actual, explanation |
| GC report quality | Phase 4: Reports | Generate and print a 20-page report; verify formatting |
| Processing failure handling | Phase 2: Processing | Kill processing mid-run; verify clean state and user notification |

## Sources

- [Next.js + Supabase in production: what would I do differently](https://catjam.fi/articles/next-supabase-what-do-differently)
- [Supabase RLS Performance and Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)
- [Supabase Storage File Limits](https://supabase.com/docs/guides/storage/uploads/file-limits)
- [Supabase SSR Auth for Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Vercel Functions Limitations](https://vercel.com/docs/functions/limitations)
- [Vercel Body Size Limit](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions)
- [FastAPI Background Tasks](https://fastapi.tiangolo.com/tutorial/background-tasks/)
- [FastAPI and Celery](https://testdriven.io/blog/fastapi-and-celery/)
- [FastAPI CORS Middleware](https://fastapi.tiangolo.com/tutorial/cors/)
- [Optimizing Memory for Large CSV Processing](https://discuss.python.org/t/optimizing-memory-usage-for-large-csv-processing-in-python-3-12/98287)
- [Pandas read_csv documentation](https://pandas.pydata.org/docs/reference/api/pandas.read_csv.html)

---
*Pitfalls research for: Survey Data QA & Validation Platform (Pipeline/Seabed Engineering)*
*Researched: 2026-03-10*
