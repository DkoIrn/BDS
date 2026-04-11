# Phase 5: Validation Engine - Research

**Researched:** 2026-03-11
**Domain:** Python/FastAPI validation backend, statistical analysis, Supabase integration, Railway deployment
**Confidence:** HIGH

## Summary

Phase 5 introduces the Python/FastAPI backend service -- the first non-Next.js component of the system. This service reads parsed survey data from Supabase Storage, runs validation checks (range/tolerance, missing data, duplicates, outliers, KP monotonicity), writes results to dedicated Supabase tables, and returns status updates to the Next.js frontend. The backend must be deployed to Railway with Docker.

The core validation logic is straightforward data analysis with pandas, numpy, and scipy. The main complexity lies in: (1) standing up the FastAPI service with proper Supabase credentials, (2) designing the validation pipeline so checks are modular and produce consistent explainable output, and (3) wiring the full flow from "Run QC" button through Next.js API route to FastAPI and back.

**Primary recommendation:** Use pandas for data manipulation, scipy.stats for z-score calculations, and a simple rule-based pipeline pattern where each check is an independent function that returns a list of ValidationIssue objects. Keep it simple -- no framework like Great Expectations (overkill for this scope).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Validation runs on Python/FastAPI backend, not Next.js API routes
- FastAPI reads data directly from Supabase (has its own Supabase client/credentials)
- Next.js calls FastAPI via direct HTTP calls (not Supabase as message bus)
- FastAPI deployed on Railway in this phase
- Full deployment: click "Run QC" button -> Next.js API route -> FastAPI -> results in Supabase
- Per-cell granularity -- each flag points to a specific cell (row + column)
- 3 severity levels: Critical, Warning, Info
- Dedicated `validation_issues` table -- one row per flagged cell
- Dedicated `validation_runs` table for summary records
- Re-runs create new validation_runs records (history preserved)
- Manual "Run QC" button on file detail page after mapping confirmed
- User stays on file detail page during validation -- progress indicator with status text
- Dataset status extended: mapped -> validating -> validated (or validation_error)
- Technical but clear explanation tone -- like senior engineer's QC notes
- Both human-readable message AND structured fields stored per issue
- KP value as primary location reference, row number as secondary
- Statistical outlier explanations include full statistical context

### Claude's Discretion
- FastAPI project structure and endpoint design
- Python validation library choices (pandas, numpy, scipy vs lighter alternatives)
- Database migration schema details for validation_issues and validation_runs tables
- Railway deployment configuration
- Exact rule implementations (z-score threshold, IQR multiplier, duplicate tolerance)
- Progress reporting granularity from FastAPI to frontend
- Error handling for validation failures
- How parsed data flows from Supabase Storage to FastAPI processing

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| VALE-01 | System performs range and tolerance checks against configurable thresholds | Range check function comparing each cell value against min/max with tolerance; pandas vectorized operations |
| VALE-02 | System detects missing data points, null cells, and KP coverage gaps | pandas isnull/isna for null detection; KP gap detection via diff() on sorted KP column |
| VALE-03 | System detects duplicate rows and near-duplicate KP entries | pandas duplicated() for exact dupes; abs(diff) < tolerance for near-duplicate KP |
| VALE-04 | System detects statistical outliers using z-score and IQR methods | scipy.stats.zscore for z-score; pandas quantile() for IQR calculation |
| VALE-05 | System validates monotonicity of KP values and logical event sequencing | pandas diff() to check all positive; flag non-monotonic segments |
| VALE-07 | Every flagged issue includes plain-English explanation | Explanation builder functions generating structured messages with KP reference, expected vs actual |
</phase_requirements>

## Standard Stack

### Core (Python Backend)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | 0.115+ | Web framework / API | De facto Python async API framework; auto-generates OpenAPI docs |
| uvicorn | 0.34+ | ASGI server | FastAPI's recommended production server |
| pandas | 2.2+ | Data manipulation | Industry standard for tabular data; vectorized operations on survey data |
| numpy | 2.1+ | Numerical operations | Required by pandas; used for NaN handling and array ops |
| scipy | 1.14+ | Statistical functions | zscore from scipy.stats; well-tested statistical implementations |
| supabase | 2.x | Supabase Python client | Official client; storage download + database read/write |
| pydantic | 2.x | Data validation/settings | Ships with FastAPI; BaseSettings for config management |
| pydantic-settings | 2.x | Environment config | Reads .env files for Supabase credentials, Railway port |
| python-dotenv | 1.x | .env file loading | Local development environment variable loading |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| httpx | 0.28+ | Async HTTP client | If async Supabase calls needed; also for testing |
| openpyxl | 3.1+ | Excel file reading | If FastAPI needs to parse .xlsx files directly |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pandas + scipy | Pure numpy only | Less readable, more manual; pandas is worth the dependency for survey data |
| Great Expectations / Pandera | Custom validation functions | GE/Pandera are overkill -- they add massive dependency trees for schema-level validation; our checks are domain-specific rules not schema validation |
| Celery + Redis | Synchronous validation | Phase 7 handles async; for now synchronous is fine given dataset sizes (50MB max, typically <10K rows) |

**Installation (Python backend):**
```bash
pip install fastapi uvicorn[standard] pandas numpy scipy supabase pydantic-settings python-dotenv
```

### Frontend Additions (Next.js)
No new npm packages required. The existing stack (fetch API, sonner toasts, lucide icons, Badge component) covers all frontend needs for this phase.

## Architecture Patterns

### Recommended FastAPI Project Structure
```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app creation, CORS, router mounting
│   ├── config.py            # Pydantic BaseSettings for env vars
│   ├── dependencies.py      # Supabase client factory, shared deps
│   ├── routers/
│   │   ├── __init__.py
│   │   └── validation.py    # POST /api/v1/validate endpoint
│   ├── services/
│   │   ├── __init__.py
│   │   └── validation.py    # Orchestrates validation pipeline
│   ├── validators/
│   │   ├── __init__.py
│   │   ├── base.py          # BaseValidator protocol/ABC, ValidationIssue model
│   │   ├── range_check.py   # VALE-01: Range/tolerance checks
│   │   ├── missing_data.py  # VALE-02: Null/missing/KP gaps
│   │   ├── duplicates.py    # VALE-03: Duplicate/near-duplicate detection
│   │   ├── outliers.py      # VALE-04: Z-score and IQR
│   │   ├── monotonicity.py  # VALE-05: KP monotonicity
│   │   └── explanations.py  # VALE-07: Explanation message builder
│   └── models/
│       ├── __init__.py
│       └── schemas.py       # Pydantic request/response models
├── requirements.txt
├── Dockerfile
├── .env.example
└── railway.json             # Railway deployment config (optional)
```

### Pattern 1: Validator Pipeline
**What:** Each validation check is an independent function/class that takes a DataFrame and column mappings, returns a list of ValidationIssue objects. An orchestrator runs all validators in sequence.
**When to use:** Always -- this is the core pattern for the validation engine.
**Example:**
```python
from dataclasses import dataclass
from enum import Enum
from typing import Protocol
import pandas as pd

class Severity(str, Enum):
    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"

@dataclass
class ValidationIssue:
    row_number: int
    column_name: str
    rule_type: str
    severity: Severity
    message: str
    expected: str | None = None
    actual: str | None = None
    kp_value: float | None = None

class Validator(Protocol):
    def validate(
        self,
        df: pd.DataFrame,
        column_mappings: list[dict],
        config: dict
    ) -> list[ValidationIssue]: ...

# Orchestrator
def run_validation_pipeline(
    df: pd.DataFrame,
    column_mappings: list[dict],
    config: dict,
    validators: list[Validator]
) -> list[ValidationIssue]:
    all_issues: list[ValidationIssue] = []
    for validator in validators:
        issues = validator.validate(df, column_mappings, config)
        all_issues.extend(issues)
    return all_issues
```

### Pattern 2: Supabase Service Role Client
**What:** FastAPI uses the Supabase service_role key to bypass RLS for reading storage and writing validation results.
**When to use:** All Supabase operations from FastAPI.
**Example:**
```python
from supabase import create_client, Client
from app.config import settings

def get_supabase_client() -> Client:
    return create_client(
        settings.supabase_url,
        settings.supabase_service_role_key
    )
```

### Pattern 3: Data Flow -- Storage to DataFrame
**What:** Download file from Supabase Storage, parse into DataFrame using the stored column mappings.
**When to use:** At the start of every validation run.
**Example:**
```python
import pandas as pd
import io

async def load_dataset(supabase: Client, dataset: dict) -> pd.DataFrame:
    # Download from storage
    file_bytes = supabase.storage.from_("datasets").download(
        dataset["storage_path"]
    )

    # Parse based on mime type
    if dataset["file_name"].endswith(".csv"):
        df = pd.read_csv(
            io.BytesIO(file_bytes),
            header=dataset["header_row_index"],
            dtype=str  # Keep as strings initially
        )
    else:
        df = pd.read_excel(
            io.BytesIO(file_bytes),
            header=dataset["header_row_index"],
            dtype=str
        )

    # Apply column mappings -- rename columns to their mapped types
    mappings = dataset["column_mappings"]
    rename_map = {}
    for m in mappings:
        if m.get("mappedType") and not m.get("ignored"):
            rename_map[m["originalName"]] = m["mappedType"]

    df = df.rename(columns=rename_map)

    # Convert numeric columns
    numeric_types = ["kp", "easting", "northing", "depth", "dob", "doc",
                     "top", "elevation", "latitude", "longitude"]
    for col in df.columns:
        if col in numeric_types:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    return df
```

### Pattern 4: Next.js API Route Proxy
**What:** A Next.js API route at `/api/validate` that proxies the request to FastAPI, handling auth and forwarding the dataset ID.
**When to use:** Triggered by "Run QC" button click.
**Example:**
```typescript
// src/app/api/validate/route.ts
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const { datasetId } = await request.json()

  // Verify ownership
  const { data: dataset } = await supabase
    .from("datasets")
    .select("id, user_id")
    .eq("id", datasetId)
    .eq("user_id", user.id)
    .single()

  if (!dataset) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Update status to validating
  await supabase.from("datasets").update({ status: "validating" }).eq("id", datasetId)

  // Call FastAPI
  const response = await fetch(`${process.env.FASTAPI_URL}/api/v1/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataset_id: datasetId }),
  })

  if (!response.ok) {
    await supabase.from("datasets").update({ status: "validation_error" }).eq("id", datasetId)
    return NextResponse.json({ error: "Validation failed" }, { status: 500 })
  }

  const result = await response.json()
  return NextResponse.json(result)
}
```

### Anti-Patterns to Avoid
- **Loading entire file into memory multiple times:** Download once, parse once, pass DataFrame to all validators
- **Mixing validation logic with database writes:** Validators return issue lists; the orchestrator handles DB writes
- **Hardcoding thresholds in validator functions:** Pass config dict with defaults that can be overridden (Phase 6 will add profiles)
- **Using anon key from FastAPI:** Always use service_role key; FastAPI is a trusted backend service
- **Synchronous Supabase client in async FastAPI:** The supabase-py client is synchronous; run in executor or use sync endpoints for simplicity

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Z-score calculation | Manual mean/std/zscore math | `scipy.stats.zscore()` | Handles edge cases (zero std dev, NaN values) |
| IQR computation | Manual percentile math | `pandas.DataFrame.quantile()` | Vectorized, handles NaN correctly |
| CSV/Excel parsing in Python | Custom parser | `pandas.read_csv()` / `pandas.read_excel()` | Battle-tested with encoding/delimiter handling |
| Supabase auth/storage | Raw HTTP to Supabase API | `supabase-py` client library | Handles token refresh, retries, proper auth headers |
| Environment config | Manual os.environ reads | `pydantic-settings BaseSettings` | Type-safe, .env loading, validation on startup |
| CORS handling | Manual headers | `fastapi.middleware.cors.CORSMiddleware` | Standard FastAPI pattern, handles preflight |

**Key insight:** The validation logic itself is the custom domain work. Everything surrounding it (parsing, stats, storage, config) has excellent library support.

## Common Pitfalls

### Pitfall 1: supabase-py is Synchronous
**What goes wrong:** FastAPI is async, but supabase-py's main client is synchronous. Mixing sync calls in async endpoints blocks the event loop.
**Why it happens:** Developers assume supabase-py has full async support.
**How to avoid:** Use regular `def` (not `async def`) for FastAPI endpoints that use supabase-py, or use `asyncio.to_thread()` to run sync calls. FastAPI handles sync endpoints correctly by running them in a thread pool.
**Warning signs:** Slow response times under concurrent requests, timeouts.

### Pitfall 2: Zero Standard Deviation in Z-Score
**What goes wrong:** If a column has all identical values, std dev is 0, z-score division by zero produces inf/NaN.
**Why it happens:** Common in survey data where a column might have constant values for a section.
**How to avoid:** Check std dev > 0 before calculating z-score. If std is 0, skip outlier detection for that column (all values are identical = no outliers).
**Warning signs:** NaN or inf values in z-score results.

### Pitfall 3: Supabase Service Role Key Security
**What goes wrong:** Accidentally exposing the service_role key in frontend code or git.
**Why it happens:** Copy-paste from environment setup, or using NEXT_PUBLIC_ prefix.
**How to avoid:** Service role key only in FastAPI .env (never NEXT_PUBLIC_). Add .env to .gitignore. Use Railway environment variables for production.
**Warning signs:** Key visible in browser network tab or git history.

### Pitfall 4: DataFrame Column Name Mismatch
**What goes wrong:** Column mappings use camelCase (`mappedType`) from the JS side, but Python expects snake_case. Original column names in the file may differ from mapped type names.
**Why it happens:** Two different codebases with different naming conventions.
**How to avoid:** Explicitly rename DataFrame columns using the mapping data. Never assume column names match type names.
**Warning signs:** KeyError exceptions during validation.

### Pitfall 5: Railway PORT Environment Variable
**What goes wrong:** App starts but Railway can't route traffic to it.
**Why it happens:** Railway injects a PORT env var; app must bind to 0.0.0.0:$PORT.
**How to avoid:** Use `uvicorn app.main:app --host 0.0.0.0 --port $PORT` in Dockerfile CMD.
**Warning signs:** Deployment succeeds but health check fails.

### Pitfall 6: Large Datasets and Memory
**What goes wrong:** Loading a 50MB Excel file into pandas uses 2-5x memory.
**Why it happens:** String parsing, type inference, intermediate copies.
**How to avoid:** Use `dtype=str` for initial load (minimal memory), convert only needed columns to numeric. Railway's free tier has limited memory -- monitor usage.
**Warning signs:** OOM kills on Railway, 502 errors.

## Code Examples

### Range/Tolerance Check (VALE-01)
```python
def check_range(
    df: pd.DataFrame,
    column: str,
    min_val: float,
    max_val: float,
    tolerance: float = 0.0,
    kp_column: str | None = None,
) -> list[ValidationIssue]:
    issues = []
    series = pd.to_numeric(df[column], errors="coerce")
    effective_min = min_val - tolerance
    effective_max = max_val + tolerance

    out_of_range = series[(series < effective_min) | (series > effective_max)].dropna()

    for idx in out_of_range.index:
        row_num = int(idx) + 1  # 1-based
        actual = float(series[idx])
        kp = float(df[kp_column][idx]) if kp_column and kp_column in df.columns else None

        location = f"At KP {kp:.3f} (row {row_num})" if kp else f"Row {row_num}"
        tol_str = f" (tolerance: +/-{tolerance})" if tolerance > 0 else ""

        issues.append(ValidationIssue(
            row_number=row_num,
            column_name=column,
            rule_type="range_check",
            severity=Severity.CRITICAL,
            message=f"{location}: {column.upper()} value {actual}m exceeds "
                    f"{'maximum' if actual > effective_max else 'minimum'} "
                    f"threshold of {max_val if actual > effective_max else min_val}m{tol_str}",
            expected=f"{min_val} to {max_val}",
            actual=str(actual),
            kp_value=kp,
        ))
    return issues
```

### Missing Data / KP Gap Detection (VALE-02)
```python
def check_missing_data(
    df: pd.DataFrame,
    column: str,
    kp_column: str | None = None,
) -> list[ValidationIssue]:
    issues = []
    null_mask = df[column].isna() | (df[column].astype(str).str.strip() == "")

    for idx in df[null_mask].index:
        row_num = int(idx) + 1
        kp = float(df[kp_column][idx]) if kp_column and kp_column in df.columns and pd.notna(df[kp_column][idx]) else None
        location = f"At KP {kp:.3f} (row {row_num})" if kp else f"Row {row_num}"

        issues.append(ValidationIssue(
            row_number=row_num,
            column_name=column,
            rule_type="missing_data",
            severity=Severity.INFO,
            message=f"{location}: {column.upper()} value is missing or empty",
            expected="Non-null value",
            actual="NULL",
            kp_value=kp,
        ))
    return issues

def check_kp_gaps(
    df: pd.DataFrame,
    kp_column: str,
    max_gap: float = 0.1,  # Maximum expected KP increment in km
) -> list[ValidationIssue]:
    issues = []
    kp = pd.to_numeric(df[kp_column], errors="coerce").dropna()
    if len(kp) < 2:
        return issues

    kp_sorted = kp.sort_values()
    gaps = kp_sorted.diff()
    large_gaps = gaps[gaps > max_gap]

    for idx in large_gaps.index:
        row_num = int(idx) + 1
        gap_size = float(gaps[idx])
        kp_val = float(kp_sorted[idx])
        prev_kp = float(kp_sorted[idx - 1]) if idx - 1 in kp_sorted.index else None

        issues.append(ValidationIssue(
            row_number=row_num,
            column_name=kp_column,
            rule_type="kp_gap",
            severity=Severity.WARNING,
            message=f"KP coverage gap of {gap_size:.3f}km detected between "
                    f"KP {prev_kp:.3f} and KP {kp_val:.3f} (row {row_num}). "
                    f"Expected maximum interval: {max_gap}km",
            expected=f"Gap <= {max_gap}km",
            actual=f"{gap_size:.3f}km gap",
            kp_value=kp_val,
        ))
    return issues
```

### Statistical Outlier Detection (VALE-04)
```python
from scipy.stats import zscore

def check_outliers_zscore(
    df: pd.DataFrame,
    column: str,
    threshold: float = 3.0,
    kp_column: str | None = None,
) -> list[ValidationIssue]:
    issues = []
    series = pd.to_numeric(df[column], errors="coerce")
    valid = series.dropna()

    if len(valid) < 3 or valid.std() == 0:
        return issues  # Not enough data or zero variance

    mean_val = float(valid.mean())
    std_val = float(valid.std())
    z_scores = zscore(valid)

    outliers = valid[abs(z_scores) > threshold]

    for idx in outliers.index:
        row_num = int(idx) + 1
        actual = float(series[idx])
        z = float(z_scores[valid.index.get_loc(idx)])
        kp = float(df[kp_column][idx]) if kp_column and kp_column in df.columns else None
        location = f"At KP {kp:.3f} (row {row_num})" if kp else f"Row {row_num}"

        issues.append(ValidationIssue(
            row_number=row_num,
            column_name=column,
            rule_type="outlier_zscore",
            severity=Severity.WARNING,
            message=f"{location}: {column.upper()} value {actual}m is a statistical "
                    f"outlier (z-score: {z:.1f}, mean: {mean_val:.1f}m, "
                    f"std: {std_val:.1f}m). Values beyond +/-{threshold}sigma are flagged.",
            expected=f"{mean_val - threshold * std_val:.1f} to {mean_val + threshold * std_val:.1f}",
            actual=str(actual),
            kp_value=kp,
        ))
    return issues
```

### Dockerfile for Railway
```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
```

### Supabase Migration -- validation_runs
```sql
CREATE TABLE public.validation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID REFERENCES public.datasets(id) ON DELETE CASCADE NOT NULL,
  run_at TIMESTAMPTZ DEFAULT NOW(),
  total_issues INTEGER NOT NULL DEFAULT 0,
  critical_count INTEGER NOT NULL DEFAULT 0,
  warning_count INTEGER NOT NULL DEFAULT 0,
  info_count INTEGER NOT NULL DEFAULT 0,
  pass_rate REAL,
  completeness_score REAL,
  status TEXT NOT NULL DEFAULT 'running',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_validation_runs_dataset ON public.validation_runs(dataset_id);
ALTER TABLE public.validation_runs ENABLE ROW LEVEL SECURITY;

-- RLS: users can read validation runs for their own datasets
CREATE POLICY "Users can view own validation runs"
  ON public.validation_runs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.datasets WHERE datasets.id = validation_runs.dataset_id AND datasets.user_id = auth.uid()
  ));

-- Service role inserts (FastAPI uses service_role key which bypasses RLS)
```

### Supabase Migration -- validation_issues
```sql
CREATE TABLE public.validation_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES public.validation_runs(id) ON DELETE CASCADE NOT NULL,
  dataset_id UUID REFERENCES public.datasets(id) ON DELETE CASCADE NOT NULL,
  row_number INTEGER NOT NULL,
  column_name TEXT NOT NULL,
  rule_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  message TEXT NOT NULL,
  expected TEXT,
  actual TEXT,
  kp_value REAL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_validation_issues_run ON public.validation_issues(run_id);
CREATE INDEX idx_validation_issues_dataset ON public.validation_issues(dataset_id);
CREATE INDEX idx_validation_issues_severity ON public.validation_issues(severity);
ALTER TABLE public.validation_issues ENABLE ROW LEVEL SECURITY;

-- RLS: users can read validation issues for their own datasets
CREATE POLICY "Users can view own validation issues"
  ON public.validation_issues FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.datasets WHERE datasets.id = validation_issues.dataset_id AND datasets.user_id = auth.uid()
  ));
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Flask + gunicorn | FastAPI + uvicorn | 2020+ | Async support, auto OpenAPI docs, type safety with Pydantic |
| Great Expectations for data validation | Custom validators for domain-specific rules | N/A | GE is for data pipeline schema validation; survey QC rules are domain logic |
| supabase-py 1.x (sync only) | supabase-py 2.x (improved sync, async experimental) | 2024 | Better API parity with JS client |
| Manual env parsing | pydantic-settings v2 | 2023 | Type-safe, auto .env loading, nested config support |

**Deprecated/outdated:**
- supabase-py 1.x: Use 2.x series; API changed significantly
- `from pydantic import BaseSettings`: Moved to `pydantic-settings` package in Pydantic v2

## Open Questions

1. **Default Range Thresholds for Survey Data**
   - What we know: DOB typically 0-5m, DOC 0-3m, depth varies by survey. Phase 6 will add configurable profiles.
   - What's unclear: Sensible defaults for Phase 5 hardcoded thresholds.
   - Recommendation: Use generous defaults (DOB: 0-10m, DOC: 0-10m, depth: 0-500m) to avoid false positives. Document that Phase 6 makes these configurable.

2. **KP Gap Threshold**
   - What we know: KP intervals vary by survey type (typical: 0.001km to 0.1km).
   - What's unclear: What constitutes a "gap" vs normal spacing.
   - Recommendation: Use median interval * 3 as dynamic gap threshold (adapts to each dataset's KP density).

3. **Near-Duplicate KP Tolerance**
   - What we know: Survey KP values should be unique or nearly unique.
   - What's unclear: How close is "near-duplicate" (0.001km? 0.0001km?).
   - Recommendation: Default to 0.001km (1 meter) tolerance for near-duplicate KP detection.

4. **Progress Reporting Mechanism**
   - What we know: User wants progress text ("Running range checks...", "Detecting outliers...").
   - What's unclear: Whether to use SSE streaming, polling, or just a spinner with phase text.
   - Recommendation: Simplest approach -- FastAPI returns synchronously (validation is fast for <50MB files). Next.js API route shows a spinner with generic "Running validation..." text. If validation takes >5s in testing, add SSE streaming in a follow-up.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 (frontend) + pytest (backend, new) |
| Config file | vitest.config.ts (frontend); pytest needs setup (backend Wave 0) |
| Quick run command | `npx vitest run --reporter=verbose` (frontend) / `cd backend && python -m pytest -x` (backend) |
| Full suite command | `npx vitest run` (frontend) / `cd backend && python -m pytest` (backend) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VALE-01 | Range/tolerance checks flag values outside thresholds | unit | `cd backend && python -m pytest tests/validators/test_range_check.py -x` | Wave 0 |
| VALE-02 | Missing data, nulls, KP gaps detected | unit | `cd backend && python -m pytest tests/validators/test_missing_data.py -x` | Wave 0 |
| VALE-03 | Duplicate rows and near-duplicate KP | unit | `cd backend && python -m pytest tests/validators/test_duplicates.py -x` | Wave 0 |
| VALE-04 | Z-score and IQR outlier detection | unit | `cd backend && python -m pytest tests/validators/test_outliers.py -x` | Wave 0 |
| VALE-05 | KP monotonicity validation | unit | `cd backend && python -m pytest tests/validators/test_monotonicity.py -x` | Wave 0 |
| VALE-07 | Plain-English explanations on every flag | unit | `cd backend && python -m pytest tests/validators/test_explanations.py -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && python -m pytest -x --tb=short`
- **Per wave merge:** `cd backend && python -m pytest && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/conftest.py` -- shared fixtures (sample DataFrames with survey data)
- [ ] `backend/tests/validators/test_range_check.py` -- covers VALE-01
- [ ] `backend/tests/validators/test_missing_data.py` -- covers VALE-02
- [ ] `backend/tests/validators/test_duplicates.py` -- covers VALE-03
- [ ] `backend/tests/validators/test_outliers.py` -- covers VALE-04
- [ ] `backend/tests/validators/test_monotonicity.py` -- covers VALE-05
- [ ] `backend/tests/validators/test_explanations.py` -- covers VALE-07
- [ ] pytest + pytest-cov install: `pip install pytest pytest-cov`
- [ ] `backend/pytest.ini` or `backend/pyproject.toml` -- pytest configuration

## Sources

### Primary (HIGH confidence)
- [FastAPI official docs - Bigger Applications](https://fastapi.tiangolo.com/tutorial/bigger-applications/) -- project structure guidance
- [Supabase Python docs - Storage download](https://supabase.com/docs/reference/python/storage-from-download) -- file download API
- [Railway FastAPI deployment guide](https://docs.railway.com/guides/fastapi) -- deployment configuration
- [scipy.stats.zscore](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.zscore.html) -- z-score implementation

### Secondary (MEDIUM confidence)
- [FastAPI Best Practices (zhanymkanov)](https://github.com/zhanymkanov/fastapi-best-practices) -- community-validated patterns
- [Supabase Service Role Key docs](https://supabase.com/docs/guides/troubleshooting/why-is-my-service-role-key-client-getting-rls-errors-or-not-returning-data-7_1K9z) -- RLS bypass behavior
- [GeeksforGeeks Z-score outlier detection](https://www.geeksforgeeks.org/machine-learning/z-score-for-outlier-detection-python/) -- implementation patterns

### Tertiary (LOW confidence)
- Default thresholds for survey data (DOB, DOC, depth ranges) -- based on domain knowledge from CONTEXT.md, needs validation with real data

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- FastAPI + pandas + scipy is well-established for this use case
- Architecture: HIGH -- validator pipeline pattern is straightforward and well-understood
- Pitfalls: HIGH -- documented from known FastAPI + Supabase integration issues
- Default thresholds: LOW -- survey-specific values need real data validation

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (stable libraries, 30-day validity)

---
*Phase: 05-validation-engine*
*Researched: 2026-03-11*
