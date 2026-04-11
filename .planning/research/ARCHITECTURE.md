# Architecture Patterns: v1.1 Feature Integration

**Domain:** Survey data QA & validation platform (pipeline/seabed survey)
**Researched:** 2026-04-11
**Focus:** How 7 new features integrate with existing Next.js/FastAPI/Supabase architecture

## Existing Architecture (Baseline)

```
FRONTEND (Vercel)                    BACKEND (Railway)                   DATABASE (Supabase)
Next.js 16 App Router                FastAPI                             PostgreSQL + Storage
                                                                        
Browser                               /api/v1/validate                   datasets
  |-> Next.js API routes               |-> BackgroundTasks                validation_runs
       /api/validate (proxy)             |-> run_validation_pipeline      validation_issues
       /api/parse (proxy)                |-> dispatch_webhooks            validation_profiles
       /api/reports/pdf (proxy)          |-> report_builder               audit_logs
  |-> Supabase Realtime                                                  organisations
       (toast on status change)                                          org_members
                                                                         issue_comments
```

**Current data flow:** Upload -> Parse -> Map (frontend) -> Validate (BackgroundTasks) -> Triage -> Clean -> Export

**Key architectural facts from code review:**
- FastAPI uses a lightweight custom Supabase client (`dependencies.py`) via service role key (bypasses RLS)
- Validation runs in `BackgroundTasks.add_task()` -- single-process, no persistence, lost on restart
- `run_validation_pipeline()` accepts `df, column_mappings, config, enabled_checks` and returns `list[ValidationIssue]`
- Webhook dispatch happens inline during background task (blocking with retries/backoff)
- Reports generated via `fpdf2` (no system deps, works on Railway)
- Config resolution: `ProfileConfig` -> `resolve_config()` -> `(flat_config, enabled_checks)`

---

## Feature Integration Architecture

### Feature 1: Job Queue (replacing BackgroundTasks)

**Problem:** `BackgroundTasks` is fire-and-forget. If Railway restarts, running jobs vanish. No retry, no visibility, no persistence.

**Recommendation: PostgreSQL-backed job queue using `procrastinate`**

Why `procrastinate` over alternatives:
- **No Redis required** -- Railway charges per-service; adding Redis adds cost and ops burden for a solo dev
- **Uses existing Supabase PostgreSQL** -- zero new infrastructure
- **Async-native** -- works with FastAPI's async event loop
- **Built-in retry with exponential backoff** -- configurable per-task
- **Job visibility** -- jobs stored in PostgreSQL tables, queryable from frontend
- **Mature** -- 5+ years active development, 1.5k+ GitHub stars

**Integration points:**

| Component | Change Type | Details |
|-----------|-------------|---------|
| `backend/app/main.py` | MODIFY | Add procrastinate app init, connect on startup |
| `backend/app/routers/validation.py` | MODIFY | Replace `BackgroundTasks.add_task()` with `task.defer_async()` |
| `backend/app/services/validation.py` | MODIFY | Wrap `run_validation_background` as a procrastinate task |
| `backend/app/config.py` | MODIFY | Add `database_url` setting for procrastinate connection |
| Supabase PostgreSQL | NEW TABLES | procrastinate creates its own tables (`procrastinate_jobs`, `procrastinate_events`, etc.) |
| Next.js frontend | NEW PAGE | Job queue visibility page (admin): list jobs, status, retry count |

**New data flow:**
```
Next.js /api/validate
  -> POST to FastAPI /api/v1/validate
    -> task.defer_async(dataset_id, config)  [returns immediately]
    -> procrastinate worker picks up job from PostgreSQL
      -> run_validation_background()
      -> on failure: automatic retry with exponential backoff
      -> on success: update dataset status, dispatch webhooks
  -> Supabase Realtime notifies frontend of status change
```

**New/modified tables:**
```sql
-- procrastinate manages its own schema (auto-created on first run):
-- procrastinate_jobs, procrastinate_events, procrastinate_periodic_defers
-- No manual migration needed -- procrastinate handles this via its CLI

-- Add job tracking reference to validation_runs
ALTER TABLE validation_runs ADD COLUMN job_id BIGINT;  -- references procrastinate_jobs.id
```

**Worker deployment on Railway:**
```
# Procfile or railway.toml -- run worker alongside web process
# Option A: Separate Railway service (recommended)
web: uvicorn app.main:app --host 0.0.0.0 --port $PORT
worker: python -m procrastinate worker --app=app.tasks.procrastinate_app

# Option B: In-process worker (simpler, fine for solo dev scale)
# Start worker thread alongside FastAPI on startup event
```

---

### Feature 2: Dataset Versioning

**Problem:** Users re-validate after cleaning. No way to see what changed between runs or roll back.

**Architecture: Snapshot-per-validation-run model**

Store a lightweight snapshot of the dataset state each time validation runs. Not full file copies -- store a content hash + the delta from previous version.

**Integration points:**

| Component | Change Type | Details |
|-----------|-------------|---------|
| `backend/app/routers/validation.py` | MODIFY | Create snapshot before validation runs |
| Supabase Storage | NEW BUCKET | `dataset-snapshots` bucket for versioned copies |
| Supabase PostgreSQL | NEW TABLE | `dataset_versions` tracking table |
| Next.js frontend | NEW UI | Version history sidebar, diff viewer |
| `backend/app/routers/compare.py` | EXTEND | Add endpoint for diffing two versions of same dataset |

**New tables:**
```sql
CREATE TABLE public.dataset_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID REFERENCES datasets(id) ON DELETE CASCADE NOT NULL,
  version_number INTEGER NOT NULL,
  run_id UUID REFERENCES validation_runs(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL,           -- path in dataset-snapshots bucket
  content_hash TEXT NOT NULL,           -- SHA-256 of file content
  row_count INTEGER NOT NULL,
  file_size BIGINT NOT NULL,
  change_summary JSONB,                 -- {rows_added, rows_removed, cells_changed}
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(dataset_id, version_number)
);

CREATE INDEX idx_dataset_versions_dataset ON dataset_versions(dataset_id, version_number DESC);
```

**Storage strategy:**
- Store full CSV snapshot in `dataset-snapshots/{dataset_id}/v{version_number}.csv`
- Compute `change_summary` by diffing current vs previous version at snapshot time
- Content hash = SHA-256 of raw file bytes (reused by validation certificates)
- Retention: keep last 10 versions per dataset (configurable), prune older on new snapshot

**Data flow:**
```
Validation triggered
  -> Snapshot current dataset state to dataset-snapshots bucket
  -> Insert dataset_versions record with content_hash
  -> Run validation pipeline (existing flow)
  -> Link version to validation_run via run_id
```

---

### Feature 3: Validation Certificates

**Problem:** Clients need a tamper-evident QC certificate that proves a specific dataset passed validation at a specific time.

**Architecture: Certificate = PDF + cryptographic hash stored in registry**

The certificate is a special PDF report with an embedded unique hash. The hash chain: `SHA-256(dataset_content_hash + run_id + timestamp + config_snapshot_json)`. Anyone can verify by re-hashing and checking the registry.

**Integration points:**

| Component | Change Type | Details |
|-----------|-------------|---------|
| `backend/app/services/report_builder.py` | EXTEND | New certificate PDF template |
| `backend/app/routers/reports.py` | EXTEND | New `/api/v1/certificates/{run_id}` endpoint |
| Supabase PostgreSQL | NEW TABLE | `validation_certificates` registry |
| Next.js frontend | NEW UI | Certificate generation button, verification page |
| Public verification page | NEW PAGE | `/verify/{certificate_hash}` -- no auth required |

**New tables:**
```sql
CREATE TABLE public.validation_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES validation_runs(id) ON DELETE CASCADE NOT NULL UNIQUE,
  dataset_id UUID REFERENCES datasets(id) ON DELETE CASCADE NOT NULL,
  version_id UUID REFERENCES dataset_versions(id) ON DELETE SET NULL,
  certificate_hash TEXT NOT NULL UNIQUE,  -- SHA-256 composite hash
  dataset_hash TEXT NOT NULL,             -- SHA-256 of dataset content at time of cert
  issued_by UUID REFERENCES auth.users(id) NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  org_id UUID REFERENCES organisations(id) NOT NULL,
  metadata JSONB DEFAULT '{}',            -- pass_rate, issue counts, config used
  revoked_at TIMESTAMPTZ,                 -- NULL = valid, set = revoked
  revoke_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_certificates_hash ON validation_certificates(certificate_hash);
CREATE INDEX idx_certificates_dataset ON validation_certificates(dataset_id);
```

**Hash generation (Python):**
```python
import hashlib, json

def generate_certificate_hash(
    dataset_content_hash: str,
    run_id: str,
    timestamp_iso: str,
    config_snapshot: dict,
) -> str:
    payload = f"{dataset_content_hash}:{run_id}:{timestamp_iso}:{json.dumps(config_snapshot, sort_keys=True)}"
    return hashlib.sha256(payload.encode()).hexdigest()
```

**Dependency:** Requires dataset versioning (Feature 2) for `dataset_hash` and `version_id`.

---

### Feature 4: Collaboration (Notifications, Activity Feed, @Mentions)

**Problem:** Multi-user orgs need to know when things happen and communicate about issues.

**Architecture: Event-driven notifications with Supabase Realtime + Resend email**

**Integration points:**

| Component | Change Type | Details |
|-----------|-------------|---------|
| Supabase PostgreSQL | NEW TABLES | `notifications`, `activity_feed`, modify `issue_comments` |
| Next.js API routes | NEW ROUTES | `/api/notifications` CRUD, `/api/activity` feed |
| Next.js frontend | NEW COMPONENTS | Notification bell, activity feed panel, @mention autocomplete |
| Supabase Realtime | EXTEND | Subscribe to `notifications` table for real-time bell updates |
| Resend (existing SMTP) | EXTEND | Email notification templates for key events |
| `backend/app/services/webhooks.py` | EXTEND | Emit internal notification events alongside external webhooks |

**New tables:**
```sql
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  org_id UUID REFERENCES organisations(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,               -- 'validation_complete', 'comment_added', 'mention', 'approval_changed'
  title TEXT NOT NULL,
  body TEXT,
  entity_type TEXT,                 -- 'dataset', 'validation_run', 'issue_comment'
  entity_id TEXT,
  actor_id UUID REFERENCES auth.users(id), -- who triggered it
  read_at TIMESTAMPTZ,             -- NULL = unread
  email_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_unread ON notifications(user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);

CREATE TABLE public.activity_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organisations(id) ON DELETE CASCADE NOT NULL,
  actor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  action TEXT NOT NULL,             -- 'uploaded_dataset', 'ran_validation', 'commented', 'approved', 'exported'
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',     -- contextual data (dataset name, issue count, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_feed_org ON activity_feed(org_id, created_at DESC);

-- Extend issue_comments for @mentions and resolution
ALTER TABLE public.issue_comments ADD COLUMN mentions UUID[] DEFAULT '{}';
ALTER TABLE public.issue_comments ADD COLUMN resolved_at TIMESTAMPTZ;
ALTER TABLE public.issue_comments ADD COLUMN resolved_by UUID REFERENCES auth.users(id);
```

**Notification dispatch pattern:**
```
Event occurs (validation complete, comment added, etc.)
  -> Insert into activity_feed (org-wide, always)
  -> Determine notification recipients (org members with relevant role)
  -> Insert into notifications table (per-user)
  -> Supabase Realtime broadcasts to connected clients
  -> For high-priority events: queue email via Resend (respect user preferences)
```

**@Mention parsing:** Parse `@username` from comment content on insert. Store mentioned user IDs in `mentions` array. Create notification for each mentioned user.

---

### Feature 5: Cross-Dataset Validation

**Problem:** Engineers need to compare an as-built survey against an as-designed reference (e.g., verify pipe was laid within tolerance of design route).

**Architecture: Extend validation pipeline with multi-dataset context**

This builds on the existing `compare.py` module but integrates into the validation pipeline rather than being a standalone endpoint.

**Integration points:**

| Component | Change Type | Details |
|-----------|-------------|---------|
| `backend/app/services/validation.py` | MODIFY | Accept optional `reference_df` parameter |
| `backend/app/validators/cross_dataset.py` | NEW FILE | Cross-dataset validators |
| `backend/app/routers/validation.py` | MODIFY | Accept optional `reference_dataset_id` in request |
| `backend/app/models/schemas.py` | MODIFY | Add `reference_dataset_id` to `ValidateRequest` |
| Supabase PostgreSQL | MODIFY | Add `reference_dataset_id` to `validation_runs` |
| Next.js frontend | MODIFY | Reference dataset picker in validation config UI |

**Modified schema:**
```python
class ValidateRequest(BaseModel):
    dataset_id: str
    config: ProfileConfig | None = None
    reference_dataset_id: str | None = None  # NEW: for cross-dataset checks

class EnabledChecks(BaseModel):
    # ... existing checks ...
    cross_dataset_tolerance: bool = True      # NEW
    cross_dataset_coverage: bool = True       # NEW
    cross_dataset_alignment: bool = True      # NEW
```

**New validator module (`cross_dataset.py`):**
```python
def check_cross_dataset_tolerance(
    df: pd.DataFrame,
    reference_df: pd.DataFrame,
    key_column: str,
    compare_columns: list[str],
    tolerance: float,
    kp_column: str | None = None,
) -> list[ValidationIssue]:
    """Flag rows where values deviate from reference beyond tolerance."""
    ...

def check_cross_dataset_coverage(
    df: pd.DataFrame,
    reference_df: pd.DataFrame,
    key_column: str,
) -> list[ValidationIssue]:
    """Flag KP points missing from dataset that exist in reference."""
    ...

def check_cross_dataset_alignment(
    df: pd.DataFrame,
    reference_df: pd.DataFrame,
    coord_columns: list[str],
    max_offset: float,
) -> list[ValidationIssue]:
    """Flag rows where spatial position deviates from reference route."""
    ...
```

**Modified validation flow:**
```
run_validation_background(dataset_id, config, reference_dataset_id=None)
  -> Download primary dataset (existing)
  -> If reference_dataset_id:
      -> Download reference dataset
      -> Parse reference into reference_df
      -> Pass reference_df to run_validation_pipeline
  -> run_validation_pipeline(df, mappings, config, enabled_checks, reference_df=None)
      -> Run all existing single-dataset checks
      -> If reference_df provided: run cross-dataset checks
  -> Store results (existing flow)
```

**DB change:**
```sql
ALTER TABLE validation_runs ADD COLUMN reference_dataset_id UUID REFERENCES datasets(id) ON DELETE SET NULL;
```

---

### Feature 6: Custom Rule Builder

**Problem:** Users want to define their own validation rules beyond the built-in set (e.g., "if column A > 5, then column B must not be null").

**Architecture: JSON rule definitions stored in DB, interpreted by rule engine at validation time**

**Integration points:**

| Component | Change Type | Details |
|-----------|-------------|---------|
| Supabase PostgreSQL | NEW TABLE | `custom_rules` with JSON rule definition |
| `backend/app/validators/custom_rules.py` | NEW FILE | Rule interpreter/engine |
| `backend/app/services/validation.py` | MODIFY | Load and execute custom rules at end of pipeline |
| `backend/app/models/schemas.py` | MODIFY | Add custom rule schema types |
| Next.js frontend | NEW PAGE | Rule builder UI (conditional logic editor) |
| Next.js API routes | NEW ROUTE | `/api/custom-rules` CRUD |

**New table:**
```sql
CREATE TABLE public.custom_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organisations(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  rule_definition JSONB NOT NULL,       -- structured rule JSON (see schema below)
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('critical', 'warning', 'info')),
  enabled BOOLEAN DEFAULT TRUE,
  applies_to TEXT[] DEFAULT '{}',       -- survey types this rule applies to (empty = all)
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, name)
);

CREATE INDEX idx_custom_rules_org ON custom_rules(org_id) WHERE enabled = TRUE;
```

**Rule definition JSON schema:**
```json
{
  "type": "conditional",
  "condition": {
    "column": "dob",
    "operator": ">",
    "value": 2.0
  },
  "then": {
    "column": "doc",
    "operator": "is_not_null"
  },
  "message_template": "When DOB > 2.0m, DOC must have a value (row {row})"
}
```

**Supported rule types (v1.1 scope):**
1. **Column comparison:** `column_a [op] column_b` (e.g., DOC < DOB)
2. **Conditional required:** `IF column_a [op] value THEN column_b [condition]`
3. **Range override:** `column_a BETWEEN min AND max` (per-rule, not profile-wide)
4. **Pattern match:** `column_a MATCHES regex` (for text columns like event codes)

**Rule engine integration:**
```python
def run_validation_pipeline(df, column_mappings, config, enabled_checks, reference_df=None, custom_rules=None):
    all_issues = []
    # ... existing checks ...
    
    # Custom rules (run last, after all built-in checks)
    if custom_rules:
        for rule in custom_rules:
            all_issues.extend(evaluate_custom_rule(df, rule, kp_column))
    
    return all_issues
```

**Custom rules loaded in background task:**
```python
# In run_validation_background:
# Fetch org_id from dataset chain
# Load enabled custom rules for this org
custom_rules_result = supabase.table("custom_rules") \
    .select("*").eq("org_id", org_id).eq("enabled", "true").execute()
custom_rules = custom_rules_result.data or []
```

---

### Feature 7: Context-Aware QC

**Problem:** A depth reading of 150m is fine at KP 50 but might be wrong at KP 5. Static thresholds miss context-dependent anomalies.

**Architecture: Contextual rule overlays applied during validation config resolution**

This is NOT a new pipeline stage -- it modifies how existing validators get their thresholds.

**Integration points:**

| Component | Change Type | Details |
|-----------|-------------|---------|
| Supabase PostgreSQL | NEW TABLE | `context_rules` for dynamic threshold overrides |
| `backend/app/services/templates.py` | MODIFY | Config resolution applies context overlays |
| `backend/app/services/validation.py` | MODIFY | Pass context to per-row validation |
| `backend/app/models/schemas.py` | MODIFY | Add context rule types |
| Next.js frontend | NEW UI | Context rule editor (map KP ranges to threshold overrides) |

**New table:**
```sql
CREATE TABLE public.context_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organisations(id) ON DELETE CASCADE NOT NULL,
  profile_id UUID REFERENCES validation_profiles(id) ON DELETE CASCADE,  -- tied to a profile
  name TEXT NOT NULL,
  context_type TEXT NOT NULL,          -- 'kp_range', 'event_zone', 'depth_zone'
  condition JSONB NOT NULL,            -- {"kp_min": 0, "kp_max": 10} or {"event_type": "crossing"}
  overrides JSONB NOT NULL,            -- {"dob_max": 5.0, "zscore_threshold": 2.0}
  priority INTEGER DEFAULT 0,          -- higher priority wins on overlap
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_context_rules_profile ON context_rules(profile_id) WHERE enabled = TRUE;
```

**How it works:**
```
Validation starts with base ProfileConfig
  -> Load context_rules for this profile/org
  -> For each row in DataFrame:
     -> Determine which context rules match (based on row's KP, event type, etc.)
     -> Merge matching overrides into per-row config (higher priority wins)
     -> Validate row with merged config
```

**Implementation approach -- segment-based, not per-row:**
Rather than evaluating context per-row (expensive), pre-segment the DataFrame:
```python
def apply_context_rules(df, base_config, context_rules, kp_column):
    """Split DataFrame into segments by context, validate each with merged config."""
    segments = []
    for rule in sorted(context_rules, key=lambda r: r['priority']):
        if rule['context_type'] == 'kp_range':
            mask = (df[kp_column] >= rule['condition']['kp_min']) & \
                   (df[kp_column] <= rule['condition']['kp_max'])
            segments.append((mask, rule['overrides']))
    
    # Validate each segment with its merged config
    # Rows not matching any context rule use base config
```

---

## Component Boundary Summary

### New Backend Files

| File | Purpose |
|------|---------|
| `backend/app/tasks.py` | Procrastinate app, task definitions |
| `backend/app/validators/cross_dataset.py` | Cross-dataset validation checks |
| `backend/app/validators/custom_rules.py` | Custom rule interpreter/engine |
| `backend/app/services/notifications.py` | Notification dispatch (internal + email) |
| `backend/app/services/certificates.py` | Certificate hash generation, PDF template |

### Modified Backend Files

| File | Features Touching It |
|------|---------------------|
| `backend/app/main.py` | Job queue (procrastinate init) |
| `backend/app/config.py` | Job queue (database_url) |
| `backend/app/routers/validation.py` | Job queue, cross-dataset, versioning |
| `backend/app/services/validation.py` | Cross-dataset, custom rules, context-aware |
| `backend/app/services/templates.py` | Context-aware QC |
| `backend/app/models/schemas.py` | Cross-dataset, custom rules, context-aware |
| `backend/app/routers/reports.py` | Certificates |
| `backend/app/services/report_builder.py` | Certificates |
| `backend/app/services/webhooks.py` | Collaboration (notification events) |

### New Next.js Pages/Routes

| Route | Purpose |
|-------|---------|
| `/api/notifications` | Notification CRUD |
| `/api/custom-rules` | Custom rule CRUD |
| `/api/context-rules` | Context rule CRUD |
| `/api/certificates/[runId]` | Generate/fetch certificate |
| `/verify/[hash]` | Public certificate verification (no auth) |
| Dashboard: job queue panel | Admin visibility into job status |
| Dashboard: notification bell | Real-time notification dropdown |
| Dashboard: activity feed | Org-wide activity timeline |
| Pipeline: version history | Version sidebar in dataset view |
| Pipeline: diff viewer | Compare two dataset versions |
| Settings: rule builder | Custom rule creation UI |
| Settings: context rules | Context rule configuration |

### New Database Tables (6 total)

| Table | Feature | Est. Growth |
|-------|---------|-------------|
| `dataset_versions` | Versioning | ~1 row per validation run |
| `validation_certificates` | Certificates | ~1 row per issued cert |
| `notifications` | Collaboration | High -- prune after 90 days |
| `activity_feed` | Collaboration | High -- prune after 90 days |
| `custom_rules` | Rule builder | Low -- ~10-50 per org |
| `context_rules` | Context-aware | Low -- ~5-20 per profile |

Plus `procrastinate_*` auto-managed tables for job queue.

### Modified Existing Tables

| Table | Column Added | Feature |
|-------|-------------|---------|
| `validation_runs` | `job_id BIGINT` | Job queue |
| `validation_runs` | `reference_dataset_id UUID` | Cross-dataset |
| `issue_comments` | `mentions UUID[]` | Collaboration |
| `issue_comments` | `resolved_at TIMESTAMPTZ` | Collaboration |
| `issue_comments` | `resolved_by UUID` | Collaboration |

---

## Suggested Build Order

The ordering below is driven by **dependency chains** and **risk reduction**.

### Phase 1: Job Queue (Feature 1) -- Build First

**Rationale:** Every subsequent feature runs as a background job. Building the job queue first means all other features benefit from retry/recovery/visibility from day one. This is also the highest-risk infrastructure change (replaces the core processing mechanism).

**Dependencies:** None (standalone infrastructure)
**Unlocks:** Reliable processing for all other features

### Phase 2: Dataset Versioning (Feature 2) -- Foundation for Certificates

**Rationale:** Certificates need a content hash and version reference. Versioning also provides the `change_summary` diffing that the version diff UI needs. Build this before certificates.

**Dependencies:** Job queue (snapshots happen inside job)
**Unlocks:** Certificates (Feature 3), version diff UI

### Phase 3: Validation Certificates (Feature 3)

**Rationale:** Once versioning provides content hashes, certificates are a focused addition: hash generation + PDF template + registry table + public verification page. Relatively contained.

**Dependencies:** Dataset versioning (for content_hash, version_id)
**Unlocks:** Nothing downstream, but high customer value

### Phase 4: Collaboration (Feature 4)

**Rationale:** Notifications, activity feed, and @mentions are UI-heavy and can be built independently of the validation pipeline. They hook into existing events (validation complete, comment added) via the notification dispatch pattern.

**Dependencies:** None hard, but benefits from job queue (job completion triggers notifications)
**Unlocks:** Better team workflows

### Phase 5: Cross-Dataset Validation (Feature 5)

**Rationale:** Extends the validation pipeline with a reference dataset concept. Requires careful changes to `run_validation_pipeline()` signature and the background task flow. Build after job queue is stable.

**Dependencies:** Job queue (runs as a job), versioning (reference dataset version tracking)
**Unlocks:** Context-aware QC patterns

### Phase 6: Custom Rule Builder (Feature 6)

**Rationale:** The rule engine is a new subsystem. It hooks into the end of `run_validation_pipeline()` but is otherwise self-contained. The UI (conditional logic editor) is the most complex frontend work in v1.1.

**Dependencies:** Job queue (rules evaluated during job)
**Unlocks:** Context-aware QC (shares conditional logic patterns)

### Phase 7: Context-Aware QC (Feature 7)

**Rationale:** Build last because it modifies how the entire validation pipeline resolves config. It benefits from custom rules being done first (shared conditional logic patterns). It is the most architecturally invasive change to the validation pipeline.

**Dependencies:** Job queue, custom rule patterns (similar condition evaluation)
**Unlocks:** Deeply domain-specific QC intelligence

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Per-Row Config Resolution in Context-Aware QC
**What:** Evaluating context rules for every single row individually.
**Why bad:** O(rows * rules) with full config merge per row. A 50,000-row dataset with 10 context rules = 500K evaluations.
**Instead:** Pre-segment the DataFrame by KP ranges/zones, validate each segment with its merged config. O(segments * rules) where segments << rows.

### Anti-Pattern 2: Storing Full Dataset Copies for Every Version
**What:** Copying the entire CSV to storage on every validation run.
**Why bad:** 50MB dataset * 10 versions = 500MB per dataset. Storage costs balloon.
**Instead:** Store full copy but enforce version limit (10 per dataset). Old versions auto-pruned. For most survey datasets (1-5MB), this is fine. Add compression for larger files.

### Anti-Pattern 3: Synchronous Notification Dispatch
**What:** Sending emails and creating notifications inline during the validation background task.
**Why bad:** If Resend is slow or down, validation job stalls or fails.
**Instead:** Insert notifications into DB (fast), then process email sends as a separate job. Validation completion should not depend on notification delivery.

### Anti-Pattern 4: Running Procrastinate Worker as In-Process Thread
**What:** Starting the procrastinate worker in the same process as the FastAPI web server to save Railway costs.
**Why bad:** A CPU-intensive validation job (pandas on 50K rows) blocks the web server's event loop, causing health check timeouts and Railway restarts.
**Instead:** Run as a separate Railway service. The cost of a second $5/month service is worth the reliability.

### Anti-Pattern 5: Embedding Rule Engine Logic in the Database
**What:** Using PostgreSQL functions or PL/pgSQL to evaluate custom rules.
**Why bad:** The rule engine needs DataFrame operations (column comparisons, aggregations). SQL is the wrong tool.
**Instead:** Store rules as JSON in PostgreSQL, evaluate in Python with pandas. DB is storage, Python is compute.

---

## Scalability Considerations

| Concern | At 10 users | At 100 users | At 1,000 users |
|---------|-------------|--------------|----------------|
| Job queue throughput | 1 worker, serial | 1 worker, serial (fine for ~100 jobs/day) | 2-3 workers, parallel |
| Notification volume | Tens/day | Hundreds/day | Prune after 90 days, paginate |
| Dataset version storage | Negligible | ~10GB | Consider S3 lifecycle rules |
| Custom rule evaluation | Negligible overhead | Negligible | Cache compiled rules per-org |
| Certificate verification | Direct DB lookup | Direct DB lookup | Add CDN cache for public page |

At solo-dev scale targeting small survey companies, the architecture above handles 100+ active users without modification.

## Sources

- [Procrastinate - PostgreSQL Task Queue](https://procrastinate.readthedocs.io/)
- [PgQueuer - PostgreSQL Job Queue](https://github.com/janbjorge/pgqueuer)
- [Railway FastAPI + Celery Deploy Template](https://railway.com/deploy/fastapi-celery-beat-worker-flower)
- [FastAPI BackgroundTasks vs ARQ vs Celery](https://davidmuraya.com/blog/fastapi-background-tasks-arq-vs-built-in/)
- [Python hashlib - SHA-256](https://docs.python.org/3/library/hashlib.html)
- [Choosing the Right Python Task Queue](https://judoscale.com/blog/choose-python-task-queue)
