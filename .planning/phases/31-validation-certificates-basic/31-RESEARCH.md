# Phase 31: Validation Certificates (Basic) - Research

**Researched:** 2026-04-13
**Domain:** PDF certificate generation, HMAC-SHA256 tamper evidence, fpdf2
**Confidence:** HIGH

## Summary

Phase 31 adds a "Generate Certificate" button that produces a branded QC Certificate PDF for passed validation runs. The certificate includes dataset name, validation date, rules applied, pass/fail summary, and a unique HMAC-SHA256 hash for tamper evidence. This builds entirely on existing patterns: fpdf2 for PDF generation (already used in `report_builder.py`), HMAC-SHA256 signing (already used in `webhooks.py`), and the Next.js-to-FastAPI proxy pattern (already used in the PDF report route).

The main new work is: (1) a `certificates` database table to store certificate records (needed for Phase 33 verification URLs), (2) a `certificate_builder.py` service parallel to `report_builder.py`, (3) a FastAPI endpoint and Next.js proxy route, and (4) a UI button integrated near the existing export controls. No new dependencies are needed -- fpdf2, hmac, and hashlib are already available.

**Primary recommendation:** Reuse the QCReport FPDF subclass pattern from report_builder.py for the certificate PDF, store certificate records in a new `certificates` table with the HMAC hash, and add a "Generate Certificate" button alongside existing export controls on the validation results page.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- TruQC header branding (logo + brand colors) with org name in the certificate body -- TruQC is the certifying platform, org is the certificate holder

### Claude's Discretion
- Button placement and UX flow (existing export dropdown pattern available as reference)
- Certificate eligibility criteria (pass-only vs pass+warnings)
- Download flow (immediate vs preview)
- Certificate storage/history approach (should consider Phase 33 downstream needs)
- Hash display prominence, format (full vs truncated), and visual treatment
- Hash input data scope (should provide meaningful tamper evidence)
- HMAC secret key storage approach (security best practices + Phase 33 needs)
- Additional fields beyond requirements (consider survey engineer audit trails)
- Signatory line approach
- Rules detail level (profile name vs full list)
- PDF filename convention
- Nearly all implementation details -- user trusts Claude to make domain-appropriate decisions
- Should design with Phase 33 (verification/QR/registry) in mind

### Deferred Ideas (OUT OF SCOPE)
- QR code on certificate linking to verification URL -- Phase 33 (CERT-03)
- Public verification page at /verify/{id} -- Phase 33 (CERT-04)
- Certificate registry with revocation support -- Phase 33 (CERT-05)
- Cell-level diff highlighting -- v1.2 (DVER-06)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CERT-01 | User can generate a QC Certificate PDF for a passed validation run | Certificate builder service + FastAPI endpoint + Next.js proxy + UI button; follows existing report PDF generation pattern exactly |
| CERT-02 | Certificate includes dataset name, validation date, rules applied, pass/fail summary, and unique HMAC-SHA256 hash | fpdf2 layout with branded sections; HMAC-SHA256 using Python stdlib hmac+hashlib over canonical JSON of certificate data; existing sign_payload pattern in webhooks.py |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| fpdf2 | >=2.8 | PDF certificate generation | Already used in report_builder.py; no new dependency |
| hmac (stdlib) | N/A | HMAC-SHA256 hash generation | Python standard library; already used in webhooks.py |
| hashlib (stdlib) | N/A | SHA256 digest algorithm | Python standard library; paired with hmac |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| PIL/Pillow | already installed | Logo image embedding in certificate | Same pattern as report_builder.py logo embedding |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| fpdf2 | ReportLab | ReportLab is more powerful but heavier; fpdf2 already in use and sufficient |
| fpdf2 | WeasyPrint | HTML-to-PDF approach; adds wkhtmltopdf dependency, not worth it for one page |

**Installation:**
```bash
# No new packages needed -- all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
backend/app/
  services/
    certificate_builder.py    # New: certificate PDF generation + HMAC signing
  routers/
    certificates.py           # New: FastAPI endpoint for certificate generation
src/
  app/api/
    certificates/
      route.ts                # New: Next.js proxy route
  components/files/
    export-buttons.tsx         # Modified: add certificate button
supabase/migrations/
    20260413_certificates.sql  # New: certificates table
```

### Pattern 1: Certificate Builder Service
**What:** A standalone service module (`certificate_builder.py`) that generates the certificate PDF and computes the HMAC hash. Parallel to `report_builder.py` but simpler (single-page formal document, no charts).
**When to use:** Always -- separates PDF layout from endpoint logic.
**Example:**
```python
# Source: Existing pattern in backend/app/services/report_builder.py
import hmac
import hashlib
import json
from fpdf import FPDF

def generate_certificate_pdf(cert_data: dict, logo_bytes: bytes | None = None) -> bytes:
    """Generate a QC Certificate PDF. Returns PDF bytes."""
    pdf = QCCertificate(logo_bytes=logo_bytes)
    pdf.alias_nb_pages()
    pdf.add_page()
    # ... layout sections ...
    return pdf.output()

def compute_certificate_hash(cert_data: dict, secret_key: str) -> str:
    """HMAC-SHA256 over canonical certificate data. Returns hex digest."""
    # Canonical JSON: sorted keys, no whitespace
    canonical = json.dumps(cert_data, sort_keys=True, separators=(",", ":"))
    return hmac.new(
        secret_key.encode("utf-8"),
        canonical.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
```

### Pattern 2: Next.js-to-FastAPI Proxy
**What:** Next.js API route authenticates user and verifies org access via Supabase, then proxies to FastAPI for PDF generation.
**When to use:** Always -- same pattern as existing `/api/reports/pdf/route.ts`.
**Example:**
```typescript
// Source: Existing pattern in src/app/api/reports/pdf/route.ts
// 1. Authenticate user via Supabase
// 2. Verify org role via requireOrgRole()
// 3. Verify validation run and dataset access via RLS
// 4. Proxy POST to FastAPI /api/v1/certificate/generate/{run_id}
// 5. Stream PDF response back to client
```

### Pattern 3: Database Record for Phase 33 Extensibility
**What:** Store each generated certificate in a `certificates` table so Phase 33 can add verification URLs and QR codes.
**When to use:** Always -- without stored records, Phase 33 cannot implement public verification.
**Example:**
```sql
CREATE TABLE public.certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES validation_runs(id) ON DELETE CASCADE NOT NULL,
  dataset_id UUID REFERENCES datasets(id) ON DELETE CASCADE NOT NULL,
  org_id UUID REFERENCES organisations(id) ON DELETE CASCADE NOT NULL,
  generated_by UUID REFERENCES auth.users(id) NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  dataset_name TEXT NOT NULL,
  validation_date TIMESTAMPTZ NOT NULL,
  rules_applied JSONB NOT NULL,         -- validation profile/rules summary
  pass_rate REAL NOT NULL,
  total_issues INTEGER NOT NULL DEFAULT 0,
  critical_count INTEGER NOT NULL DEFAULT 0,
  warning_count INTEGER NOT NULL DEFAULT 0,
  info_count INTEGER NOT NULL DEFAULT 0,
  verdict TEXT NOT NULL,                 -- 'PASS' or 'FAIL'
  hmac_hash TEXT NOT NULL,               -- HMAC-SHA256 hex digest
  -- Phase 33 extensions (nullable for now)
  verification_url TEXT,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT
);
```

### Anti-Patterns to Avoid
- **Generating hash client-side:** HMAC secret must never leave the server. Hash computation must happen in FastAPI backend only.
- **Non-canonical JSON for HMAC input:** If JSON key order changes, the hash changes. Always use `sort_keys=True, separators=(",", ":")` for deterministic output.
- **Coupling certificate layout to report layout:** Certificate is a formal 1-page document; don't try to reuse the multi-page QCReport class. Create a parallel QCCertificate subclass.
- **Skipping database record:** Without a stored record, Phase 33 verification is impossible. Always persist before returning PDF.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HMAC signing | Custom hash concatenation | `hmac.new()` from Python stdlib | Prevents timing attacks, standard implementation |
| PDF generation | HTML-to-PDF conversion | fpdf2 direct API | Already in stack, no browser/wkhtmltopdf dependency |
| Canonical JSON | Manual string building | `json.dumps(sort_keys=True, separators=(",",":"))` | Deterministic, standard approach |
| Timing-safe comparison | `==` operator for hash comparison | `hmac.compare_digest()` | Prevents timing side-channel attacks (needed in Phase 33 verification) |

**Key insight:** The entire certificate generation pipeline can be built from existing patterns and stdlib. No new libraries, no new infrastructure.

## Common Pitfalls

### Pitfall 1: HMAC Secret Key in Source Code
**What goes wrong:** Hard-coding the HMAC secret means anyone with code access can forge certificates.
**Why it happens:** Convenience during development.
**How to avoid:** Store as environment variable `CERTIFICATE_HMAC_SECRET`. Generate with `python -c "import secrets; print(secrets.token_hex(32))"`. Add to Railway env vars.
**Warning signs:** Any string literal that looks like a secret in certificate_builder.py.

### Pitfall 2: Non-Deterministic HMAC Input
**What goes wrong:** Same certificate data produces different hashes on different runs because JSON serialization order varies.
**Why it happens:** Python dicts maintain insertion order but that order may differ between construction paths.
**How to avoid:** Always construct a canonical dict with explicit key ordering, then `json.dumps(sort_keys=True, separators=(",",":"))`.
**Warning signs:** Hash verification fails for legitimately generated certificates.

### Pitfall 3: Unicode Characters in fpdf2
**What goes wrong:** Dataset names or rule descriptions containing Unicode characters cause encoding errors in Helvetica font.
**Why it happens:** fpdf2's built-in Helvetica font only supports Latin-1.
**How to avoid:** Use the existing `_sanitize()` function from `report_builder.py` for all text rendered in the PDF.
**Warning signs:** `UnicodeEncodeError` or garbled characters in generated PDFs.

### Pitfall 4: Certificate Eligibility Logic
**What goes wrong:** Users try to generate certificates for failed or in-progress validation runs, causing errors or meaningless certificates.
**Why it happens:** No guard on the "Generate Certificate" button.
**How to avoid:** Only show the button when `status === 'completed'` AND implement a policy on pass/fail eligibility (recommendation: allow for PASS runs only, where critical_count === 0).
**Warning signs:** Certificates generated for incomplete or failed runs.

### Pitfall 5: Missing org_id in Certificate Record
**What goes wrong:** Phase 33 cannot scope verification to organisations without org_id on the certificate.
**Why it happens:** Validation runs don't directly store org_id -- it's derived through dataset -> job -> project -> org chain.
**How to avoid:** Resolve org_id during certificate generation (from the user's profile/org membership) and store it directly on the certificate record.
**Warning signs:** Complex joins needed for Phase 33 queries.

## Code Examples

### HMAC-SHA256 Certificate Hash Generation
```python
# Source: Python stdlib hmac docs + existing webhooks.py pattern
import hmac
import hashlib
import json

def compute_certificate_hash(cert_data: dict, secret_key: str) -> str:
    """Compute HMAC-SHA256 over canonical certificate data.

    cert_data should contain: dataset_name, validation_date, rules_applied,
    pass_rate, total_issues, critical_count, warning_count, info_count,
    verdict, run_id, dataset_id.
    """
    canonical = json.dumps(cert_data, sort_keys=True, separators=(",", ":"))
    return hmac.new(
        secret_key.encode("utf-8"),
        canonical.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
```

### Certificate PDF Header Pattern
```python
# Source: Adapted from report_builder.py QCReport.header()
class QCCertificate(FPDF):
    def header(self):
        # TruQC branded top bar (same as QCReport)
        self.set_fill_color(*BRAND_DARK)
        self.rect(0, 0, 210, 14, "F")
        self.set_fill_color(*BRAND_TEAL)
        self.rect(0, 14, 210, 0.8, "F")

        self.set_y(3)
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(*WHITE)
        self.cell(0, 8, "TruQC  |  QC Validation Certificate", align="C")
        self.set_y(20)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "", 7)
        self.set_text_color(*BRAND_LIGHT)
        self.cell(0, 10, f"Generated by TruQC  |  truqc.co.uk", align="C")
```

### FastAPI Certificate Endpoint
```python
# Source: Adapted from backend/app/routers/reports.py pattern
@router.post("/certificate/generate/{run_id}")
def generate_certificate(run_id: str, body: CertificateRequest):
    # 1. Fetch validation run + issues + dataset
    # 2. Check eligibility (status=completed, critical_count=0)
    # 3. Build cert_data dict
    # 4. Compute HMAC hash
    # 5. Store certificate record in DB
    # 6. Generate PDF with hash embedded
    # 7. Return StreamingResponse with PDF
    pass
```

### Supabase Migration Pattern
```sql
-- Source: Follows existing migration patterns (20260412_notifications.sql)
CREATE TABLE public.certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES validation_runs(id) ON DELETE CASCADE NOT NULL,
  dataset_id UUID REFERENCES datasets(id) ON DELETE CASCADE NOT NULL,
  org_id UUID REFERENCES organisations(id) ON DELETE CASCADE NOT NULL,
  generated_by UUID REFERENCES auth.users(id) NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  dataset_name TEXT NOT NULL,
  validation_date TIMESTAMPTZ NOT NULL,
  rules_applied JSONB NOT NULL,
  verdict TEXT NOT NULL,
  pass_rate REAL NOT NULL,
  total_issues INTEGER NOT NULL DEFAULT 0,
  critical_count INTEGER NOT NULL DEFAULT 0,
  warning_count INTEGER NOT NULL DEFAULT 0,
  info_count INTEGER NOT NULL DEFAULT 0,
  hmac_hash TEXT NOT NULL,
  -- Phase 33 extensions
  verification_url TEXT,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  UNIQUE(run_id)  -- one certificate per validation run
);

ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view certificates for their org"
  ON public.certificates FOR SELECT
  USING (
    org_id IN (
      SELECT om.org_id FROM org_members om WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role full access to certificates"
  ON public.certificates FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Blockchain certificates | HMAC-SHA256 + verification endpoint | Industry standard | Equivalent tamper evidence without blockchain complexity (explicitly out of scope per REQUIREMENTS.md) |
| ReportLab for PDF | fpdf2 | Project established pattern | Lighter, faster, already in dependency tree |

**Deprecated/outdated:**
- None relevant -- fpdf2 2.8.x is current, Python hmac stdlib is stable

## Open Questions

1. **HMAC Hash Input Scope**
   - What we know: Hash must cover enough data to provide meaningful tamper evidence
   - What's unclear: Exact fields to include in the canonical JSON
   - Recommendation: Include run_id, dataset_id, dataset_name, validation_date, rules_applied, verdict, pass_rate, total_issues, critical_count, warning_count, info_count, certificate_id. This covers identity + results + integrity.

2. **Certificate for Pass-Only vs Pass+Warnings**
   - What we know: Survey QC certificates are meaningful only for datasets that "pass" quality checks
   - What's unclear: Whether warnings should disqualify certificate generation
   - Recommendation: Allow certificate generation only when `critical_count === 0` (verdict = PASS). Warnings are acceptable -- they represent noted but non-critical observations. This aligns with engineering practice where minor issues are acknowledged but don't invalidate the dataset.

3. **Re-generation Behavior**
   - What we know: `UNIQUE(run_id)` constraint means one certificate per validation run
   - What's unclear: Should users be able to regenerate/download an existing certificate?
   - Recommendation: If certificate already exists for a run, return the existing PDF (regenerated from stored data) rather than creating a new record. This ensures the hash remains stable.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest >=8.0 |
| Config file | backend/tests/conftest.py (exists) |
| Quick run command | `cd backend && python -m pytest tests/test_certificate_builder.py -x` |
| Full suite command | `cd backend && python -m pytest tests/ -x` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CERT-01 | Certificate PDF generation returns valid PDF bytes | unit | `cd backend && python -m pytest tests/test_certificate_builder.py::test_generate_certificate_pdf -x` | Wave 0 |
| CERT-01 | Certificate endpoint returns PDF for passed run | unit | `cd backend && python -m pytest tests/test_certificate_builder.py::test_certificate_endpoint_pass -x` | Wave 0 |
| CERT-01 | Certificate endpoint rejects non-passed run | unit | `cd backend && python -m pytest tests/test_certificate_builder.py::test_certificate_endpoint_rejects_fail -x` | Wave 0 |
| CERT-02 | PDF contains required fields (dataset name, date, rules, verdict, hash) | unit | `cd backend && python -m pytest tests/test_certificate_builder.py::test_certificate_contains_required_fields -x` | Wave 0 |
| CERT-02 | HMAC hash is deterministic for same input | unit | `cd backend && python -m pytest tests/test_certificate_builder.py::test_hmac_deterministic -x` | Wave 0 |
| CERT-02 | HMAC hash changes when data changes | unit | `cd backend && python -m pytest tests/test_certificate_builder.py::test_hmac_changes_on_tamper -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && python -m pytest tests/test_certificate_builder.py -x`
- **Per wave merge:** `cd backend && python -m pytest tests/ -x`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/test_certificate_builder.py` -- covers CERT-01, CERT-02
- [ ] Test fixtures for mock validation run data (can adapt from existing `test_report_builder.py` fixtures)

## Sources

### Primary (HIGH confidence)
- `backend/app/services/report_builder.py` -- existing fpdf2 PDF generation patterns, brand colors, QCReport class
- `backend/app/services/webhooks.py` -- existing HMAC-SHA256 sign_payload pattern
- `backend/app/routers/reports.py` -- existing FastAPI PDF endpoint pattern
- `src/app/api/reports/pdf/route.ts` -- existing Next.js proxy pattern with auth
- `src/components/files/export-buttons.tsx` -- existing export UI pattern
- `supabase/migrations/20260411_dataset_versions.sql` -- existing RLS pattern for org-scoped data
- [Python hmac docs](https://docs.python.org/3/library/hmac.html) -- stdlib HMAC-SHA256

### Secondary (MEDIUM confidence)
- [fpdf2 documentation](https://py-pdf.github.io/fpdf2/index.html) -- current version 2.8.7
- [HMAC-SHA256 best practices](https://www.authgear.com/post/generate-verify-hmac-signatures) -- secret key management

### Tertiary (LOW confidence)
- None -- all findings verified against existing codebase and official documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in project, no new dependencies
- Architecture: HIGH -- follows exact existing patterns from report generation
- Pitfalls: HIGH -- based on direct codebase inspection (Unicode handling, existing HMAC pattern)

**Research date:** 2026-04-13
**Valid until:** 2026-05-13 (stable domain, no fast-moving dependencies)
