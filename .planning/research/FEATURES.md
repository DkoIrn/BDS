# Feature Landscape: v1.1 Production-Grade QC Platform

**Domain:** AI Data QA & Validation Platform (pipeline/seabed survey)
**Researched:** 2026-04-11
**Mode:** Ecosystem -- how these 7 features work in production data platforms

---

## Table Stakes

Features users expect once a data platform moves past MVP. Missing any of these signals "not production-ready."

| Feature | Why Expected | Complexity | Dependencies on Existing |
|---------|-------------|------------|--------------------------|
| Job queue with retry/recovery | Every production data platform has resilient async processing. Fire-and-forget is acceptable for prototypes but users lose data and trust when jobs silently fail. | **Medium** | Replaces current fire-and-forget pipeline trigger in `pipeline-validation` route |
| In-app notifications | Users expect to know when their validation run completes, when someone comments, or when something fails -- without refreshing the page. | **Medium** | Extends existing `realtime-provider.tsx`, connects to comments system |
| Email notifications | Team leads need alerts for failures and completed runs when not actively in the app. Already using Resend for transactional email. | **Low** | Resend SMTP already configured |
| Comment resolution | Basic comments exist. Production collaboration requires marking issues as resolved, filtering by status, knowing what is still open. | **Low** | Extends existing `issue_comments` table and `comments.ts` actions |
| Activity feed | Audit trail exists but is for compliance. Activity feed is user-facing: "what happened recently on this project/job." | **Medium** | Reads from existing `audit_logs` table, surfaces as UI component |

## Differentiators

Features that set TruQC apart from generic data quality tools. Not expected, but create real competitive advantage in the survey/engineering niche.

| Feature | Value Proposition | Complexity | Dependencies on Existing |
|---------|-------------------|------------|--------------------------|
| Dataset versioning with diff UI | Engineers re-run QC after fixes. Seeing exactly what changed between Version 1 and Version 2 of a dataset proves the fixes worked. This is rare in vertical QC tools. | **High** | Builds on existing compare tool (`/api/compare`), needs snapshot storage per validation run |
| Validation certificates with hash | A QC Certificate PDF with a cryptographic hash that proves "this dataset passed these rules at this time" is unique in survey data. Replaces the informal "engineer signs off" workflow with verifiable proof. | **Medium** | Extends existing PDF report generation (fpdf2), needs certificate registry table |
| Cross-dataset validation rules | Pipeline data comes in multiple files (DOB, DOC, position data) that must agree with each other. No survey QC tool cross-validates between datasets automatically. | **High** | Extends existing compare tool from standalone to pipeline-integrated; needs cross-dataset rule definitions |
| Custom conditional rule builder | Letting engineers define "IF column A > X AND column B = Y THEN flag" without writing code captures domain knowledge that predefined rules cannot. | **High** | Extends existing validation profiles and threshold editor |
| Context-aware QC (dynamic thresholds) | A spike in water depth at 500m is normal in a trench; the same spike at 50m is an anomaly. Static thresholds produce false positives. Context-aware thresholds dramatically reduce noise. | **High** | Extends existing statistical validators, needs context metadata schema |
| @mentions in comments | Tagging a colleague on a specific issue accelerates review workflows. Useful but not critical for solo/small-team usage. | **Low-Medium** | Extends existing comments system, requires user lookup and notification trigger |

## Anti-Features

Features to explicitly NOT build in v1.1. These are scope traps that look valuable but destroy focus.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Full scripting engine for custom rules | Already in out-of-scope list. A visual rule builder covers 90% of use cases. A scripting engine invites security issues (sandboxing), support burden, and unbounded complexity. | Simple if/then conditional rule builder UI with predefined operators |
| Real-time collaborative editing of datasets | Massive engineering effort (CRDT/OT), not the core problem. Survey engineers do not co-edit spreadsheets in real-time. | Sequential workflow: one user cleans, others review via comments |
| AI-generated validation rules | Tempting but premature. The rule library is not large enough to train on, and "AI suggested this rule" without explainability undermines trust in a QC tool. | Let users build rules manually; gather usage data for future ML |
| Blockchain-backed certificates | Overkill. A SHA-256 hash stored in the database with a public verification endpoint provides equivalent tamper-evidence without blockchain complexity. | Cryptographic hash + verification URL on certificate PDF |
| WebSocket-based real-time dashboard | The existing Supabase Realtime subscription pattern is sufficient. Building a custom WebSocket layer for dashboard updates adds infrastructure for marginal UX gain. | Continue using Supabase Realtime for status updates |
| Notification preference center (granular) | Building per-channel, per-event-type notification preferences is a deep rabbit hole. At v1.1 scale, sensible defaults with a simple on/off toggle per category is enough. | Simple notification settings: on/off for email, always-on for in-app |

---

## Feature Deep Dives

### 1. Job Queue with Retry/Recovery

**How it works in production platforms:**
- Jobs are enqueued with metadata (dataset ID, user ID, validation profile, priority)
- Workers pull jobs and process them with heartbeat/progress reporting
- Failed jobs retry with exponential backoff (1s, 2s, 4s, 8s...) plus jitter to avoid thundering herd
- After 3-5 retries, jobs move to a dead letter queue (DLQ) for manual investigation
- All jobs are idempotent: retrying the same job does not create duplicate validation runs
- Admin UI shows queue depth, active jobs, failed jobs, retry history

**What TruQC needs specifically:**
- Replace fire-and-forget `fetch()` to FastAPI with a persistent queue
- Two viable approaches: (a) Supabase Queues (pgmq) with pg_cron polling, or (b) BullMQ + Redis on Railway
- Progress reporting back to the frontend (percentage, current stage)
- Failure visibility: users see "Job failed after 3 retries" not just a spinner that never resolves

**Table stakes elements:** Retry with backoff, failure visibility, job status tracking
**Differentiator elements:** Priority queues (enterprise jobs first), cancel/pause running jobs
**Complexity:** Medium -- the queue infrastructure is well-documented; the work is in making the existing pipeline idempotent and adding progress reporting

---

### 2. Dataset Versioning

**How it works in production platforms:**
- Each validation run creates an immutable snapshot of the dataset state
- Snapshots are stored efficiently (full copy for small datasets, delta/diff for large ones)
- Users can browse version history: "Version 1 (original) -> Version 2 (after auto-fix) -> Version 3 (after manual review)"
- Diff UI shows row-by-row and cell-by-cell changes between any two versions
- Versions link to their validation results, so you can see "in Version 1 there were 47 issues, in Version 2 there are 12"

**What TruQC needs specifically:**
- Snapshot the dataset content (CSV/parsed data) at each pipeline stage or validation run
- Store snapshots in Supabase Storage (JSON or compressed CSV)
- Version metadata in a `dataset_versions` table linking to validation run IDs
- Diff UI can extend the existing compare tool (currently standalone) to work on versions of the same dataset
- Version timeline component showing progression

**Table stakes elements:** Version history list, link versions to validation results
**Differentiator elements:** Visual diff UI with cell-level change highlighting, "regression detection" (new issues introduced between versions)
**Complexity:** High -- snapshot storage strategy matters at scale; diff computation on large datasets needs to happen server-side (FastAPI)

---

### 3. Validation Certificates

**How it works in production platforms:**
- After a dataset passes QC, the system generates a certificate PDF
- Certificate contains: dataset name, validation date, rules applied, pass/fail summary, unique hash
- The hash is computed from: dataset content + rules applied + timestamp + results
- A verification endpoint (`/verify/{hash}`) lets anyone confirm the certificate is genuine
- Some platforms include QR codes linking to the verification URL

**What TruQC needs specifically:**
- Certificate generation endpoint in FastAPI (extends existing PDF generation with fpdf2)
- SHA-256 hash of (dataset content hash + validation profile hash + results hash + timestamp)
- `validation_certificates` table storing hash, metadata, generation date
- Public verification page (no auth required) at `/verify/{hash}`
- QR code on the PDF linking to the verification URL
- SOQ (Seal of Quality) badge integration with existing report system

**Table stakes elements:** Certificate PDF with hash, verification endpoint
**Differentiator elements:** QR code, public registry, tamper-evident chain (hash includes previous certificate hash for same dataset)
**Complexity:** Medium -- the PDF generation capability exists; the new work is hash computation, registry table, and public verification page

---

### 4. Collaboration Suite (Notifications, Activity Feed, @Mentions, Comment Resolution)

**How it works in production platforms:**

**In-app notifications:**
- Notification center (bell icon) with unread count badge
- Categorized: validation complete, comment added, mention, failure alert
- Mark as read/unread, mark all as read
- Stored in a `notifications` table with `user_id`, `type`, `read`, `data` (JSONB)
- Delivered via Supabase Realtime subscription for instant updates

**Email notifications:**
- Triggered for: job failures, @mentions, daily/weekly digest
- Uses existing Resend integration
- Simple preference: email on/off per category (not granular per-event)

**Activity feed:**
- Project-scoped or job-scoped timeline of events
- "Daniel ran validation on Pipeline_DOB.csv" / "Sarah resolved 5 issues" / "Auto-fix applied to 12 rows"
- Sources from audit trail but presented as a user-friendly feed, not a compliance log

**@mentions:**
- In comment input, typing `@` triggers user autocomplete from org members
- Mentioned user receives in-app + email notification
- Mentions are stored as metadata in the comment (user IDs), rendered as styled chips

**Comment resolution:**
- Add `resolved` boolean and `resolved_by` to `issue_comments` or a separate resolution status on the issue itself
- Filter: "Show unresolved only" toggle
- Resolution count in issue triage view: "3/7 issues resolved"

**Table stakes elements:** In-app notifications with bell icon, email on job failure, comment resolution toggle
**Differentiator elements:** @mentions with autocomplete, activity feed with rich context, notification batching/digest
**Complexity:** Medium collectively -- each piece is straightforward, but the integration surface is wide (notifications touch every feature)

---

### 5. Cross-Dataset Validation Rules

**How it works in production platforms:**
- Define relationships between datasets: "Dataset A (DOB) column 'KP' must match Dataset B (position) column 'KP' within 0.1m tolerance"
- Cross-dataset rules run after individual dataset validation completes
- Results surface as a separate validation category: "Cross-Dataset Consistency"
- Common patterns: referential integrity (every ID in A exists in B), value consistency (same KP in both files should have same coordinates), temporal ordering (DOB date must precede DOC date for same pipeline segment)

**What TruQC needs specifically:**
- Integrate existing standalone compare tool into the validation pipeline
- New rule type: `cross_dataset` with source/target dataset references
- Cross-dataset rule definitions stored in validation profiles
- UI to select "compare columns" between two datasets in the same job
- Results appear in the standard issue triage view with a "Cross-Dataset" category
- Domain-specific presets: DOB vs DOC consistency, position vs event alignment

**Table stakes elements:** Column-to-column matching between datasets, tolerance-based comparison
**Differentiator elements:** Domain-specific cross-dataset rule packs (pipeline survey presets), automatic relationship detection
**Complexity:** High -- the compare endpoint exists but is standalone; integrating into the pipeline requires orchestrating multi-dataset validation runs and handling dataset pairing

---

### 6. Custom Conditional Rule Builder

**How it works in production platforms:**
- Visual UI with condition rows: `IF [column] [operator] [value] THEN [action]`
- Operators: equals, not equals, greater than, less than, contains, is empty, regex match
- Compound conditions: AND/OR grouping with nesting (max 2-3 levels deep)
- Actions: flag as error, flag as warning, set severity, custom message
- Rules are stored as JSON and evaluated server-side during validation
- "Test rule" button that runs the rule against current dataset and shows matches

**What TruQC needs specifically:**
- Rule builder UI component with drag-and-drop or form-based condition rows
- JSON schema for custom rules: `{ conditions: [...], action: {...}, logic: "AND"|"OR" }`
- Server-side rule evaluator in FastAPI that runs custom rules alongside built-in validators
- Integration with validation profiles: custom rules are part of a profile
- Column-aware: rule builder knows the columns in the dataset and offers autocomplete
- "Preview matches" feature to test before saving

**Table stakes elements:** IF/THEN with basic operators, AND/OR logic, save rules to profile
**Differentiator elements:** Column autocomplete from actual dataset, "preview matches" testing, rule templates library
**Complexity:** High -- the UI is the hardest part (building a good rule builder is notoriously tricky); the evaluation engine is relatively straightforward with a JSON rule schema

---

### 7. Context-Aware QC (Dynamic Thresholds)

**How it works in production platforms:**
- Instead of "flag if water depth change > 5m between rows," use "flag if water depth change > 2 standard deviations from the local rolling average"
- Context can be: geographic zone, data segment, time period, associated metadata
- Thresholds adapt based on the context: tighter in stable zones, looser in transition zones
- Event-conditional rules: "IF event type = 'trench crossing' THEN relax depth change thresholds"
- User-configurable: engineers define context boundaries and threshold modifiers

**What TruQC needs specifically:**
- Context metadata schema: define "zones" or "segments" with associated threshold modifiers
- Extend existing statistical validators to accept context-dependent thresholds
- Event-conditional rules: lookup event type for current row, apply matching threshold set
- UI for defining context rules: "When [context field] = [value], use [threshold set]"
- Fallback to default thresholds when no context match
- Integration with domain QC packs: pipeline-specific contexts pre-configured

**Table stakes elements:** Configurable thresholds per data segment/zone
**Differentiator elements:** Event-conditional rules (unique to survey domain), automatic context detection from data patterns
**Complexity:** High -- the statistical validators exist but need refactoring to accept dynamic thresholds; the context metadata schema needs careful design to be flexible without being overwhelming

---

## Feature Dependencies

```
Job Queue ──────────────────────┐
                                v
Dataset Versioning ───> Needs reliable job tracking (queue provides run IDs)
                                │
Validation Certificates ───> Needs versioned results (version provides snapshot hash)
                                │
Cross-Dataset Validation ───> Needs job queue for multi-dataset orchestration
                                │
Context-Aware QC ───> Needs custom rule builder foundation (shared rule schema)
                                │
Custom Rule Builder ───> Independent, but benefits from cross-dataset awareness
                                │
Collaboration Suite ───> Independent, but notifications wire into everything above
```

**Critical path:** Job Queue must come first. Dataset Versioning builds on it. Collaboration Suite is independently buildable but must wire into all other features for notifications.

## MVP Recommendation for v1.1

**Layer A -- Build First (reliability foundation):**
1. **Job queue with retry/recovery** -- Everything else depends on reliable processing
2. **Dataset versioning** -- Enables certificates and proves fixes work
3. **Comment resolution + in-app notifications** -- Quick wins from existing infrastructure

**Layer B -- Build Second (workflow depth):**
4. **Validation certificates** -- Requires versioning; high customer value, medium effort
5. **Cross-dataset validation** -- Requires job queue orchestration; high differentiation
6. **Activity feed + email notifications + @mentions** -- Completes collaboration suite

**Layer C -- Build Third (differentiation):**
7. **Custom conditional rule builder** -- High effort but unique value
8. **Context-aware QC** -- Highest complexity; benefits from rule builder foundation

**Defer to v1.2:** Automatic context detection (ML-based), notification digest emails, rule templates marketplace

## Complexity Budget (Solo Developer Estimate)

| Feature | Estimated Effort | Risk |
|---------|-----------------|------|
| Job queue with retry/recovery | 1-2 weeks | Low -- well-documented patterns |
| Dataset versioning with diff UI | 2-3 weeks | Medium -- storage strategy decisions |
| Validation certificates | 1 week | Low -- extends existing PDF generation |
| Comment resolution | 2-3 days | Low -- extends existing comments |
| In-app notifications | 1 week | Low -- Supabase Realtime exists |
| Email notifications | 3-5 days | Low -- Resend already configured |
| Activity feed | 3-5 days | Low -- reads from audit trail |
| @mentions | 3-5 days | Low -- autocomplete + notification trigger |
| Cross-dataset validation | 2-3 weeks | High -- orchestration complexity |
| Custom rule builder | 2-3 weeks | High -- UI complexity |
| Context-aware QC | 2-3 weeks | High -- validator refactoring |

**Total estimated: 10-14 weeks** for a solo developer across all features.

## Sources

- [Retry Patterns: Exponential Backoff, Jitter, and DLQs](https://dev.to/young_gao/retry-patterns-that-actually-work-exponential-backoff-jitter-and-dead-letter-queues-75)
- [BullMQ: Production-Grade Job Queues for Node.js](https://dev.to/whoffagents/bullmq-production-grade-job-queues-for-nodejs-1bhk)
- [Supabase Queues Documentation](https://supabase.com/docs/guides/queues)
- [Supabase Edge Functions: Background Tasks](https://supabase.com/docs/guides/functions/background-tasks)
- [Adaptive Data Quality Thresholds](https://www.acceldata.io/blog/adaptive-data-quality-thresholds-moving-beyond-static-rules)
- [Microsoft Purview Data Quality Thresholds](https://techcommunity.microsoft.com/blog/microsoft-security-blog/microsoft-purview-data-quality-thresholds-more-control-more-trust/4506546)
- [Data Quality Rules for 2026](https://atlan.com/know/data-quality-rules/)
- [SaaS In-App Notification Feeds](https://www.suprsend.com/post/what-are-in-app-notification-feeds-for-saas-products)
- [Building Collaborative SaaS Apps with Notifications](https://www.magicbell.com/blog/building-collaborative-and-productive-saas-applications-with-notifications)
- [Visual Rule Builder (Feathery)](https://docs.feathery.io/platform/build-forms/advanced-logic/visual-rule-builder)
- [DataFlowMapper Logic Builder](https://dataflowmapper.com/blog/dataflowmapper-logic-builder-guide)
- [CDQ Data Quality Rules](https://www.cdq.com/platform/data-quality-rules)
- [Certificate Generator with QR Verification](https://github.com/Saqib-Hussain-07/Certificate-Generator)
- [Best Data Versioning Tools 2025](https://www.secoda.co/blog/best-data-versioning-tools-2025)
