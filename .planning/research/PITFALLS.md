# Domain Pitfalls: v1.1 Feature Integration

**Domain:** Adding production reliability, workflow depth, and differentiation features to existing TruQC platform
**Researched:** 2026-04-11
**Confidence:** HIGH (infrastructure/Railway); MEDIUM (domain-specific integration)

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or infrastructure instability.

---

### Pitfall 1: Railway Worker Service Adds Permanent Infrastructure Cost and Ops Burden

**What goes wrong:**
Adding a persistent job queue (Redis + worker) on Railway means spinning up 2 new always-on services: a Redis instance and a worker process. This is not a one-time setup cost -- it is a permanent monthly bill increase ($15-30/month for Redis + worker memory) and a permanent ops surface. Redis needs memory monitoring. Workers need graceful shutdown handling during deploys. If Redis runs out of memory, jobs are silently lost unless persistence (AOF/RDB) is explicitly enabled.

**Why it happens:**
Developers see "add a queue" as a simple architectural improvement. They underestimate that Railway charges per-resource-second -- a worker sitting idle still costs money. They also miss that Railway deploys overlap old and new containers, causing race conditions where both old and new workers consume tasks simultaneously.

**Consequences:**
- Jobs processed twice during deploys (duplicate validation runs, duplicate notifications)
- Jobs lost on Redis OOM if persistence not configured
- Monthly costs jump $15-30 with no way to scale to zero
- Worker crashes at 2am with no alerting go unnoticed for days (solo developer)

**Prevention:**
1. Start with Supabase-native queue pattern: use a `job_queue` PostgreSQL table with `status` column and `FOR UPDATE SKIP LOCKED` queries. FastAPI polls this table. Zero new infrastructure.
2. Only graduate to Redis + worker when PostgreSQL polling creates measurable latency (likely >100 concurrent jobs).
3. If Redis is used, enable `appendonly yes` persistence from day one.
4. Set Railway memory alerts on Redis service.
5. Implement idempotency keys on all job handlers to survive duplicate execution.

**Detection:**
- Any architecture diagram showing Redis as a new service
- Worker service with no health check endpoint
- No `appendonly` in Redis config
- No idempotency handling in job processors

**Phase to address:** Layer A (Reliability) -- first feature to implement, but use PostgreSQL queue first.

---

### Pitfall 2: Dataset Versioning Storage Costs Explode Silently

**What goes wrong:**
Naively storing a full copy of the dataset for every validation run creates storage multiplication. A 30MB CSV validated 10 times = 300MB. Across 50 active projects with 5 datasets each = 75GB of versioned snapshots. Supabase Storage charges $0.021/GB for egress, and storage itself accumulates. Worse, existing datasets need migration -- you cannot retroactively create "version 1" snapshots without downloading and re-uploading every existing file.

**Why it happens:**
Full-copy versioning is the simplest implementation. Developers think "storage is cheap" without modeling actual costs. They also forget about the migration problem: existing datasets have no version history, and users will expect to see their history.

**Consequences:**
- Storage costs grow linearly with usage (no ceiling)
- Migration of existing datasets is a one-time heavy operation
- Version diff UI becomes slow on large datasets (diffing two 30MB CSVs in-browser is brutal)
- Supabase egress costs spike when users download old versions

**Prevention:**
1. Store diffs, not full copies. After each validation run, store only the rows that changed (a JSON patch or CSV diff). Reconstruct old versions on demand.
2. If full copies are necessary for simplicity, implement a retention policy from day one: keep last 5 versions, auto-delete older ones.
3. For existing data migration: create a synthetic "v0" record that points to the current file -- do NOT copy files. Only start versioning forward from the migration point.
4. Do diff computation server-side in Python (pandas), never in the browser.
5. Set a storage budget alert in Supabase dashboard.

**Detection:**
- `supabase.storage.upload()` called on every validation run with no cleanup
- No `retention_policy` or `max_versions` configuration
- Diff UI fetching full datasets client-side
- No migration plan for existing datasets

**Phase to address:** Layer A (Reliability) -- implement alongside job queue, but storage strategy must be decided before any versioned data is written.

---

### Pitfall 3: Validation Certificate Hash Is Trivially Forgeable Without Server-Side Secret

**What goes wrong:**
Generating a "certificate hash" using only the dataset content (e.g., `SHA256(csv_content)`) means anyone with the same file can generate the same hash. The certificate proves nothing -- a user could modify data, re-hash it, and claim the new hash is the valid certificate. This is not a certificate; it is a checksum.

**Why it happens:**
Developers conflate checksums (integrity verification) with certificates (attestation of authenticity). A real certificate needs to prove that THIS platform, at THIS time, validated THIS data and found THESE results. A bare hash proves none of that.

**Consequences:**
- Certificates are meaningless -- anyone can forge them
- If clients rely on certificates for compliance, the platform's credibility is destroyed
- Legal liability if certificates are presented as proof of QC and later found to be forgeable

**Prevention:**
1. Hash the certificate payload (dataset hash + validation results + timestamp + certificate ID) with an HMAC using a server-side secret key stored in Railway environment variables. `HMAC-SHA256(secret, payload)` -- not just `SHA256(payload)`.
2. Store every issued certificate in a `certificates` table with the hash, timestamp, dataset_id, validation_run_id, and results summary.
3. Build a public verification endpoint: `/verify/{certificate_id}` that looks up the stored hash and compares it. This is the actual tamper detection.
4. Do NOT use MD5 or SHA-1 -- use SHA-256 minimum.
5. Include a timestamp from the server (not client) in the hash payload.
6. Do NOT attempt digital signatures with private keys unless you have HSM infrastructure -- HMAC + server verification is the right complexity level for a solo developer.

**Detection:**
- Hash generation using only file content
- No server-side secret in the HMAC
- No `certificates` database table
- No verification endpoint
- Client-side hash generation

**Phase to address:** Layer B (Workflow Depth) -- must be designed correctly before any certificate is issued. Cannot be patched retroactively.

---

### Pitfall 4: Custom Rule Builder Becomes a Turing-Complete Nightmare

**What goes wrong:**
The rule builder starts simple ("if column A > 100, flag it") but scope creeps into nested conditionals, cross-column references, regex matching, arithmetic expressions, and eventually users ask for loops or aggregations. You end up building a programming language with a GUI, which is unmaintainable for a solo developer and unusable for engineer-users who are not programmers.

**Why it happens:**
Every "just one more operator" request seems reasonable in isolation. Without a hard complexity ceiling, the rule engine grows into a DSL (domain-specific language) that needs its own parser, validator, type checker, and error reporter.

**Consequences:**
- Months of development on the rule engine instead of QC features
- Users create rules they don't understand and blame the platform for "wrong" results
- Rule execution performance degrades with complex nested logic
- Every new rule operator requires frontend UI + backend evaluator + validation + tests = 4x multiplier
- Rules become unmaintainable -- no one remembers what `IF (A > B * 0.95) AND (C != "N/A" OR D IS NULL) THEN ...` was supposed to check

**Prevention:**
1. Hard cap at 3 rule types for v1.1: threshold check (`column > value`), comparison (`column_A == column_B`), and null check (`column IS NOT NULL`). That is it.
2. No nested AND/OR -- each rule is a single condition. Multiple rules on a column are implicitly AND.
3. No arithmetic expressions in conditions. No regex. No aggregations.
4. Store rules as structured JSON, not as expression strings. Never `eval()` user input.
5. Pre-validate rules against the dataset schema before execution -- if column "KP" doesn't exist, reject at creation time.
6. Cap at 20 custom rules per validation profile. Engineering users don't need 100 rules; they need 5-10 good ones.

**Detection:**
- Rule schema supporting arbitrary nesting depth
- Expression parser in the codebase
- `eval()` or `exec()` anywhere near user-defined rules
- No rule count limits
- UI with drag-and-drop rule nesting

**Phase to address:** Layer C (Differentiation) -- last to implement. Start with templates that users can parameterize, not a blank canvas.

---

## Moderate Pitfalls

Mistakes that cause significant rework or degraded UX but are recoverable.

---

### Pitfall 5: Notification Spam Destroys Collaboration Feature Adoption

**What goes wrong:**
Adding notifications for every action (comment added, issue resolved, dataset validated, status changed) floods users with emails and in-app notifications. Users disable all notifications within a week, making the entire collaboration feature useless. Activity feeds with unbounded queries become slow as the `activity_log` table grows.

**Why it happens:**
Developers implement notifications as a side effect of every action without considering frequency or relevance. They also build activity feeds as simple `SELECT * FROM activity WHERE org_id = X ORDER BY created_at DESC` queries, which degrade as the table grows past 100K rows.

**Prevention:**
1. Default all notifications to OFF except direct @mentions and assignment changes.
2. Implement notification batching: collect events for 5 minutes, send one digest email instead of 5 individual emails.
3. Rate limit: max 10 emails per user per hour, max 50 per day.
4. Activity feed: partition by time (only load last 7 days by default), paginate with cursor-based pagination (not OFFSET), add index on `(org_id, created_at DESC)`.
5. Use Supabase's built-in index advisor or `EXPLAIN ANALYZE` on activity queries before shipping.
6. @mention abuse: limit to 5 @mentions per comment. No @all or @channel.
7. Resend (your SMTP provider) has rate limits -- hitting them means ALL transactional emails (password resets, OTP) get delayed.

**Detection:**
- No notification preferences table
- `SELECT *` on activity tables without pagination
- No rate limiting on email sends
- @mentions with no count limit
- Resend API errors in logs

**Phase to address:** Layer B (Workflow Depth) -- notification preferences must ship WITH the notification system, not after complaints.

---

### Pitfall 6: Cross-Dataset Validation Creates O(n^2) Complexity

**What goes wrong:**
Cross-dataset validation (e.g., "KP values in dataset A should match dataset B") requires loading multiple datasets into memory simultaneously. With 5 datasets of 30MB each, that's 150MB in a single FastAPI worker. Worse, if users can select arbitrary dataset pairs, the number of possible comparisons grows quadratically. Performance becomes unpredictable and Railway worker memory limits get hit.

**Why it happens:**
Single-dataset validation is straightforward -- load one file, run checks, done. Cross-dataset validation fundamentally changes the memory model (multiple files) and the UX model (which datasets to compare?). Developers underestimate this architectural shift.

**Consequences:**
- Railway worker OOM kills on large cross-dataset comparisons
- Unclear UX: which datasets are being compared? What if one is updated?
- Validation results become hard to attribute: which dataset "owns" a cross-dataset issue?
- Exponential test matrix: 5 datasets = 10 possible pairs = 10x the validation surface

**Prevention:**
1. Limit cross-dataset validation to explicit pairs, not arbitrary N-to-N. User selects exactly 2 datasets to compare.
2. Do NOT load full datasets into memory. Use pandas chunked reading or SQL-based comparison if datasets are stored in DB tables.
3. Cross-dataset issues belong to the validation run, not to either dataset. Create a separate `cross_validation_results` table.
4. Set a hard limit: cross-dataset validation only works on datasets within the same survey job.
5. Only support 3 cross-dataset checks initially: KP continuity, column value matching, and row count comparison.
6. Memory guard: if combined dataset size exceeds 80MB, reject with a clear error message.

**Detection:**
- Loading multiple full DataFrames in the same function
- No memory limits on cross-validation endpoints
- UI allowing selection of arbitrary dataset combinations
- Cross-dataset issues stored in single-dataset results tables

**Phase to address:** Layer B (Workflow Depth) -- implement after single-dataset validation is rock solid.

---

### Pitfall 7: Context-Aware QC Over-Engineers Conditional Logic

**What goes wrong:**
"Dynamic thresholds by context" sounds straightforward but quickly becomes a combinatorial explosion. Example: "KP tolerance is 0.01m for straight pipe, 0.05m for bends, and 0.1m for risers" -- that is 3 contexts for 1 rule. Now multiply by 10 rules and 5 context types and you have 150 context-rule combinations to configure, test, and explain to users.

**Why it happens:**
The feature request sounds simple: "different thresholds for different situations." But "situations" are not well-defined in survey data. Is context determined by a column value? A metadata field? A spatial region? Each answer creates a different implementation path.

**Consequences:**
- UI becomes a configuration maze that engineers won't use
- Validation results become hard to explain: "This was flagged because context X applied threshold Y" requires showing the full context chain
- Testing surface explodes: every context-rule combination needs verification
- Context conflicts: what if row matches multiple contexts? Priority rules add another layer of complexity

**Prevention:**
1. Context is determined by ONE mechanism only: a column value. Not metadata, not spatial regions, not time ranges.
2. Maximum 3 context groups per rule (e.g., pipe type: straight/bend/riser).
3. Context values must be an exact match -- no ranges, no regex, no wildcards.
4. If a row matches no context, the default threshold applies (never skip validation).
5. If a row matches multiple contexts, it is an error that gets flagged -- do not silently pick one.
6. Ship this as an extension of existing rule packs, not as a new system. A rule pack already has thresholds; context-aware QC just allows threshold overrides per context value.

**Detection:**
- Context resolution logic exceeding 50 lines of code
- Multiple context sources (column + metadata + spatial)
- No default fallback behavior
- UI requiring more than 2 clicks to set a contextual threshold
- No conflict resolution strategy

**Phase to address:** Layer C (Differentiation) -- last feature, implement only after custom rule builder is stable.

---

## Minor Pitfalls

Issues that cause friction but are easy to fix.

---

### Pitfall 8: Migrating from BackgroundTasks to Queue Breaks Existing Processing Flow

**What goes wrong:**
The current codebase uses FastAPI `BackgroundTasks` for fire-and-forget validation (confirmed in `backend/app/routers/validation.py`). Migrating to a queue-based system requires changing how jobs are dispatched, how status is tracked, and how results are reported. If done as a big-bang migration, the system has no processing capability during the transition.

**Prevention:**
1. Run both systems in parallel during migration: new jobs go to the queue, old in-flight jobs finish via BackgroundTasks.
2. Add a feature flag: `USE_QUEUE=true/false` in environment variables.
3. Keep the `BackgroundTasks` code path as a fallback for 2 weeks after queue launch.
4. Ensure the queue handler calls the exact same `run_validation_background()` function -- do not rewrite processing logic during the queue migration.

---

### Pitfall 9: Certificate PDF Generation with fpdf2 Has No Built-In Security Features

**What goes wrong:**
TruQC already uses fpdf2 for report generation (confirmed in PROJECT.md key decisions). fpdf2 generates PDFs but has no built-in digital signature, encryption, or tamper-evidence capabilities. A certificate PDF is just a regular PDF that anyone can edit.

**Prevention:**
1. The certificate's authority comes from the verification endpoint, not the PDF itself. The PDF is a printable representation; the database record is the source of truth.
2. Include a QR code in the certificate PDF that links to `/verify/{certificate_id}` -- this is the tamper-detection mechanism.
3. Do NOT attempt to add PDF digital signatures with fpdf2 -- it doesn't support them, and implementing PKCS#7 signing is not a solo-developer task.

---

### Pitfall 10: Activity Feed Table Becomes the Largest Table in the Database

**What goes wrong:**
Every action creates an activity record. With 10 users making 50 actions/day each, that is 500 rows/day, 15K/month, 180K/year. The `activity_log` table quickly outgrows all other tables combined. Supabase's free tier has database size limits; Pro tier charges for excess.

**Prevention:**
1. Implement retention: auto-delete activity records older than 90 days via a scheduled function.
2. Only log meaningful actions (validation run, issue resolved, comment added) -- not navigation or page views.
3. Use `created_at` as a partition key or ensure a composite index on `(org_id, created_at DESC)`.
4. Consider archiving old activity to a separate `activity_archive` table or Supabase Storage as JSON dumps.

---

### Pitfall 11: Version Diff UI Performance on Large Datasets

**What goes wrong:**
Showing a diff between two versions of a 10,000-row dataset in the browser requires fetching, parsing, and comparing both versions client-side. This will freeze the browser tab.

**Prevention:**
1. Compute diffs server-side in Python and store the result.
2. Send only changed rows to the frontend, with context rows around them (like a git diff).
3. Paginate the diff view -- show 50 changed rows at a time.
4. Never fetch full dataset versions to the client for diffing.

---

## Integration Pitfalls (Cross-Feature)

These pitfalls emerge when multiple v1.1 features interact.

---

### Integration Pitfall 1: Queue + Versioning + Certificates Create a Transaction Dependency Chain

**What goes wrong:**
A validation run now needs to: (1) execute via queue, (2) create a version snapshot, (3) optionally generate a certificate. If step 2 fails after step 1 succeeds, you have a completed validation with no version record. If step 3 fails, you have a version but no certificate. Partial failures create inconsistent state.

**Prevention:**
1. Use database transactions: version snapshot and certificate creation happen in the same transaction as result storage.
2. The queue job's "success" status is only set AFTER all three steps complete.
3. If certificate generation fails, the validation still succeeds (certificates are optional) -- but log the failure visibly.
4. Add a `validation_runs` table that links job_id, version_id, and certificate_id as the single source of truth for a run.

---

### Integration Pitfall 2: Custom Rules + Context-Aware QC + Cross-Dataset = Combinatorial Explosion

**What goes wrong:**
A custom rule with context-aware thresholds running across two datasets creates a 3-dimensional configuration space that is impossible for users to reason about and extremely hard to test. "Compare column A in dataset 1 vs dataset 2, but only when pipe_type is 'bend' and threshold is 0.05m" -- this is a query, not a rule.

**Prevention:**
1. Cross-dataset validation does NOT support custom rules or context-aware thresholds. It uses only built-in comparison checks.
2. Custom rules only run on single datasets.
3. Context-aware QC only applies to rules within a single dataset's rule pack.
4. These three features must be kept as independent systems that do not compose.

---

### Integration Pitfall 3: Collaboration Notifications Trigger on Queue-Processed Events

**What goes wrong:**
When validation runs via the job queue, completion events fire asynchronously. If notifications are hooked to these events, a batch of 10 validation runs completing at once sends 10 notification emails in rapid succession. Resend rate limits (depending on plan) may throttle these, delaying password reset or OTP emails.

**Prevention:**
1. Queue completion notifications go through the same batching system as all other notifications.
2. Separate Resend sending into two priority queues: transactional (OTP, password reset) and informational (validation complete, comments). Transactional always sends first.
3. If Resend rate limit is approached, drop informational emails and show in-app only.

---

## Phase-Specific Warnings

| Phase/Layer | Feature | Likely Pitfall | Mitigation |
|-------------|---------|----------------|------------|
| Layer A | Job Queue | Redis adds cost + ops burden | Start with PostgreSQL queue table |
| Layer A | Job Queue | Duplicate execution during deploys | Idempotency keys on all handlers |
| Layer A | Dataset Versioning | Storage costs explode | Store diffs, not full copies; retention policy |
| Layer A | Dataset Versioning | Existing data has no version history | Synthetic v0 pointing to current file |
| Layer B | Certificates | Hash without HMAC is forgeable | HMAC-SHA256 with server secret |
| Layer B | Certificates | fpdf2 can't do digital signatures | QR code + verification endpoint instead |
| Layer B | Collaboration | Notification spam | Default OFF, batch emails, rate limit |
| Layer B | Collaboration | Activity feed table bloat | 90-day retention, cursor pagination |
| Layer B | Cross-Dataset | Memory explosion loading multiple files | Pair-only comparison, 80MB memory guard |
| Layer B | Cross-Dataset | Issue attribution ambiguity | Separate cross_validation_results table |
| Layer C | Custom Rules | Scope creep into DSL | Hard cap: 3 rule types, no nesting |
| Layer C | Custom Rules | User-created rules produce confusion | Pre-validate against schema, cap at 20 rules |
| Layer C | Context-Aware QC | Combinatorial config explosion | One context mechanism, max 3 groups |
| Layer C | Context-Aware QC | Context conflicts | Flag multi-match as error, always have default |
| Cross-Feature | Queue + Versioning + Certs | Partial failure inconsistency | Database transactions, linked validation_runs table |
| Cross-Feature | Custom + Context + Cross | Feature composition explosion | Keep all three as independent, non-composable systems |
| Cross-Feature | Queue + Notifications | Email rate limit contention | Priority queues for transactional vs informational |

---

## Solo Developer Survival Rules

These are meta-pitfalls specific to a one-person team at 46,700 LOC:

1. **The 50-line rule:** If any single feature's core logic exceeds 500 lines, you are over-engineering it. Each v1.1 feature should add 200-500 lines of backend code maximum.
2. **No new infrastructure unless PostgreSQL can't do it.** PostgreSQL can be a queue, an activity log, a version store, and a certificate registry. Do not add Redis, RabbitMQ, or any other service unless you have measured PostgreSQL being insufficient.
3. **Feature flags for everything.** Every v1.1 feature should be behind a flag so you can ship incrementally and disable broken features without reverting.
4. **Never compose new features.** Custom rules + context-aware + cross-dataset should be three independent features that never reference each other's code.
5. **Monitoring before features.** Before adding any v1.1 feature, add error tracking (Sentry free tier) and uptime monitoring. You cannot maintain 7 new features without knowing when they break.

---

## Sources

- [Railway: Cron Jobs, Workers, and Queues Guide](https://docs.railway.com/guides/cron-workers-queues)
- [Railway: Queues Blog Post](https://blog.railway.com/p/queues)
- [Railway: SaaS Backend with Workers Guide](https://docs.railway.com/guides/saas-backend)
- [Railway: Graceful Shutdown of Celery Workers](https://station.railway.com/questions/graceful-shutdown-of-celery-workers-duri-7445b567)
- [Railway Pricing](https://docs.railway.com/pricing)
- [Supabase Storage Pricing](https://supabase.com/docs/guides/storage/pricing)
- [Supabase Pricing Breakdown (Metacto)](https://www.metacto.com/blogs/the-true-cost-of-supabase-a-comprehensive-guide-to-pricing-integration-and-maintenance)
- [FastAPI Background Tasks: ARQ vs Built-in](https://davidmuraya.com/blog/fastapi-background-tasks-arq-vs-built-in/)
- [PDF Digital Signatures as Tamper Prevention (TextControl)](https://www.textcontrol.com/blog/2025/10/30/why-digitally-signing-your-pdfs-is-the-only-reliable-way-to-prevent-tampering/)
- [Tamper Evidence: Hashing, Seals, and Post-Sign Locking](https://legittai.com/blog/tamper-evidence-and-document-integrity-hashing-seals-and-post-sign-locking)
- [UI Design for Rule Builders (Hagan Rivers)](https://medium.com/@hagan.rivers/ui-design-for-rule-builders-e3f218461954)
- [Rules Engine Design Pattern (DevIQ)](https://deviq.com/design-patterns/rules-engine-pattern/)
- [PostgreSQL NOTIFY Documentation](https://www.postgresql.org/docs/current/sql-notify.html)
- [Railway November 2025 Incident Reports](https://blog.railway.com/p/incident-report-november-20-2025)
