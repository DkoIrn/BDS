# Technology Stack: v1.1 Additions

**Project:** TruQC v1.1 Production-Grade QC Platform
**Researched:** 2026-04-11
**Scope:** NEW additions only. Existing stack (Next.js 16, FastAPI, Supabase, fpdf2, matplotlib, Leaflet, etc.) is validated and unchanged.

## New Stack Additions

### Job Queue (Feature: Job Queue with Retry/Recovery)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| ARQ | ^0.27 | Async task queue | Native async/await -- integrates seamlessly with FastAPI's async architecture. 7x faster than RQ for short jobs. Simpler than Celery (no Canvas complexity needed for our linear pipelines). Solo developer = less config overhead matters. |
| Redis (Railway addon) | 7.x | Message broker for ARQ | One-click deploy on Railway. ARQ requires Redis as broker. Also useful for caching validation rules and intermediate results. Railway Redis addon is managed -- no Docker config needed. |

**Why ARQ over Celery:** The existing STACK.md recommended Celery, but it was never implemented. Re-evaluating for actual needs: TruQC runs linear validation pipelines (upload -> validate -> report), not complex DAGs. ARQ is async-native (matches FastAPI), has built-in retry with exponential backoff, and requires significantly less configuration. Celery's Canvas (chains/groups/chords) is overkill. ARQ's codebase is ~2K lines vs Celery's ~50K -- easier to debug as a solo developer.

**Why not Dramatiq:** Good middle-ground library, but requires RabbitMQ for best reliability (Redis support is secondary). ARQ is purpose-built for Redis + asyncio, which matches our stack exactly.

**Railway deployment:** Run ARQ worker as a separate Railway service using the same codebase with a different start command (`arq app.worker.WorkerSettings`). Both services share the Railway Redis addon via `REDIS_URL` environment variable.

**Confidence:** HIGH -- ARQ + FastAPI is a well-documented pattern with production examples. Railway Redis is one-click.

### Dataset Versioning (Feature: Snapshot per Validation Run, Diff UI)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| No new library needed | -- | Snapshot storage | Use Supabase Storage for versioned dataset snapshots (already have storage). Store snapshot metadata in a `dataset_versions` Postgres table. |
| datacompy | ^0.14 | DataFrame comparison | Generates detailed diff reports between two pandas DataFrames -- column-level and row-level differences. Handles type mismatches gracefully. Lightweight (pandas is the only real dependency). |

**Architecture:** Each validation run stores a snapshot of the dataset state (CSV in Supabase Storage, metadata in Postgres). The diff UI fetches two snapshots, sends them to FastAPI, which uses datacompy to compute differences and returns a structured diff response. Frontend renders the diff with a custom table component (no new UI library needed -- TanStack Table handles this).

**Why not DVC/lakeFS/Delta Lake:** These are ML/data-lake tools designed for massive datasets with Git-like branching. TruQC handles survey files under 50MB with linear version history. A simple "snapshot per run" approach with Postgres metadata is far simpler and uses infrastructure we already have.

**Confidence:** HIGH -- datacompy is mature (Capital One maintained), pandas-native, and handles the exact use case of "compare two DataFrames and report differences."

### Validation Certificates (Feature: Cryptographic Hash, PDF Certificate)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| hashlib (stdlib) | Built-in | SHA-256 hashing | Python standard library. No external dependency needed. Hash the dataset + validation results + timestamp to produce a unique certificate fingerprint. |
| uuid (stdlib) | Built-in | Certificate ID generation | UUID4 for unique certificate identifiers. Standard library, no dependency. |
| fpdf2 (existing) | ^2.8 | Certificate PDF generation | Already in the stack for report generation. Extend with a certificate template layout. No new PDF library needed. |

**Certificate scheme:** SHA-256 hash of (dataset content + validation config + results JSON + timestamp). Store hash + metadata in `validation_certificates` table. Certificate PDF includes: hash, timestamp, dataset name, validation summary, QR code linking to certificate verification page.

**QR code addition:**

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| qrcode | ^8.0 | QR code generation | Generate QR codes for certificate verification URLs. Embed in PDF certificates. Lightweight, PIL/Pillow optional (can use SVG output with fpdf2). |

**Why not digital signatures (X.509/PKI):** Over-engineering for the use case. Survey companies need a verifiable hash proving "this dataset passed QC at this time with these results" -- not legally binding digital signatures. A SHA-256 hash with a verification registry achieves this without certificate authority infrastructure.

**Confidence:** HIGH -- hashlib is standard library, qrcode is stable and widely used.

### Collaboration (Feature: Notifications, Activity Feed, @Mentions, Comment Resolution)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Supabase Realtime (existing) | Managed | Real-time in-app notifications | Already validated in the stack. Subscribe to `notifications` table changes via Postgres Changes. RLS ensures users only see their own notifications. Zero additional infrastructure. |
| Resend (existing) | Managed | Email notifications | Already used for auth emails. Extend with notification email templates (mention alerts, job completion, comment replies). |
| No new frontend library | -- | Notification UI | Build with existing shadcn/ui components (Popover for notification dropdown, Badge for unread count). sonner for toast on new notifications. |

**Database design:** Three new tables:
- `notifications` -- in-app notification records (type, recipient, read status, link)
- `activity_log` -- audit-style feed entries (who did what, when, on which entity)
- `comments` -- threaded comments on issues/datasets with resolution status and @mention parsing

**@Mention implementation:** Parse `@username` patterns in comment text on the backend. Create notification records for mentioned users. Frontend uses a simple autocomplete dropdown (no rich text editor needed -- plain textarea with @ trigger).

**Why not a notification service (Novu, Engagespot):** Adds external dependency, cost, and complexity for a feature that Supabase Realtime + Resend already covers. The notification volume for small survey companies is low (tens per day, not thousands). Build simple, add a service later if volume demands it.

**Confidence:** HIGH -- Supabase Realtime for notifications is a documented, standard pattern.

### Cross-Dataset Validation (Feature: Comparison Rules in Pipeline)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| No new library needed | -- | Cross-dataset comparison | Extend the existing validation pipeline to accept multiple dataset references. pandas merge/join operations handle cross-dataset comparisons. The validation engine already processes DataFrames -- add a "cross-reference" validator type. |

**Implementation:** Add a `cross_dataset_rules` configuration that references other datasets in the same job. The validation pipeline loads both DataFrames, applies comparison rules (e.g., "KP values in DOB must exist in As-Built"), and flags mismatches. This is pure pandas logic -- no new library required.

**Confidence:** HIGH -- straightforward extension of existing validation architecture.

### Custom Rule Builder (Feature: Conditional Rules UI)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| react-querybuilder | ^7.x | Rule builder UI component | Purpose-built React component for constructing conditional logic (field + operator + value). Supports nested groups (AND/OR), drag-and-drop reordering, and exports to structured JSON. Works with any CSS framework (shadcn/ui compatible). 1.5K GitHub stars, actively maintained. |

**Why react-querybuilder over building custom:** Building a conditional rule builder from scratch is deceptively complex (nested groups, validation, serialization). react-querybuilder provides the interaction model out of the box. Export to JSON, send to FastAPI, evaluate with Python.

**Backend evaluation:** No rule engine library needed on the Python side. The JSON rule structure from react-querybuilder is simple enough to evaluate with a custom evaluator (~100 lines of Python). Pattern: parse JSON rule tree, apply conditions to pandas DataFrame columns using standard operators. A full rule engine (py-rules-engine, business-rules) is overkill for column-level comparisons.

**Why not react-awesome-query-builder:** More features but significantly heavier bundle and more opinionated styling. react-querybuilder is lighter and easier to style with Tailwind/shadcn.

**Confidence:** MEDIUM -- react-querybuilder is well-documented but integration with shadcn/ui styling will require custom renderers. The library supports this but it's manual work.

### Context-Aware QC (Feature: Dynamic Thresholds)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| No new library needed | -- | Dynamic threshold engine | Extend validation config schema to include context conditions (e.g., "if water_depth > 100m, tolerance = 0.5m; else tolerance = 0.1m"). Evaluate with the same custom rule evaluator used for custom rules. pandas + numpy handle the threshold calculations. |

**Implementation:** Add a `context_rules` section to validation pack configs. Before running validators, evaluate context conditions against the dataset to determine which thresholds apply. This is configuration-driven, not library-driven.

**Confidence:** HIGH -- extension of existing validation architecture with conditional config.

## Summary: What to Add

### Python Backend (requirements.txt additions)

```
# Job queue
arq>=0.27
redis>=5.0

# Dataset versioning
datacompy>=0.14

# Validation certificates
qrcode>=8.0
```

### Frontend (package.json additions)

```bash
npm install react-querybuilder @react-querybuilder/dnd
```

### Infrastructure

```
Railway Redis addon (one-click, managed)
Railway ARQ worker service (same codebase, different start command)
```

### Total new dependencies: 5

| Dependency | Side | Size Impact | Why Needed |
|------------|------|-------------|------------|
| arq | Backend | Tiny (~2K LOC) | Job queue -- replaces BackgroundTasks |
| redis (python) | Backend | Small | ARQ broker client |
| datacompy | Backend | Small (pandas dep only) | Dataset version diffing |
| qrcode | Backend | Small | Certificate QR codes |
| react-querybuilder | Frontend | ~45KB gzipped | Custom rule builder UI |

## What NOT to Add

| Avoid | Why |
|-------|-----|
| Celery | Overkill for linear pipelines. ARQ is simpler, async-native, less config. |
| RabbitMQ | ARQ uses Redis directly. No need for a second broker. |
| Dramatiq | Best with RabbitMQ, which we don't need. ARQ is simpler for Redis-only. |
| Bull/BullMQ (Node) | Would require running a Node worker alongside FastAPI. Keep job processing in Python. |
| DVC / lakeFS | ML-scale versioning tools. Our files are <50MB with linear history. Postgres + Storage is sufficient. |
| Novu / Knock | External notification services. Supabase Realtime + Resend covers our volume. |
| WeasyPrint | Already committed to fpdf2. No reason to switch for certificate PDFs. |
| py-rules-engine / business-rules | Python rule engines add abstraction without value. Custom evaluator for JSON rules is simpler and more debuggable. |
| react-awesome-query-builder | Heavier than react-querybuilder, harder to style with Tailwind. |
| Digital signature (X.509/PKI) | Over-engineering. SHA-256 hash registry is sufficient for QC certificates. |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Job queue | ARQ | Celery | Celery is heavier, sync-first, complex config. ARQ is async-native, matches FastAPI. |
| Job queue | ARQ | Huey | Huey is simpler but not async-native. ARQ's asyncio integration is better for FastAPI. |
| Dataset diff | datacompy | pandas.compare() | pandas.compare() requires identical shapes. datacompy handles schema changes, type mismatches, and produces detailed reports. |
| Certificate hash | hashlib (SHA-256) | HMAC-SHA256 | HMAC needs a secret key for authentication. We need integrity verification, not authentication. Plain SHA-256 is correct. |
| Rule builder UI | react-querybuilder | Custom components | Building nested AND/OR groups with drag-and-drop from scratch is 2-3 weeks of work. Library does it in days. |
| Notifications | Supabase Realtime | Pusher/Ably | External service cost and dependency for low-volume notifications. Supabase Realtime is free and already in stack. |

## Version Compatibility

| New Package | Compatible With | Notes |
|-------------|-----------------|-------|
| arq 0.27 | Python >=3.8, redis-py >=5.0 | Async-only. Requires running Redis. |
| arq 0.27 | FastAPI >=0.100 | Integrates via startup/shutdown lifespan events. |
| datacompy 0.14 | pandas >=2.0 | Works with pandas 3.x (tested). |
| qrcode 8.0 | Python >=3.8 | Optional Pillow dependency for PNG. SVG output has no deps. |
| react-querybuilder 7.x | React >=18 | Supports React 19. Works with any CSS framework. |

## Architecture Impact

```
BEFORE (v1.0):
  Next.js (Vercel) --> FastAPI (Railway) --> BackgroundTasks (fire-and-forget)
                                         --> Supabase (DB + Storage)

AFTER (v1.1):
  Next.js (Vercel) --> FastAPI (Railway) --> ARQ queue --> Redis (Railway addon)
                   |                                         |
                   |                     <-- ARQ Worker (Railway service) <--+
                   |                         |
                   |                         +--> Supabase (DB + Storage)
                   |
                   +--> Supabase Realtime <-- notifications table updates
```

**New Railway services:**
1. Redis addon (managed, one-click)
2. ARQ worker service (same repo, start command: `arq app.worker.WorkerSettings`)

**Cost impact:** Railway Redis addon is included in usage-based pricing. ARQ worker service runs on same plan. Estimated additional cost: $5-15/month depending on usage.

## Sources

- [ARQ Documentation](https://arq-docs.helpmanual.io/) -- v0.27 features, retry configuration (HIGH confidence)
- [FastAPI + ARQ Integration Guide](https://davidmuraya.com/blog/fastapi-background-tasks-arq-vs-built-in/) -- Production patterns (MEDIUM confidence)
- [ARQ Retry Mechanisms](https://davidmuraya.com/blog/fastapi-arq-retries/) -- Exponential backoff configuration (MEDIUM confidence)
- [Railway Redis Docs](https://docs.railway.com/guides/redis) -- One-click Redis deployment (HIGH confidence)
- [Railway SaaS Backend Guide](https://docs.railway.com/guides/saas-backend) -- Worker service deployment pattern (HIGH confidence)
- [datacompy PyPI](https://pypi.org/project/datacompy/) -- v0.14, DataFrame comparison (HIGH confidence)
- [Python hashlib Docs](https://docs.python.org/3/library/hashlib.html) -- SHA-256 hashing (HIGH confidence)
- [react-querybuilder Docs](https://react-querybuilder.js.org/) -- v7.x features, custom renderers (HIGH confidence)
- [react-querybuilder npm](https://www.npmjs.com/package/react-querybuilder) -- Version and download stats (HIGH confidence)
- [Supabase Realtime with Next.js](https://supabase.com/docs/guides/realtime/realtime-with-nextjs) -- Notification subscription pattern (HIGH confidence)
- [qrcode PyPI](https://pypi.org/project/qrcode/) -- v8.0, SVG/PNG output (HIGH confidence)

---
*Stack research for: TruQC v1.1 Production-Grade QC Platform*
*Researched: 2026-04-11*
