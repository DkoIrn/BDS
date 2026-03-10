# Project Research Summary

**Project:** SurveyQC AI -- Pipeline & Seabed Survey Data QA Platform
**Domain:** Vertical SaaS -- Survey Data Quality Assurance (Pipeline/Seabed Engineering)
**Researched:** 2026-03-10
**Confidence:** HIGH

## Executive Summary

SurveyQC AI is a vertical SaaS platform that replaces the manual Excel-based QC workflow used by small survey companies to validate post-processed pipeline and seabed survey data. The real competitor is not EIVA or VisualSoft (those are $10K-50K+ desktop tools for vessel-side acquisition); the real competitor is an engineer spending hours checking spreadsheets with conditional formatting. The product accepts CSV/Excel deliverables, runs configurable validation rules and statistical anomaly detection, produces explainable flags with plain-English reasoning, and generates downloadable QC and GC reports. The core differentiator is explainability -- every flag tells the engineer exactly what failed, where, and why.

The recommended architecture is a two-service split: Next.js on Vercel for the frontend (UI, auth flows, Supabase client calls) and FastAPI on Railway for compute-heavy processing (parsing, validation, anomaly detection, report generation). Supabase serves as the communication bus between them -- the frontend never calls FastAPI directly. Files upload from the browser straight to Supabase Storage, a database webhook triggers FastAPI, and results flow back through Supabase with real-time status updates via Postgres Changes subscriptions. This eliminates CORS complexity, centralizes auth, and lets both services scale independently.

The primary risks are: (1) routing file uploads through Vercel serverless (hard 4.5MB body limit, strict timeouts -- must upload directly to Supabase Storage from day one), (2) pandas memory blowup on large files (50MB CSV can expand to 500MB in RAM -- must use chunked processing from the start), and (3) building a rigid validation engine with hardcoded rules (every new client would require code changes -- rules must be data-driven and configurable from Phase 3). A lesser but real risk is using `getSession()` instead of `getUser()` for server-side auth checks, which creates a security hole. All of these are avoidable with correct initial design decisions.

## Key Findings

### Recommended Stack

The stack splits cleanly into a TypeScript frontend and Python backend, connected through Supabase as the shared data layer. All recommended versions are verified against current releases and confirmed compatible.

**Core technologies:**
- **Next.js 16.x** (Vercel): App Router with Server Components for data-heavy pages, Turbopack dev server, native Tailwind CSS v4 support
- **FastAPI 0.135.x** (Railway): Async-native Python API with auto-generated OpenAPI docs, Pydantic v2 validation
- **Supabase** (managed): Auth + PostgreSQL + Object Storage + Realtime in one platform; Row-Level Security for multi-tenant isolation
- **pandas 3.x + numpy + scipy**: Core data processing and statistical analysis for validation and anomaly detection
- **Celery 5.6.x + Redis 7.x**: Task queue for async file processing (defer to later -- start with synchronous processing or DB-based queue for MVP)
- **shadcn/ui + TanStack Table + Recharts**: UI components, data grid for results, charts for QC dashboards
- **WeasyPrint 63.x**: HTML/CSS-to-PDF for GC report generation

**Critical version notes:** pandas 3.x requires Python >=3.11. @supabase/supabase-js requires Node.js >=20. @supabase/auth-helpers is deprecated -- use @supabase/ssr. Tailwind CSS v4 uses CSS-first config (no tailwind.config.js).

### Expected Features

**Must have (table stakes -- P1):**
- File upload (CSV/Excel, 50MB cap) with async processing and status updates
- Column auto-detection and mapping (KP, DOB, DOC, TOP, easting, northing)
- Configurable validation rules with default profiles per survey type (DOB, DOC, TOP)
- Core checks: range/tolerance, missing data, duplicates, monotonicity/sequence
- Statistical anomaly detection (z-score, IQR, rolling window)
- Explainable flags with plain-English reasoning on every issue
- Results dashboard with issue summary grouped by severity
- Downloadable QC report (PDF) and cleaned/annotated dataset (CSV/Excel)
- Project/job hierarchy for organizing datasets
- User authentication (email/password via Supabase Auth)

**Should have (differentiators -- P2, add after validation):**
- Cross-dataset consistency checks (e.g., DOB vs event listings)
- GC report auto-generation (replaces hours of manual report writing -- primary sales hook)
- KP-referenced profile visualization (engineers think in KP, not row numbers)
- Validation profile library (save, clone, share across projects)
- Batch file upload per job
- Custom user-defined validation rules

**Defer (v2+):**
- AI-powered natural language QC summaries and suggested corrections
- API access for pipeline integration
- Team management and RBAC
- Advanced format support (LAS, shapefiles), coordinate transformations

**Anti-features (do not build):**
- Raw sensor data processing (stay in "post-processed deliverables" lane)
- GIS/mapping visualization (use KP profile plots instead)
- Built-in data editing (flag issues, don't become a spreadsheet)
- Real-time vessel integration (completely different product)

### Architecture Approach

Two-service architecture with Supabase as the communication bus. The frontend (Next.js on Vercel) handles UI and auth; the backend (FastAPI on Railway) handles all data processing. They communicate exclusively through Supabase -- never directly. File processing follows a layered pipeline pattern: ingest -> validate -> detect anomalies -> generate report, with status updates at each stage boundary. Validation rules are stored as configurable JSON in the database, not hardcoded.

**Major components:**
1. **Next.js App** (Vercel) -- Auth pages, dashboard, upload/results UI, Supabase client SDK for all data operations
2. **Supabase Platform** (managed) -- Auth, PostgreSQL (projects, jobs, profiles, results), Object Storage (uploaded files, generated reports), Realtime (job status push), Database Webhooks (trigger processing)
3. **FastAPI Processing Service** (Railway) -- Ingest pipeline (parse CSV/Excel, normalize), validation engine (configurable rules), anomaly detector (statistical methods), report generator (QC/GC PDF reports)

**Key architectural decisions:**
- Upload files directly from browser to Supabase Storage (never through Vercel)
- Frontend inserts job row in DB; webhook triggers FastAPI; results written back to DB
- FastAPI uses Supabase service role key (bypasses RLS) for backend operations
- Start with synchronous processing in webhook handler for MVP; add task queue when concurrency demands it

### Critical Pitfalls

1. **Vercel serverless cannot process files** -- 4.5MB body limit, 10s timeout on free tier. Upload directly to Supabase Storage from the browser. Must be correct from day one.
2. **Pandas memory explosion on real files** -- 50MB CSV expands to 200-500MB in RAM. Use `chunksize`, `usecols`, explicit `dtype` from the start. Never rely on pandas auto-inference for survey data.
3. **Real-world survey data is messy** -- mixed encodings, inconsistent delimiters, BOM characters, text in numeric fields, varying column names across clients. Build a robust ingestion/normalization layer before validation rules.
4. **Validation rules must be data-driven, not hardcoded** -- hardcoded rules mean every new client requires code changes. Design configurable rule profiles as database records from Phase 3. Recovery cost is HIGH if done wrong.
5. **`getSession()` vs `getUser()` security hole** -- `getSession()` does not revalidate tokens server-side. Use `getUser()` in all middleware and server-side auth checks. Low recovery cost but must be correct from initial auth setup.
6. **RLS performance on high-volume tables** -- validation results tables can have thousands of rows per job. Index all RLS columns, wrap `auth.uid()` in subselect, use service role for writes.

## Implications for Roadmap

Based on combined research, the project breaks naturally into 6 phases following the dependency chain identified in ARCHITECTURE.md and FEATURES.md.

### Phase 1: Foundation (Supabase + Auth + Next.js Shell)
**Rationale:** Everything depends on the database schema, auth, and storage configuration. The architecture research is clear: Supabase is the shared backbone. Get this right first.
**Delivers:** Working auth flow (register, login, password reset), database schema with RLS policies, storage buckets, protected route layout with navigation shell.
**Addresses:** User authentication, project/job hierarchy (DB schema)
**Avoids:** Pitfall 3 (getSession vs getUser -- set auth pattern correctly from day one), Pitfall 7 (RLS performance -- design indexes into initial schema)
**Stack elements:** Next.js 16.x, @supabase/ssr, Supabase Auth/DB/Storage, shadcn/ui, Tailwind CSS v4

### Phase 2: File Upload and Processing Pipeline
**Rationale:** The upload-to-results pipeline is the core product loop. Architecture research shows frontend and backend can be developed in parallel since they communicate only through Supabase, but the integration (webhook) must work before building features on top.
**Delivers:** File upload from browser to Supabase Storage, FastAPI processing service with ingest pipeline, column auto-detection, webhook trigger on job creation, basic processing status updates via Realtime.
**Addresses:** File upload, column auto-detection, async processing with status
**Avoids:** Pitfall 1 (Vercel upload routing), Pitfall 2 (BackgroundTasks -- use synchronous processing or DB queue for MVP), Pitfall 4 (pandas memory -- implement chunked processing from start), Pitfall 5 (data messiness -- build robust ingestion layer)
**Stack elements:** FastAPI, pandas 3.x, openpyxl, Supabase Storage/Webhooks/Realtime, chardet/charset-normalizer

### Phase 3: Validation Engine and Anomaly Detection
**Rationale:** This is the core product value. The validation engine architecture (configurable rules as data, explainable flags) is the single most important design decision. PITFALLS.md rates hardcoded rules as HIGH recovery cost if done wrong.
**Delivers:** Configurable validation rule engine, default profiles for DOB/DOC/TOP surveys, core checks (range, missing data, duplicates, monotonicity), statistical anomaly detection (z-score, IQR), explainable flag generation with full context.
**Addresses:** Validation rules, range/tolerance checks, missing data detection, duplicate detection, monotonicity/sequence checks, anomaly detection, explainable flags
**Avoids:** Pitfall 6 (rigid/opaque rules -- data-driven from the start, every flag must include row, column, expected, actual, explanation)
**Stack elements:** pandas, numpy, scipy, Pydantic v2 (rule schemas)

### Phase 4: Results Dashboard and QC Reports
**Rationale:** With processing and validation working end-to-end, build the user-facing results experience. The dashboard data model must exist before GC reports (per FEATURES.md dependency analysis).
**Delivers:** Results dashboard with issue list grouped by severity, summary statistics, downloadable QC report (PDF), downloadable cleaned/annotated dataset (CSV/Excel).
**Addresses:** Results dashboard, QC report generation, cleaned dataset export
**Avoids:** Pitfall 7 (RLS performance on results tables -- verify query performance with realistic data volumes)
**Stack elements:** TanStack Table, Recharts, WeasyPrint, xlsxwriter

### Phase 5: Profiles, Visualization, and Polish
**Rationale:** These are high-value differentiators that layer on top of the working core. Validation profile library and KP visualization are P2 features that dramatically improve repeat-use experience and engineer workflow.
**Delivers:** Validation profile library (save, clone, share), KP-referenced profile visualization, custom validation rule creation, file preview before processing, false positive acknowledgment.
**Addresses:** Validation profile library, KP visualization, custom rules, UX improvements from PITFALLS.md
**Stack elements:** Recharts (KP plots), React Hook Form + Zod (rule builder UI)

### Phase 6: Advanced Features (Cross-Dataset, GC Reports, Batch)
**Rationale:** Cross-dataset checks and GC report generation are the highest-value P2 features but also the highest complexity. They require batch file upload (multiple files per job) which changes the processing model. GC report generation is the primary sales hook but requires all prior phases to be solid.
**Delivers:** Batch file upload, cross-dataset consistency checks, GC report auto-generation, subscription tier gating.
**Addresses:** Cross-dataset consistency, GC reports, batch processing, subscription tiers
**Stack elements:** Celery + Redis (likely needed for batch processing complexity), WeasyPrint (GC report templates)

### Phase Ordering Rationale

- **Phase 1 before everything:** Auth and database schema are foundational. Every subsequent phase reads/writes Supabase.
- **Phase 2 before Phase 3:** The validation engine needs the ingestion pipeline to provide normalized DataFrames. Building validation rules without a working file parser is building on air.
- **Phase 3 before Phase 4:** The dashboard displays validation results. The results must exist before the display layer.
- **Phase 4 before Phase 5:** Profile management and KP visualization enhance the core experience. The core must work first.
- **Phase 6 last:** Cross-dataset checks and GC reports are the most complex features and depend on everything before them. They also have the highest business value -- ship them when the foundation is proven.
- **Parallel opportunity:** Within Phase 2, the Next.js upload UI and FastAPI processing service can be developed in parallel since they communicate only through Supabase.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (File Processing):** The ingestion layer for handling real-world survey data messiness (encoding detection, delimiter detection, column mapping heuristics) is domain-specific and sparsely documented. Needs sample data from real survey companies to validate approach.
- **Phase 3 (Validation Engine):** The rule engine architecture (data-driven, configurable, explainable) is the core product. Worth researching existing validation framework patterns (Great Expectations, Pandera) for inspiration, though they are too generic to use directly.
- **Phase 6 (GC Reports):** Industry-standard GC report format is domain knowledge not well documented publicly. May need reference reports from actual survey companies to replicate expected layout.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** Supabase + Next.js auth is extremely well documented. Follow official @supabase/ssr guide.
- **Phase 4 (Dashboard/Reports):** Standard data display patterns with TanStack Table and Recharts. WeasyPrint HTML-to-PDF is well documented.
- **Phase 5 (Profiles/Visualization):** Standard CRUD + charting. No novel patterns needed.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified against current releases. Compatibility matrix confirmed. Well-established ecosystem. |
| Features | MEDIUM-HIGH | Feature landscape based on domain analysis and competitor research. Anti-features clearly identified. MVP scope is well-defined. Gap: no direct user validation yet. |
| Architecture | HIGH | Two-service split with Supabase as communication bus is a well-documented pattern. Build order aligns with component dependencies. Scaling path is clear. |
| Pitfalls | HIGH (stack), MEDIUM (domain) | Stack-level pitfalls (Vercel limits, pandas memory, auth) are well-documented with clear prevention. Domain-specific pitfalls (survey data messiness, rule engine design) need validation with real data. |

**Overall confidence:** HIGH

### Gaps to Address

- **Real survey data samples:** All file processing and validation logic should be tested against actual survey data exports, not synthetic data. Obtain sample files from at least 2-3 different survey software packages (EIVA, QPS, Trimble exports) during Phase 2 development.
- **GC report format specification:** The industry-standard GC report layout is not well documented publicly. Need a reference GC report from a real survey company to replicate expected format in Phase 6.
- **Task queue timing:** The architecture research recommends starting with synchronous processing and adding a queue later, while the stack research recommends Celery from the start. Recommendation: start synchronous for MVP simplicity (Architecture's anti-pattern 3 is correct), add ARQ or Celery in Phase 6 when batch processing demands it.
- **Subscription tier pricing/limits:** Feature research identifies tier gating but no pricing research was done. Defer pricing decisions until after MVP user feedback.
- **WeasyPrint on Railway:** WeasyPrint has system-level dependencies (Cairo, Pango, GDK-Pixbuf) that need to be available in the Docker image. Verify Railway Docker deployment handles these during Phase 4.

## Sources

### Primary (HIGH confidence)
- Next.js 16.x release notes -- version and feature verification
- FastAPI 0.135.x PyPI -- version and Pydantic v2 compatibility
- Supabase official docs -- Auth SSR, Storage, Realtime, Webhooks, RLS
- pandas 3.0 release notes -- Python version requirements, PyArrow default
- Celery 5.6.x PyPI -- version and Redis compatibility
- Supabase RLS performance guide -- optimization patterns

### Secondary (MEDIUM confidence)
- Railway FastAPI deployment guide -- hosting pattern
- WeasyPrint documentation -- HTML-to-PDF approach
- React Hook Form + Zod integration guide -- version compatibility
- EIVA/VisualSoft/Coda Octopus product pages -- competitor analysis
- Hydro International survey QC article -- domain pain points

### Tertiary (needs validation)
- GC report format expectations -- based on domain inference, not verified samples
- Survey data file format variations -- based on general knowledge, needs real data validation
- Concurrent processing thresholds -- performance claims need load testing

---
*Research completed: 2026-03-10*
*Ready for roadmap: yes*
