# Stack Research

**Domain:** Survey Data QA & Validation Platform (Pipeline/Seabed)
**Researched:** 2026-03-10
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 16.x | Frontend framework | SSR/SSG support, native Vercel deployment, excellent Supabase integration via @supabase/ssr. App Router is stable and mature. Turbopack dev server is production-ready. |
| Python | 3.12 | Processing runtime | Best balance of package support and performance. 3.13 is viable but 3.12 has wider library compatibility. pandas 3.x requires >=3.11. |
| FastAPI | 0.135.x | Processing API | Async-native, automatic OpenAPI docs, Pydantic v2 validation, excellent performance. Now supports Starlette 1.0+. The standard for Python data processing APIs. |
| Supabase | (managed) | Auth, Database, Storage | Auth + Postgres + Storage in one platform. Row-Level Security for multi-tenant data isolation. Python client available for backend access. Eliminates need to manage separate auth, DB, and file storage services. |
| Celery | 5.6.x | Async task queue | Battle-tested for file processing workflows. Supports task chains (upload -> validate -> report). Redis as broker. Retry logic and failure handling built in. The standard for Python background processing. |
| Redis | 7.x | Message broker + cache | Broker for Celery, caching for validation rules and intermediate results. Lightweight, well-supported on all hosting platforms. |
| Vercel | (managed) | Frontend hosting | Zero-config Next.js deployment, edge functions, preview deployments. Natural pairing with Next.js. |
| Railway | (managed) | Backend hosting | Best option for FastAPI + Celery + Redis stack. Simple Docker deploys, built-in Redis addon, usage-based pricing suits a solo developer. Render is the alternative if Railway pricing becomes an issue. |

### Frontend Libraries

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| @supabase/supabase-js | ^2.98.0 | Supabase client | Isomorphic client for auth, DB queries, storage. Requires Node.js 20+. |
| @supabase/ssr | ^0.9.0 | SSR auth integration | Replaces deprecated auth-helpers. Cookie-based auth for Next.js App Router. Required for server components and middleware auth checks. |
| shadcn/ui | CLI v4 | Component library | Not a dependency -- copies components into your project. Radix UI primitives, Tailwind CSS styling. Full control over component code. Supports both Radix and Base UI. |
| Tailwind CSS | 4.x | Styling | Utility-first CSS, built into shadcn/ui workflow. v4 uses CSS-first configuration (no tailwind.config.js needed). |
| TanStack Table | ^8.x | Data grid | Headless table for displaying validation results, flagged issues, survey data. Sorting, filtering, pagination built in. Handles 10K+ rows with virtualization. |
| Recharts | ^2.15.x | Charts/visualization | Simple API for bar/line/pie charts showing QC statistics. SVG-based rendering sufficient for dashboard summary charts (not rendering 100K+ data points). |
| React Hook Form | ^7.71.x | Form handling | Validation rule builders, upload forms, profile settings. Uncontrolled components = excellent performance. |
| Zod | ^4.3.x | Schema validation | Shared validation schemas between forms and API. Type inference for TypeScript. zodResolver integrates with React Hook Form. |
| Zustand | ^5.x | Client state | Lightweight store for UI state (active project, selected job, filter state). 1KB bundle. No boilerplate. Sufficient for this app's state complexity -- no need for Redux. |
| @tanstack/react-query | ^5.x | Server state | Cache and sync server data (projects, jobs, results). Automatic refetching, optimistic updates, background refresh. Pairs with Supabase client calls. |
| sonner | ^2.x | Toast notifications | Accessible toast notifications for upload status, processing completion, errors. Works well with shadcn/ui. |
| lucide-react | latest | Icons | Default icon set for shadcn/ui. Consistent, tree-shakeable. |

### Backend Libraries (Python)

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| pandas | ^3.0.1 | Data processing | Core library for CSV/Excel parsing, data manipulation, statistical analysis. v3 has better string handling and PyArrow integration by default. |
| numpy | ^2.4.x | Numerical computing | Underlying array operations for pandas. Required for statistical calculations (z-scores, moving averages, standard deviations). |
| scipy | ^1.17.x | Statistical methods | scipy.stats for distribution tests, outlier detection (z-score, IQR). More rigorous statistical methods than numpy alone. |
| openpyxl | ^3.1.x | Excel reading | Read uploaded .xlsx files. pandas uses this as its Excel engine. Required dependency for `pd.read_excel()`. |
| xlsxwriter | ^3.2.x | Excel writing | Generate cleaned datasets and reports as formatted .xlsx files. Better performance than openpyxl for write-heavy operations. Used via `pd.ExcelWriter(engine='xlsxwriter')`. |
| weasyprint | ^63.x | PDF generation | Generate GC reports as PDF. HTML/CSS template approach -- faster development than ReportLab's programmatic API. Engineers can review reports in browser before PDF export. |
| pydantic | ^2.x | Data validation | Request/response models for FastAPI. Validation rule schemas. Integrated with FastAPI automatically. v2 is significantly faster than v1. |
| supabase-py | ^2.28.x | Supabase Python client | Backend access to Supabase Auth (verify tokens), Storage (download/upload files), and Database (store results). |
| celery | ^5.6.2 | Task queue | Async processing of uploaded files. Task chains: parse -> validate -> detect anomalies -> generate report. Retry logic for failures. |
| redis | ^5.x | Redis client | Celery broker connection. Also useful for caching validation profiles and intermediate results. |
| uvicorn | ^0.34.x | ASGI server | Production server for FastAPI. Use with `--workers` flag for multi-process deployment. |
| python-multipart | ^0.0.18 | File uploads | Required by FastAPI for handling multipart file uploads. |
| httpx | ^0.28.x | HTTP client | Async HTTP client for calling external APIs (future AI integration). Better than requests for async FastAPI apps. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| TypeScript | ^5.7.x | Type safety for frontend | Strict mode enabled. Catches data shape errors at compile time -- critical when working with survey data structures. |
| ESLint + Prettier | Latest | Code quality | Use Next.js default ESLint config. Prettier for formatting. |
| Ruff | Latest | Python linting/formatting | Replaces flake8, black, isort in one tool. Fast, opinionated. The standard Python linter in 2026. |
| pytest | ^8.x | Python testing | Test validation rules, anomaly detection logic, API endpoints. Use pytest-asyncio for async tests. |
| Docker Compose | Latest | Local dev environment | Run Redis, Celery worker, FastAPI together locally. Matches production topology. |
| Supabase CLI | Latest | Local Supabase dev | Local Postgres + Auth + Storage for development. Run `supabase init` and `supabase start`. |

## Installation

### Frontend (Next.js)

```bash
# Create Next.js project
npx create-next-app@latest surveyqc-frontend --typescript --tailwind --eslint --app --src-dir

# Core dependencies
npm install @supabase/supabase-js @supabase/ssr
npm install @tanstack/react-query @tanstack/react-table
npm install react-hook-form @hookform/resolvers zod
npm install zustand recharts sonner lucide-react

# Initialize shadcn/ui
npx shadcn@latest init

# Dev dependencies
npm install -D @types/node
```

### Backend (Python)

```bash
# Create virtual environment (use uv for speed)
pip install uv
uv venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows

# Core
uv pip install fastapi uvicorn[standard] python-multipart
uv pip install pandas openpyxl xlsxwriter
uv pip install numpy scipy
uv pip install pydantic
uv pip install supabase
uv pip install celery[redis] redis
uv pip install weasyprint
uv pip install httpx

# Dev dependencies
uv pip install pytest pytest-asyncio ruff
```

### Local Development Infrastructure

```yaml
# docker-compose.yml (Redis for Celery)
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Celery + Redis | FastAPI BackgroundTasks | Only for trivial tasks (<5s). No retry, no persistence, no monitoring. Not suitable for file processing. |
| Celery + Redis | Dramatiq | If you want simpler API than Celery and don't need Canvas (task chains/groups). Good option but less ecosystem support. |
| Celery + Redis | ARQ | If your entire backend is asyncio-native and tasks are I/O-bound only. Struggles under load in benchmarks. |
| Railway | Render | If you prefer flat-rate pricing over usage-based. Slightly more opinionated but good FastAPI support. |
| Railway | Fly.io | If you need global edge deployment or WebSocket support. Overkill for a processing backend. |
| Recharts | Nivo | If you need canvas rendering for very large chart datasets or want more pre-styled chart types. Worse documentation than Recharts. |
| Zustand | Jotai | If you need atomic, fine-grained reactivity. Zustand's centralized store is simpler for this app's needs. |
| WeasyPrint | ReportLab | If you need pixel-perfect financial-style layouts or extremely fast generation. WeasyPrint's HTML/CSS approach is faster to develop with. |
| pandas 3.x | Polars | If you need to process files >500MB or need maximum speed. Pandas is more familiar, has better Excel support, and 50MB file limit makes Polars unnecessary. |
| React Hook Form + Zod | Conform | If you want progressive enhancement and server-side validation. RHF + Zod is more established and better documented. |
| TanStack Table | AG Grid | If you need 100K+ rows with complex server-side operations. AG Grid Community is free but heavier. TanStack Table is sufficient for survey data tables. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| @supabase/auth-helpers-nextjs | Deprecated as of Jan 2026. No future updates. | @supabase/ssr ^0.9.0 |
| Redux / Redux Toolkit | Overkill for this app. 15KB bundle for state that Zustand handles in 1KB. | Zustand |
| Axios | Unnecessary -- fetch is built into Next.js and handles caching. httpx on Python side. | Native fetch (frontend), httpx (backend) |
| Flask | No async support, no automatic validation, no auto-generated API docs. | FastAPI |
| Django | Too heavy for a processing API. ORM unnecessary when using Supabase. | FastAPI |
| Tailwind CSS v3 config files | v4 uses CSS-first configuration. Don't create tailwind.config.js/ts. | Tailwind CSS v4 @theme directive |
| Create React App | Dead project. No SSR, no file-based routing. | Next.js |
| Material UI / Ant Design | Heavy, opinionated, hard to customize to brand colors. Bundle size concerns. | shadcn/ui + Tailwind |
| Prisma | Adds ORM complexity when Supabase client handles DB queries directly. Extra layer with no benefit here. | @supabase/supabase-js direct queries |
| python-dotenv | FastAPI/Pydantic has built-in Settings management via pydantic-settings. | pydantic-settings |

## Stack Patterns by Variant

**If processing jobs take >30 seconds (likely for large survey files):**
- Use Celery with Redis broker
- Frontend polls job status via Supabase Realtime or periodic API calls
- Store job status in Supabase `processing_jobs` table
- Because: BackgroundTasks won't survive server restarts, can't be monitored

**If you add AI/LLM analysis later:**
- Add `openai` or `anthropic` Python SDK to backend
- Process AI calls as Celery subtasks within the validation chain
- Because: LLM calls are slow and expensive -- need retry logic and rate limiting

**If you need real-time processing status updates:**
- Use Supabase Realtime subscriptions on the `processing_jobs` table
- Celery worker updates job status rows as processing progresses
- Because: Avoids polling, gives instant UI updates, Supabase Realtime is included free

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| pandas 3.0.x | Python >=3.11 | Dropped Python 3.10 support. Ensure Python 3.12. |
| pandas 3.0.x | openpyxl >=3.1.0 | Required for Excel read support. |
| pandas 3.0.x | xlsxwriter >=3.0.0 | Required for Excel write with xlsxwriter engine. |
| FastAPI 0.135.x | Pydantic >=2.0 | Pydantic v1 is no longer supported. |
| FastAPI 0.135.x | Starlette >=1.0.0 | Breaking change from pre-1.0 Starlette. |
| Celery 5.6.x | Python >=3.9 | Dropped Python 3.8. |
| Celery 5.6.x | Redis >=5.0 | Use redis-py ^5.x as client. |
| @supabase/supabase-js 2.98.x | Node.js >=20 | Dropped Node.js 18 in v2.79.0. |
| @supabase/ssr 0.9.x | @supabase/supabase-js ^2.x | Must use together. |
| shadcn/ui CLI v4 | Next.js 14+ | Works with App Router. Uses unified radix-ui package. |
| Tailwind CSS 4.x | Next.js 16.x | Native support. CSS-first config. |
| Zod 4.x | @hookform/resolvers ^5.x | zodResolver auto-detects Zod v3 vs v4. |

## Architecture Alignment

This stack supports a **two-service architecture**:

1. **Next.js on Vercel** -- Frontend + BFF (Backend-for-Frontend)
   - Serves UI, handles auth flows via @supabase/ssr
   - API routes proxy to FastAPI for file uploads
   - Direct Supabase client calls for CRUD (projects, jobs, results)

2. **FastAPI on Railway** -- Processing Service
   - Receives file upload triggers
   - Downloads files from Supabase Storage
   - Runs validation/anomaly detection via Celery workers
   - Writes results back to Supabase DB
   - Generates reports, uploads to Supabase Storage

This separation keeps the frontend lightweight and deployable on Vercel's free/hobby tier while the compute-heavy processing runs on Railway where you control resources.

## Sources

- [Next.js Releases](https://github.com/vercel/next.js/releases) -- Version 16.1.6 confirmed (HIGH confidence)
- [FastAPI PyPI](https://pypi.org/project/fastapi/) -- Version 0.135.1 confirmed (HIGH confidence)
- [pandas 3.0.0 Release Notes](https://pandas.pydata.org/docs/whatsnew/v3.0.0.html) -- v3.0.1 confirmed (HIGH confidence)
- [Celery PyPI](https://pypi.org/project/celery/) -- Version 5.6.2 confirmed (HIGH confidence)
- [Supabase JS npm](https://www.npmjs.com/package/@supabase/supabase-js) -- v2.98.0 confirmed (HIGH confidence)
- [@supabase/ssr npm](https://www.npmjs.com/package/@supabase/ssr) -- v0.9.0 confirmed (HIGH confidence)
- [supabase-py PyPI](https://pypi.org/project/supabase/) -- v2.28.0 confirmed (HIGH confidence)
- [Supabase SSR Auth Docs](https://supabase.com/docs/guides/auth/server-side/nextjs) -- Auth-helpers deprecated, use @supabase/ssr (HIGH confidence)
- [shadcn/ui Changelog](https://ui.shadcn.com/docs/changelog) -- CLI v4, unified Radix package (HIGH confidence)
- [NumPy Releases](https://github.com/numpy/numpy/releases) -- v2.4.2 confirmed (HIGH confidence)
- [SciPy PyPI](https://pypi.org/project/SciPy/) -- v1.17.0 confirmed (HIGH confidence)
- [React Hook Form + Zod Guide](https://dev.to/marufrahmanlive/react-hook-form-with-zod-complete-guide-for-2026-1em1) -- RHF 7.71.x, Zod 4.3.x confirmed (MEDIUM confidence)
- [Railway FastAPI Deploy Guide](https://docs.railway.com/guides/fastapi) -- Railway deployment pattern confirmed (MEDIUM confidence)
- [Celery + FastAPI Pattern](https://testdriven.io/blog/fastapi-and-celery/) -- Standard integration pattern (HIGH confidence)
- [WeasyPrint Docs](https://doc.courtbouillon.org/weasyprint/stable/) -- HTML-to-PDF approach (MEDIUM confidence)

---
*Stack research for: Survey Data QA & Validation Platform*
*Researched: 2026-03-10*
