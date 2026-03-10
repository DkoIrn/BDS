# Architecture Research

**Domain:** Survey data QA & validation platform (pipeline/seabed survey)
**Researched:** 2026-03-10
**Confidence:** HIGH

## System Overview

```
                         FRONTEND (Vercel)
  +---------------------------------------------------------+
  |                    Next.js App                           |
  |  +-------------+  +-------------+  +----------------+   |
  |  | Auth Pages  |  | Dashboard   |  | Upload/Results |   |
  |  +------+------+  +------+------+  +-------+--------+   |
  |         |                |                  |            |
  |  +------+----------------+------------------+--------+   |
  |  |          Supabase Client SDK (browser)            |   |
  |  +--+---------------------+---------------------+---+   |
  |     |                     |                     |        |
  +-----|---------------------|---------------------|--------+
        |                     |                     |
   Auth | (JWT)          DB/Realtime |          Storage |
        |                     |                     |
  +-----|---------------------|---------------------|--------+
  |     v                     v                     v        |
  |  +------+  +------------+  +------------------+         |
  |  | Auth |  | PostgreSQL |  | Object Storage   |         |
  |  +------+  +-----+------+  +--------+---------+         |
  |                   |                  |                   |
  |            SUPABASE PLATFORM         |                   |
  +--------------------|-----------------|-------------------+
                       |                 |
              DB trigger/webhook    File ref
                       |                 |
  +--------------------|-----------------|-------------------+
  |                    v                 v                   |
  |  +------------------------------------------+           |
  |  |          FastAPI Processing Service       |           |
  |  |  +----------+  +----------+  +--------+  |           |
  |  |  | Ingest   |  | Validate |  | Report |  |           |
  |  |  | Pipeline |  | Engine   |  | Gen    |  |           |
  |  |  +----------+  +----------+  +--------+  |           |
  |  +------------------------------------------+           |
  |           PROCESSING BACKEND (Railway/Render)            |
  +----------------------------------------------------------+
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Next.js App | UI rendering, auth flow, file upload, results display | App Router, Server Components for data-heavy pages, Client Components for interactivity |
| Supabase Auth | User registration, login, session management, JWT tokens | Supabase client SDK, middleware for route protection |
| Supabase PostgreSQL | Persistent storage: users, projects, jobs, validation profiles, results | Direct queries via Supabase client, Row Level Security (RLS) |
| Supabase Storage | Raw uploaded files, generated reports, cleaned datasets | Buckets with RLS policies, signed URLs for downloads |
| Supabase Realtime | Push job status updates to frontend without polling | Postgres Changes subscription on `jobs` table |
| FastAPI Service | All data processing: parsing, validation, anomaly detection, report generation | Separate deployment, receives work via webhook/API call |
| Ingest Pipeline | Parse CSV/Excel, normalize columns, detect schema | pandas read_csv/read_excel, column mapping |
| Validation Engine | Apply rule profiles, statistical checks, anomaly detection | pandas + numpy + scipy, configurable rule sets |
| Report Generator | Produce GC reports, anomaly reports, cleaned datasets | pandas output + templated report generation |

## Recommended Project Structure

### Frontend (Next.js)

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/             # Auth route group (login, register, reset)
│   ├── (dashboard)/        # Protected route group
│   │   ├── projects/       # Project listing and management
│   │   ├── jobs/           # Job detail, results viewer
│   │   └── settings/       # Profile, validation profiles, subscription
│   ├── api/                # Next.js API routes (lightweight proxying only)
│   │   └── webhooks/       # Webhook receivers if needed
│   └── layout.tsx          # Root layout with auth provider
├── components/
│   ├── ui/                 # Reusable UI primitives (buttons, cards, tables)
│   ├── upload/             # File upload dropzone, progress indicators
│   ├── results/            # Results table, flag viewer, charts
│   └── profiles/           # Validation profile editor
├── lib/
│   ├── supabase/           # Supabase client setup (browser + server)
│   ├── hooks/              # Custom React hooks (useJob, useProject, useRealtime)
│   └── utils/              # Formatters, constants, type guards
├── types/                  # TypeScript interfaces matching DB schema
└── middleware.ts           # Auth session refresh, route protection
```

### Backend (FastAPI)

```
api/
├── main.py                 # FastAPI app entry, CORS, lifespan
├── routers/
│   ├── process.py          # POST /process — triggered by webhook or direct call
│   └── health.py           # GET /health — monitoring
├── services/
│   ├── ingest.py           # File download from Supabase, parsing (CSV/Excel)
│   ├── validator.py        # Core validation engine, rule execution
│   ├── anomaly.py          # Statistical anomaly detection
│   ├── reporter.py         # Report generation (GC report, anomaly report)
│   └── supabase_client.py  # Supabase Admin SDK for DB/Storage access
├── models/
│   ├── schemas.py          # Pydantic models for API I/O
│   ├── rules.py            # Validation rule definitions
│   └── profiles.py         # Rule profile structures
├── core/
│   ├── config.py           # Environment variables, settings
│   └── security.py         # Webhook signature verification, service auth
└── tests/
    ├── test_validator.py
    └── test_anomaly.py
```

### Structure Rationale

- **Frontend `(auth)` / `(dashboard)` route groups:** Clean separation of public vs. protected pages. Auth pages need no sidebar/nav. Dashboard pages share a common layout with navigation.
- **Backend `services/` layer:** Each service is a pure-logic module. The router calls services; services never import from routers. This keeps processing logic testable without HTTP overhead.
- **Backend `models/rules.py`:** Validation rules are data, not code. Defining them as Pydantic models makes them serializable to/from the database and configurable by users.

## Architectural Patterns

### Pattern 1: Supabase as the Communication Bus

**What:** Instead of the frontend calling FastAPI directly, Supabase acts as the intermediary. The frontend writes to the database (creates a job row), a database webhook triggers the FastAPI backend, and the backend writes results back to the database. The frontend listens via Supabase Realtime.

**When to use:** This is the right pattern for this project because it eliminates cross-origin complexity, keeps auth centralized in Supabase, and gives you real-time updates for free.

**Trade-offs:**
- Pro: No CORS issues, no frontend-to-backend auth tokens to manage, real-time built in
- Pro: Frontend never needs to know the backend URL
- Pro: If backend is down, jobs queue up in the DB naturally
- Con: Slightly more latency than a direct API call (extra DB hop)
- Con: Webhook delivery is not guaranteed -- need retry logic

**Flow:**
```
1. User uploads file via frontend
2. Frontend uploads file to Supabase Storage
3. Frontend inserts row into `jobs` table (status: "pending", file_path: "...")
4. Supabase Database Webhook fires on INSERT → calls FastAPI /process endpoint
5. FastAPI downloads file from Supabase Storage using service role key
6. FastAPI updates job status to "processing" in DB
7. FastAPI runs validation pipeline
8. FastAPI uploads results to Supabase Storage + writes results to DB
9. FastAPI updates job status to "completed" (or "failed" with error)
10. Frontend receives status change via Supabase Realtime subscription
```

### Pattern 2: Layered Validation Pipeline

**What:** Processing is a sequential pipeline of discrete stages, each producing intermediate results stored in the database. Stages: ingest -> profile-match -> validate -> detect-anomalies -> generate-report.

**When to use:** Always for this domain. Survey data QC has a natural pipeline shape, and discrete stages enable partial results on failure and easier debugging.

**Trade-offs:**
- Pro: If anomaly detection fails, validation results are still available
- Pro: Each stage is independently testable
- Pro: Progress updates at each stage boundary
- Con: More DB writes (minor concern at this scale)

**Example:**
```python
# services/pipeline.py
async def process_job(job_id: str, file_path: str, profile_id: str):
    try:
        await update_job_status(job_id, "ingesting")
        df = await ingest_file(file_path)

        await update_job_status(job_id, "validating")
        profile = await load_validation_profile(profile_id)
        validation_results = validate(df, profile)

        await update_job_status(job_id, "detecting_anomalies")
        anomaly_results = detect_anomalies(df, profile)

        await update_job_status(job_id, "generating_report")
        report = generate_report(df, validation_results, anomaly_results)

        await store_results(job_id, validation_results, anomaly_results, report)
        await update_job_status(job_id, "completed")
    except Exception as e:
        await update_job_status(job_id, "failed", error=str(e))
```

### Pattern 3: Configurable Rule Profiles as Data

**What:** Validation rules are stored in the database as JSON, not hardcoded. Users can customize thresholds, toggle rules on/off, and create domain-specific profiles (DOB survey, pipeline position, etc.). The validation engine interprets rule data at runtime.

**When to use:** Always for this domain. Different survey types have different validation needs, and client specifications vary.

**Trade-offs:**
- Pro: Users customize without code changes
- Pro: Rule profiles become a product feature (templates for common survey types)
- Con: Runtime interpretation is slightly slower than hardcoded checks (irrelevant at this scale)

## Data Flow

### Primary Data Flow: Upload to Report

```
User selects file(s)
    |
    v
[Frontend] ──upload──> [Supabase Storage] (raw file stored)
    |
    v
[Frontend] ──INSERT──> [Supabase DB: jobs table]
    |                   (status: pending, file_path, profile_id, user_id)
    |
    v
[DB Webhook] ──POST──> [FastAPI /process]
                            |
                            v
                        Download file from Supabase Storage
                            |
                            v
                        Parse CSV/Excel with pandas
                            |
                            v
                        Load validation profile from DB
                            |
                            v
                        Execute rule checks + anomaly detection
                            |
                            v
                        Generate reports (GC report, anomaly report, cleaned data)
                            |
                            v
                        Upload outputs to Supabase Storage
                            |
                            v
                        Write results to DB (flags, stats, report URLs)
                            |
                            v
                        Update job status to "completed"
                            |
                            v
[Supabase Realtime] ──push──> [Frontend] (job status subscription)
    |
    v
User sees results, downloads reports
```

### Authentication Flow

```
[User] ──credentials──> [Supabase Auth] ──JWT──> [Frontend stores session]
    |
    v
[Frontend] ──queries with JWT──> [Supabase DB] (RLS enforces row-level access)
    |
    v
[FastAPI] ──service role key──> [Supabase DB/Storage] (bypasses RLS, full access)
```

The frontend NEVER talks directly to FastAPI. The backend uses a Supabase service role key (server-side only, never exposed to browser) to read/write data on behalf of users.

### Key Data Flows

1. **File Upload:** Browser -> Supabase Storage (direct upload via signed URL or client SDK). File never passes through FastAPI or Next.js server.
2. **Job Creation:** Browser -> Supabase DB (INSERT into jobs table). Triggers webhook to FastAPI.
3. **Processing Results:** FastAPI -> Supabase DB (writes validation flags, statistics) + Supabase Storage (uploads reports, cleaned files).
4. **Real-time Status:** Supabase DB change -> Supabase Realtime -> Browser (WebSocket subscription on jobs table filtered by user_id).
5. **Report Download:** Browser -> Supabase Storage (signed URL, time-limited, user-scoped via RLS).

## Database Schema (Key Tables)

```sql
-- Core entities
projects (id, user_id, name, description, created_at)
jobs (id, project_id, user_id, status, file_path, profile_id,
      results_path, error_message, created_at, updated_at)
validation_profiles (id, user_id, name, survey_type, rules_json, is_template, created_at)

-- Results
validation_flags (id, job_id, row_number, column_name, rule_id,
                  severity, message, value_found, expected_range)
job_statistics (id, job_id, total_rows, flagged_rows, anomaly_count,
               completeness_score, created_at)
```

**RLS Policy Pattern:** Every table has `user_id` column. RLS policies enforce `auth.uid() = user_id` for SELECT/INSERT/UPDATE/DELETE. FastAPI uses service role key to bypass RLS when writing results.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-100 users (MVP) | Single FastAPI instance on Railway/Render free tier. Synchronous processing within the webhook handler (no worker queue). Supabase free/Pro tier. |
| 100-1K users | Add Redis + ARQ or RQ for job queuing (decouple webhook receipt from processing). Multiple FastAPI workers. Supabase Pro tier. |
| 1K+ users | Celery + Redis for robust job queuing with retries. Horizontal scaling of workers. Consider chunked processing for files approaching 50MB. Supabase Team tier. |

### Scaling Priorities

1. **First bottleneck: Processing time.** A 50MB CSV with complex validation could take 30-60 seconds. At MVP scale, this is fine -- the webhook handler processes synchronously and returns. At higher scale, decouple with a job queue so the webhook returns immediately and a worker picks up the job.
2. **Second bottleneck: Concurrent uploads.** Supabase Storage handles this well. The concern is concurrent processing jobs. A single FastAPI instance can handle one job at a time if processing is synchronous. Add workers when this becomes limiting.

## Anti-Patterns

### Anti-Pattern 1: Frontend Calling FastAPI Directly

**What people do:** Expose FastAPI with CORS, have the frontend call it directly for file processing, manage separate auth tokens.
**Why it's wrong:** Doubles auth complexity (Supabase JWT + FastAPI auth). CORS configuration headaches. Frontend needs to know backend URL (environment-specific). Two sources of truth for user identity.
**Do this instead:** Use Supabase as the communication bus. Frontend only talks to Supabase. Backend only talks to Supabase. They never talk to each other directly.

### Anti-Pattern 2: Processing Files in Next.js API Routes

**What people do:** Upload files to a Next.js API route, try to process CSV/Excel there with JavaScript.
**Why it's wrong:** Vercel serverless functions have 10-second timeout (Hobby) or 60-second timeout (Pro). No pandas/numpy/scipy available. JavaScript CSV processing is significantly worse than Python for statistical analysis. Memory limits on serverless.
**Do this instead:** Upload directly to Supabase Storage from the browser. All processing happens in Python/FastAPI on a long-running server (not serverless).

### Anti-Pattern 3: Using Celery for MVP

**What people do:** Set up Celery + Redis + worker processes from day one for "production-ready" async processing.
**Why it's wrong:** Massive infrastructure overhead for a solo developer MVP. Celery requires Redis/RabbitMQ broker, separate worker process, monitoring (Flower), error handling configuration. At MVP scale (< 100 users), jobs can be processed synchronously in the webhook handler.
**Do this instead:** Start with synchronous processing in the FastAPI webhook handler. The job is already "async" from the user's perspective (they don't wait for it -- they get notified via Realtime). Add a proper queue (ARQ or RQ, not Celery) only when concurrent processing becomes a bottleneck.

### Anti-Pattern 4: Storing Validation Results Only in Files

**What people do:** Generate a report file and only store the file, not structured results in the database.
**Why it's wrong:** Can't filter, search, or display individual flags in the UI. Can't compute statistics across jobs. Can't build a dashboard showing trends.
**Do this instead:** Store structured results (individual flags, statistics) in the database AND generate downloadable report files. The database enables the UI; the files enable downloads.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Supabase Auth | Client SDK in browser, `@supabase/ssr` for Next.js middleware | Use `createServerClient` in Server Components, `createBrowserClient` in Client Components |
| Supabase Storage | Direct browser upload via client SDK, backend access via service role | Set bucket policies; max 50MB upload limit via Supabase dashboard |
| Supabase Realtime | Channel subscription on `jobs` table filtered by `user_id` | Use `postgres_changes` event type; subscribe in a Client Component `useEffect` |
| Supabase DB Webhooks | Configure in Supabase dashboard: INSERT on `jobs` table -> POST to FastAPI URL | Include a shared secret for webhook signature verification |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Frontend <-> Supabase | Supabase JS client SDK (REST + WebSocket) | All auth, data, and storage operations |
| Supabase -> FastAPI | HTTP webhook (POST with JSON payload) | One-way trigger; FastAPI verifies webhook signature |
| FastAPI -> Supabase | Supabase Python client (supabase-py) with service role key | Backend reads files, writes results, updates job status |

## Suggested Build Order

Based on component dependencies, the recommended build sequence is:

1. **Supabase Setup + Auth** (no dependencies) -- Database schema, RLS policies, Auth configuration, Storage buckets. Everything else depends on this.
2. **Next.js Shell + Auth Pages** (depends on #1) -- Login, register, password reset. Protected route layout. Supabase client integration.
3. **Project/Job Management UI** (depends on #2) -- CRUD for projects and jobs. File upload to Supabase Storage. Job list with status display.
4. **FastAPI Processing Service** (depends on #1) -- Ingest pipeline, validation engine, anomaly detection. Connect to Supabase via service role. Can be developed and tested independently against DB.
5. **Webhook Integration** (depends on #3 + #4) -- Wire up Supabase DB webhook to trigger FastAPI on job creation. This is the glue between frontend and backend.
6. **Realtime Status + Results UI** (depends on #5) -- Supabase Realtime subscription for job status. Results viewer with flag details, statistics, download links.
7. **Validation Profiles** (depends on #4 + #6) -- Profile editor UI. Rule configuration stored in DB. Template profiles for common survey types.
8. **Report Generation + Downloads** (depends on #4 + #6) -- GC report format, anomaly report, cleaned dataset export. Signed download URLs.

**Build order rationale:** Auth and database schema are foundational -- everything reads/writes to Supabase. The frontend shell and backend processing service can be developed in parallel (items 2-3 and item 4) since they communicate only through Supabase, not directly. The webhook (item 5) is the integration point that should be wired up once both sides work independently. Profiles and reports are features that layer on top of working end-to-end flow.

## Sources

- [Vercel Next.js + FastAPI Starter Template](https://vercel.com/templates/next.js/nextjs-fastapi-starter)
- [FastAPI Background Tasks Documentation](https://fastapi.tiangolo.com/tutorial/background-tasks/)
- [Supabase Realtime with Next.js](https://supabase.com/docs/guides/realtime/realtime-with-nextjs)
- [Supabase Database Webhooks](https://supabase.com/docs/guides/database/webhooks)
- [Supabase Edge Functions Background Tasks](https://supabase.com/docs/guides/functions/background-tasks)
- [FastAPI and Celery Architecture](https://testdriven.io/blog/fastapi-and-celery/)
- [Managing Background Tasks in FastAPI: BackgroundTasks vs ARQ](https://davidmuraya.com/blog/fastapi-background-tasks-arq-vs-built-in/)
- [Job Queue Pattern with Supabase](https://www.jigz.dev/blogs/how-i-solved-background-jobs-using-supabase-tables-and-edge-functions)
- [Building Real-time Notifications with Supabase and Next.js](https://makerkit.dev/blog/tutorials/real-time-notifications-supabase-nextjs)
- [Data Quality Assurance Components](https://www.montecarlodata.com/blog-data-quality-assurance/)
- [Deploying FastAPI and Next.js to Vercel](https://nemanjamitic.com/blog/2026-02-22-vercel-deploy-fastapi-nextjs)

---
*Architecture research for: Survey data QA & validation platform*
*Researched: 2026-03-10*
