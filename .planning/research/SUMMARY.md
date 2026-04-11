# Project Research Summary

**Project:** TruQC v1.1 Production-Grade QC Platform
**Domain:** Survey Data QA & Validation Platform (pipeline/seabed)
**Researched:** 2026-04-11
**Confidence:** HIGH

## Executive Summary

TruQC v1.1 evolves a working MVP into a production-grade, team-capable QC platform for small survey and engineering companies. The existing stack (Next.js/FastAPI/Supabase/Railway) is well-validated and requires no core changes -- all v1.1 work is additive. Research confirms that five new dependencies cover the full feature set: procrastinate for job queuing, datacompy for dataset diffing, qrcode for certificates, react-querybuilder for the custom rule builder UI, and hmac (stdlib) for tamper-evident certificates. Infrastructure cost increase is minimal to zero: the PostgreSQL-backed procrastinate queue uses the existing Supabase DB with no new services required.

The recommended build order is layered: reliability infrastructure (job queue, dataset versioning) must come before workflow features (certificates, collaboration, cross-dataset validation), which must come before differentiation features (custom rule builder, context-aware QC). This order is driven by hard dependency chains -- certificates require versioning snapshots, notifications require a stable job completion event, and the custom rule builder condition schema is shared by context-aware QC. Skipping ahead in this sequence creates rework.

The highest-risk area is the job queue migration from BackgroundTasks. This change touches the core validation pipeline and must be done with a feature flag and parallel code paths to avoid downtime. The second critical risk is cryptographic correctness of validation certificates -- a bare SHA-256 hash is forgeable; HMAC-SHA256 with a server-side secret is required from the first certificate issued. Both risks are well-mitigated by the pitfalls research and are solvable within the v1.1 timeline with a solo developer.

---

## Key Findings

### Recommended Stack

The existing v1.0 stack requires no changes. V1.1 adds five targeted dependencies with no architectural overhaul. The key infrastructure decision is job queue technology: the architecture research recommends procrastinate (PostgreSQL-backed, zero new infrastructure) while the stack research recommends arq + Railway Redis. The pitfalls research decisively tips the balance toward procrastinate -- Redis adds $15-30/month, ops burden, and OOM risk that are disproportionate for a solo developer at current scale. Graduate to Redis only when PostgreSQL polling creates measurable latency.

**Core technology additions:**
- `procrastinate ^1.x`: Async PostgreSQL job queue -- no new infrastructure, uses existing Supabase DB, built-in retry/backoff, job visibility via standard SQL
- `datacompy ^0.14`: DataFrame comparison for version diffing -- pandas-native, handles schema changes and type mismatches, Capital One maintained
- `qrcode ^8.0`: QR code generation for certificate PDFs -- lightweight, SVG output requires no Pillow dependency
- `react-querybuilder ^7.x`: Custom rule builder UI -- nested AND/OR groups, JSON export, shadcn/ui compatible with custom renderers
- `hashlib` + `hmac` (stdlib): Certificate hash generation -- HMAC-SHA256 with server secret, zero external dependency

**What NOT to add:** Redis/ARQ, Celery, DVC/lakeFS, Novu/Knock, X.509 digital signatures, py-rules-engine, react-awesome-query-builder. All are over-engineering relative to actual requirements.

### Expected Features

**Must have (table stakes):**
- Job queue with retry/recovery -- production data platforms require resilient async processing; fire-and-forget is a prototype pattern
- In-app notifications (bell icon, unread count) -- users expect to know when validation completes without refreshing
- Email notifications on failures and @mentions -- Resend already configured, low-complexity addition
- Comment resolution (resolved/unresolved toggle, filter) -- basic comments exist; production requires closure tracking

**Should have (differentiators):**
- Dataset versioning with diff UI -- unique in vertical QC tools; proves fixes worked between validation runs
- Validation certificates with cryptographic hash -- replaces informal sign-off workflows with verifiable proof; no survey QC tool offers this
- Cross-dataset validation rules -- pipeline data (DOB, DOC, position) must cross-validate; no competitor does this automatically
- Custom conditional rule builder -- captures domain knowledge beyond predefined rules; IF/THEN with 3 rule types, hard-capped complexity
- Context-aware QC with dynamic thresholds -- event-conditional rules that reduce false positives in complex pipeline environments

**Defer to v1.2:**
- AI-generated validation rules (no training data yet)
- Notification digest emails and granular per-event preferences
- Automatic context detection from data patterns (ML-based)
- Rule templates marketplace
- Blockchain-backed certificates (HMAC-SHA256 is sufficient)

### Architecture Approach

All seven features integrate with the existing architecture rather than replacing it. The central change is swapping BackgroundTasks for a procrastinate job queue, which unlocks reliable execution for all downstream features. Dataset versioning hooks into job completion. Certificates extend fpdf2 report generation with a new template and a validation_certificates registry table. Collaboration wires into existing Supabase Realtime and Resend infrastructure with three new tables (notifications, activity_feed, and issue_comments columns). Cross-dataset validation extends run_validation_pipeline() with an optional reference_df parameter. Custom rules and context-aware QC run as final pipeline stages with self-contained evaluators.

**Major new components:**
1. `backend/app/tasks.py` -- procrastinate app, task definitions; replaces inline BackgroundTasks
2. `backend/app/validators/cross_dataset.py` -- cross-dataset validation checks (KP continuity, column matching, alignment)
3. `backend/app/validators/custom_rules.py` -- custom rule interpreter/engine (evaluates JSON rule definitions against DataFrames)
4. `backend/app/services/notifications.py` -- notification dispatch (in-app + email, with priority queuing)
5. `backend/app/services/certificates.py` -- HMAC-SHA256 hash generation, certificate PDF template

**New database tables (6):** dataset_versions, validation_certificates, notifications, activity_feed, custom_rules, context_rules. Plus procrastinate auto-managed tables. Five existing columns added across validation_runs and issue_comments.

### Critical Pitfalls

1. **Redis adds disproportionate ops burden for solo dev** -- Use PostgreSQL-backed procrastinate queue instead of ARQ + Redis. No new infrastructure, zero cost increase, handles 100+ users without modification.
2. **Certificate hash is forgeable without HMAC** -- Use HMAC-SHA256(server_secret, payload) not SHA256(payload). A bare hash lets anyone with the same file forge a certificate. Cannot be patched retroactively.
3. **Dataset versioning storage costs explode silently** -- Enforce retention policy (max 5-10 versions per dataset) from day one. Create synthetic v0 for existing datasets without copying files. Compute diffs server-side, never send full dataset to browser.
4. **Custom rule builder scope-creeps into a DSL** -- Hard cap: 3 rule types (threshold, column comparison, null check), no nested AND/OR, no arithmetic expressions, max 20 rules per profile. Never eval() user input.
5. **Notification spam kills collaboration adoption** -- Default all notifications to OFF except direct @mentions. Batch email sends (5-minute window), rate limit to 10 emails/user/hour. Resend quota contention can delay transactional emails (OTP, password reset).

---

## Implications for Roadmap

Based on combined research, the v1.1 feature set maps cleanly to three sequential layers with seven phases.

### Phase 1: Job Queue Infrastructure
**Rationale:** The single highest-risk change in v1.1 (replaces core processing mechanism) and the dependency for everything else. Do it first, use a feature flag, keep BackgroundTasks as fallback for two weeks post-launch.
**Delivers:** Reliable async processing with retry/backoff, job status visibility, idempotent validation runs
**Addresses:** Table stakes -- production data platforms require resilient processing
**Avoids:** Railway worker OOM (procrastinate/PostgreSQL, not Redis), duplicate execution during deploys (idempotency keys), big-bang migration risk (feature flag + parallel code paths)

### Phase 2: Dataset Versioning
**Rationale:** Unlocks certificates (requires content hash + version_id) and the diff UI. Storage strategy is a write-once architectural decision that must be made before any versioned data is written.
**Delivers:** Immutable snapshot per validation run, version timeline UI, server-side diff computation via datacompy
**Addresses:** Differentiator -- unique in vertical QC tools; proves fixes worked between runs
**Avoids:** Storage cost explosion (retention policy + diffs-not-full-copies from day one), existing data migration trap (synthetic v0, no file copying), browser freeze on large diffs (server-side pandas)

### Phase 3: Validation Certificates
**Rationale:** Contained addition once versioning is live. Focused scope: hash generation + PDF template + registry table + public verification page. High customer value, medium effort.
**Delivers:** Tamper-evident QC certificate PDF with QR code, public /verify/{hash} endpoint, certificate registry
**Addresses:** Differentiator -- no survey QC tool offers verifiable certificates
**Avoids:** Forgeable certificates (HMAC-SHA256 with server secret), PDF digital signatures (QR code + verification endpoint is the correct approach for this scale)

### Phase 4: Collaboration Suite
**Rationale:** Independently buildable -- no dependency on versioning or certificates. Benefits from stable job queue for completion events. Wires into existing Supabase Realtime and Resend.
**Delivers:** Notification bell with unread count, email notifications, comment resolution, activity feed, @mentions
**Addresses:** Table stakes -- users expect async status updates and team communication
**Avoids:** Notification spam (defaults OFF, 5-min batch window, rate limiting), Resend quota contention (separate transactional vs informational queues), activity feed bloat (90-day retention, cursor pagination)

### Phase 5: Cross-Dataset Validation
**Rationale:** Extends validation pipeline with multi-dataset context. Requires job queue stability (multi-dataset jobs are more complex) and careful changes to run_validation_pipeline() signature.
**Delivers:** KP continuity checks, column value matching, spatial alignment between paired datasets; results in dedicated results table
**Addresses:** Differentiator -- no competitor cross-validates pipeline datasets automatically
**Avoids:** Memory explosion (pair-only comparison, 80MB combined limit), O(n^2) complexity (explicit pairs only), issue attribution ambiguity (separate cross_validation_results table)

### Phase 6: Custom Rule Builder
**Rationale:** New subsystem (custom_rules table + JSON evaluator + react-querybuilder UI). Self-contained except for hooking into end of run_validation_pipeline(). The UI is the most complex frontend work in v1.1.
**Delivers:** Visual IF/THEN rule builder, 3 rule types, JSON-backed evaluator, per-org rule library, preview matches testing
**Addresses:** Differentiator -- captures domain knowledge that predefined rules cannot
**Avoids:** DSL scope creep (3 types max, no nesting, no arithmetic, max 20 rules), eval() on user input (JSON schema evaluated by custom Python), UI complexity (react-querybuilder handles nested groups; shadcn integration needs custom renderers)

### Phase 7: Context-Aware QC
**Rationale:** Most architecturally invasive change to the validation pipeline (modifies config resolution for every validator). Benefits from custom rule builder completion (shared conditional logic patterns). Build last.
**Delivers:** KP-range and event-type threshold overrides, segment-based evaluation (not per-row), context rule editor UI
**Addresses:** Differentiator -- reduces false positives in complex pipeline environments
**Avoids:** Combinatorial config explosion (ONE context mechanism: column value only, max 3 groups), per-row O(n) overhead (pre-segment DataFrame), context conflicts (multi-match = explicit error, always default fallback)

### Phase Ordering Rationale

- Phase 1 to Phase 2 to Phase 3 is a hard dependency chain that cannot be reordered.
- Phases 4-7 are independently buildable after Phase 1 but the research-suggested order puts low-risk/high-visibility collaboration before high-complexity differentiation work.
- The two highest-risk items (queue migration, HMAC certificate design) appear in Phases 1 and 3 -- early enough to have recovery time before complex differentiation work.
- Each phase adds one clearly bounded subsystem. No phase composes across multiple new subsystems simultaneously (critical for solo developer at 46,700 LOC).
- Total estimated effort: 12-18 weeks solo developer across all phases.

### Research Flags

Phases needing deeper research during planning:
- **Phase 5 (Cross-Dataset Validation):** Multi-dataset job orchestration with procrastinate; validate that multi-step jobs (download primary + download reference + run combined pipeline) are handled cleanly before writing the full plan.
- **Phase 6 (Custom Rule Builder):** react-querybuilder + shadcn/ui integration requires a 1-2 hour prototype spike before committing to the approach. Custom renderers are required but are manual work.

Phases with standard patterns (skip research-phase):
- **Phase 1:** procrastinate + FastAPI documentation is comprehensive, pattern is well-documented
- **Phase 2:** Snapshot + datacompy pattern is clear; storage strategy is decided
- **Phase 3:** hashlib/hmac are stdlib; fpdf2 extension follows existing report builder pattern
- **Phase 4:** Supabase Realtime + Resend pattern is documented and partially in use already
- **Phase 7:** Segment-based threshold override is a straightforward extension of existing validator config resolution

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All additions use official documentation or stdlib. react-querybuilder shadcn/ui custom renderer work is MEDIUM for that specific piece. |
| Features | HIGH | Scope and complexity estimates grounded in production data platform patterns. 10-14 week total effort estimate is realistic for solo developer. |
| Architecture | HIGH | Integration points map to specific existing codebase files with function signatures. procrastinate vs ARQ divergence between STACK and ARCHITECTURE is resolved by PITFALLS in favour of procrastinate. |
| Pitfalls | HIGH | Infrastructure pitfalls backed by Railway/Supabase official pricing docs. Certificate security pitfall is standard cryptographic principle. Custom rule builder scope creep is a well-documented anti-pattern. |

**Overall confidence:** HIGH

### Gaps to Address

- **procrastinate vs ARQ final decision:** STACK.md recommends ARQ; ARCHITECTURE.md recommends procrastinate; PITFALLS.md resolves in favour of procrastinate. Document this decision explicitly in Phase 1 plan so it is not revisited mid-implementation.
- **react-querybuilder + shadcn/ui styling:** Run a 1-2 hour prototype spike before Phase 6 planning to confirm the custom renderer approach is feasible within the effort estimate.
- **Existing dataset migration for versioning:** Creating synthetic v0 records for all existing datasets requires a migration script. Quantify the number of active datasets before writing the Phase 2 plan.
- **Resend plan limits:** Verify current Resend tier against projected notification volume before Phase 4 build. Resend rate limits affect transactional email (OTP, password reset) if informational emails saturate the quota.

---

## Sources

### Primary (HIGH confidence)
- [procrastinate documentation](https://procrastinate.readthedocs.io/) -- job queue, PostgreSQL-backed tasks, retry configuration
- [ARQ documentation](https://arq-docs.helpmanual.io/) -- async task queue, v0.27 features
- [Railway Redis docs](https://docs.railway.com/guides/redis) -- one-click deployment, pricing model
- [Railway SaaS backend guide](https://docs.railway.com/guides/saas-backend) -- worker service deployment pattern
- [Railway pricing](https://docs.railway.com/pricing) -- per-service cost model
- [datacompy PyPI](https://pypi.org/project/datacompy/) -- v0.14, DataFrame comparison
- [Python hashlib docs](https://docs.python.org/3/library/hashlib.html) -- SHA-256, HMAC
- [react-querybuilder docs](https://react-querybuilder.js.org/) -- v7.x, custom renderers
- [Supabase Realtime with Next.js](https://supabase.com/docs/guides/realtime/realtime-with-nextjs) -- notification subscription pattern
- [qrcode PyPI](https://pypi.org/project/qrcode/) -- v8.0, SVG/PNG output
- [Supabase Storage pricing](https://supabase.com/docs/guides/storage/pricing) -- egress cost model

### Secondary (MEDIUM confidence)
- [FastAPI BackgroundTasks vs ARQ vs Celery](https://davidmuraya.com/blog/fastapi-background-tasks-arq-vs-built-in/) -- production comparison, integration patterns
- [Retry patterns: exponential backoff, DLQ](https://dev.to/young_gao/retry-patterns-that-actually-work-exponential-backoff-jitter-and-dead-letter-queues-75) -- job queue design
- [Adaptive data quality thresholds (Acceldata)](https://www.acceldata.io/blog/adaptive-data-quality-thresholds-moving-beyond-static-rules) -- context-aware QC patterns
- [SaaS in-app notification feeds (SuprSend)](https://www.suprsend.com/post/what-are-in-app-notification-feeds-for-saas-products) -- notification UX
- [Best data versioning tools 2025 (Secoda)](https://www.secoda.co/blog/best-data-versioning-tools-2025) -- versioning strategy comparison
- [UI design for rule builders (Hagan Rivers)](https://medium.com/@hagan.rivers/ui-design-for-rule-builders-e3f218461954) -- rule builder UX patterns

### Tertiary (LOW confidence)
- Community blog posts on Railway worker graceful shutdown during deploys -- specific deploy overlap behaviour; validate during Phase 1 implementation

---
*Research completed: 2026-04-11*
*Ready for roadmap: yes*