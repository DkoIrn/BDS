# Phase 33: Validation Certificates (Verification) - Research

**Researched:** 2026-04-13
**Domain:** QR code generation, public verification pages, certificate registry with revocation
**Confidence:** HIGH

## Summary

Phase 33 adds three capabilities on top of Phase 31's basic certificate generation: (1) QR codes embedded in certificate PDFs linking to a public verification URL, (2) a public `/verify/{id}` page accessible without authentication, and (3) a certificate registry with revocation support. The technical stack is straightforward -- the `qrcode` Python library integrates directly with the existing fpdf2 PDF generation pipeline, the public page lives in the existing `(public)` Next.js route group, and the registry is a standard Supabase table with RLS policies following established patterns.

Phase 31 (not yet executed) will create the `certificates` table and basic PDF generation service. Phase 33 must either extend that schema with revocation columns or, if Phase 31 hasn't run yet, plan the complete schema. The research identifies the expected Phase 31 outputs and what Phase 33 adds on top.

**Primary recommendation:** Use the `qrcode` Python library (the only dependency needed) with fpdf2's `pdf.image()` method for QR embedding. Build the verify page as a Next.js server component in `(public)/verify/[id]/page.tsx`. Add revocation columns to the certificates table via a new Supabase migration.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Public verify page shows: TruQC logo, green "Verified" badge, dataset name, validation date, rules applied, issue count, pass rate, certificate hash, issuing organisation, certificate ID (when valid)
- Revoked state: red "Revoked" badge with revocation date and note, no dataset details shown
- Unknown/not found: neutral message safe against enumeration
- TruQC branded page with logo, brand colours, footer "Powered by TruQC -- truqc.co.uk"
- Lives under existing `(public)` route group -- no authentication required
- QR code: top-right corner of first page, alongside TruQC logo on left
- QR encodes direct URL: `truqc.co.uk/verify/{id}`
- "Scan to verify" text below QR code plus plain text URL
- Generated using fpdf2 (existing PDF library)
- Revocation: admin only, permanent (no un-revoking), confirmation dialog with optional reason
- Revoke action in certificate registry table row menu (... dropdown)
- Registry lives under QC Reports as a sub-page/tab (Reports | Certificates)
- Registry table columns: Dataset name, Validation date, Result (pass/fail), Status (active/revoked), Issued by, Certificate ID (truncated), Actions menu
- Sortable by date, status filter (All / Active / Revoked), no search/date filter
- Row actions: Download PDF, Copy verify link, Revoke (admin only)

### Claude's Discretion
- QR code generation library choice (within fpdf2 or separate)
- QR code exact size and padding
- Certificate ID format (UUID vs shorter slug)
- Registry table pagination approach
- Verify page responsive layout details
- Database schema for certificate registry table

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CERT-03 | Certificate PDF includes a QR code linking to a public verification URL | QR code generation via `qrcode` library + fpdf2 `pdf.image()` integration; verified pattern from official fpdf2 docs |
| CERT-04 | Anyone can verify a certificate at /verify/{id} without authentication | Next.js `(public)` route group pattern already exists; server component fetches from Supabase using service role key (bypasses RLS) |
| CERT-05 | Certificate records are stored in a registry with revocation support | Supabase migration adds revocation columns; RLS policies follow established `get_user_org_role()` pattern; registry UI follows existing table patterns |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| fpdf2 | >=2.8 | PDF generation (already installed) | Existing project standard for all PDF output |
| qrcode | >=7.4 | QR code image generation | Official fpdf2 docs recommend this; lightweight, PIL-based |
| Pillow | (already installed) | Image processing for QR code | Required by qrcode[pil]; already a fpdf2 dependency |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Next.js App Router | (existing) | Public verify page routing | `(public)/verify/[id]/page.tsx` server component |
| Supabase JS Client | (existing) | Certificate lookup from verify page | Service role for public reads, user auth for registry |
| @supabase/ssr | (existing) | Server-side Supabase access | Verify page server component data fetch |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `qrcode` library | `segno` | segno is faster but less common; qrcode has official fpdf2 integration example |
| UUID certificate IDs | nanoid/short slugs | UUIDs are simpler (Supabase default), slugs look better in URLs but add collision risk |
| Next.js server component | FastAPI endpoint | Server component is simpler for a read-only page; no need for backend proxy |

**Installation (backend only):**
```bash
pip install qrcode[pil]
```

Add to `backend/requirements.txt`:
```
qrcode[pil]>=7.4
```

## Architecture Patterns

### Recommended Project Structure
```
backend/
  app/
    services/
      certificate_builder.py    # Phase 31 creates; Phase 33 adds QR code method
    routers/
      certificates.py           # Phase 31 creates; Phase 33 adds revocation endpoint

src/
  app/
    (public)/
      verify/
        [id]/
          page.tsx              # Public verification page (server component)
    (dashboard)/
      reports/
        certificates/
          page.tsx              # Certificate registry table
          components/
            certificate-table.tsx
            revoke-dialog.tsx

supabase/
  migrations/
    YYYYMMDD_certificate_verification.sql  # Revocation columns + public read policy
```

### Pattern 1: QR Code Embedding in fpdf2
**What:** Generate QR code as PIL image, embed directly into PDF
**When to use:** When adding QR code to certificate PDF
**Example:**
```python
# Source: https://py-pdf.github.io/fpdf2/Barcodes.html
import qrcode

def add_qr_code(pdf, verify_url: str, x: float, y: float, size: float = 25.0):
    """Add QR code to PDF at specified position."""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=2,
    )
    qr.add_data(verify_url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    # fpdf2 accepts PIL images directly via .get_image()
    pdf.image(img.get_image(), x=x, y=y, w=size)
```

### Pattern 2: Public Verification Page (Next.js Server Component)
**What:** Server component that fetches certificate data without requiring auth
**When to use:** The `/verify/{id}` page
**Example:**
```typescript
// src/app/(public)/verify/[id]/page.tsx
import { createClient } from '@supabase/supabase-js'

// Use service role key for public reads (bypasses RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function VerifyPage({ params }: { params: { id: string } }) {
  const { data: cert } = await supabase
    .from('certificates')
    .select('id, dataset_name, validated_at, rules_applied, issue_count, pass_rate, hmac_hash, org_name, status, revoked_at, revocation_reason')
    .eq('id', params.id)
    .single()

  if (!cert) return <UnknownCertificate />
  if (cert.status === 'revoked') return <RevokedCertificate cert={cert} />
  return <ValidCertificate cert={cert} />
}
```

### Pattern 3: RLS for Certificate Registry (Org-Scoped Read, Admin Revoke)
**What:** Follow existing `get_user_org_role()` pattern for registry access
**When to use:** Supabase migration for certificates table policies
**Example:**
```sql
-- Org members can view certificates in their org
CREATE POLICY "Org members can view certificates"
  ON public.certificates FOR SELECT
  USING (get_user_org_role(org_id) IS NOT NULL);

-- Only admins can update (revoke) certificates
CREATE POLICY "Admins can revoke certificates"
  ON public.certificates FOR UPDATE
  USING (get_user_org_role(org_id) = 'admin');

-- Public read for verification (service role bypasses RLS, but
-- alternatively use a Postgres function with SECURITY DEFINER)
```

### Anti-Patterns to Avoid
- **Exposing sensitive data on verify page:** Only show summary fields (name, date, pass rate). Never expose raw issue details or dataset contents on the public page.
- **Client-side auth check for revocation:** Use RLS policy (`get_user_org_role = 'admin'`), not frontend-only checks. The row action button can be hidden for non-admins, but the DB must enforce it.
- **Mutable certificate data:** Once issued, certificate content fields should be immutable. Only `status`, `revoked_at`, `revoked_by`, and `revocation_reason` should be updatable.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| QR code generation | Custom QR encoding algorithm | `qrcode` library | QR encoding is a complex standard; library handles error correction, sizing |
| Certificate ID in URL | Custom short-ID generator | UUID (Supabase default) | Avoids collision handling; UUIDs are unguessable (enumeration-safe) |
| PDF QR embedding | Save QR to temp file then embed | `pdf.image(img.get_image())` | fpdf2 accepts PIL images directly; no temp file needed |

**Key insight:** The entire QR-to-PDF pipeline is 5 lines of code using established libraries. The real complexity is in the database schema design and RLS policies, not the QR generation.

## Common Pitfalls

### Pitfall 1: Certificate Enumeration via Verify Endpoint
**What goes wrong:** Sequential or predictable IDs allow scraping all certificates
**Why it happens:** Using auto-increment IDs or short sequential slugs
**How to avoid:** Use UUID v4 (Supabase default). The 128-bit space makes brute-force enumeration infeasible. Return identical "not found" response for missing IDs (no timing difference).
**Warning signs:** Non-UUID IDs, different error messages for "exists but denied" vs "doesn't exist"

### Pitfall 2: QR Code Too Small to Scan
**What goes wrong:** QR code renders in PDF but phone cameras can't read it
**Why it happens:** Too small size, insufficient error correction, or too much data encoded
**How to avoid:** Use ERROR_CORRECT_M (15% recovery), minimum 25mm width in PDF, keep URL short (`truqc.co.uk/verify/{id}` -- about 60 chars with UUID). Test with actual phone camera.
**Warning signs:** QR code smaller than 20mm, URL longer than 100 characters

### Pitfall 3: Revocation Race Condition
**What goes wrong:** Admin revokes certificate while someone is viewing the verify page
**Why it happens:** Stale data in server component cache
**How to avoid:** Use `revalidate: 0` (or `dynamic = 'force-dynamic'`) on the verify page. Certificate verification must always show current status. No caching on this route.
**Warning signs:** Next.js static generation or ISR on the verify page

### Pitfall 4: Service Role Key Exposure
**What goes wrong:** `SUPABASE_SERVICE_ROLE_KEY` leaks to client bundle
**Why it happens:** Accidentally importing in client component or using `NEXT_PUBLIC_` prefix
**How to avoid:** Only use service role key in server components/API routes. The verify page MUST be a server component (no `'use client'` directive). Import supabase client inline or from a server-only module.
**Warning signs:** Key in any file with `'use client'`, key with `NEXT_PUBLIC_` prefix

### Pitfall 5: Phase 31 Schema Mismatch
**What goes wrong:** Phase 33 assumes Phase 31 schema that doesn't exist or differs
**Why it happens:** Phase 31 hasn't been executed yet
**How to avoid:** Phase 33 migration should use `ALTER TABLE IF EXISTS` or check column existence. Plan should explicitly document expected Phase 31 schema and handle the case where it needs adjustment.
**Warning signs:** Hard-coding column names without verifying Phase 31 output

## Code Examples

### QR Code Generation with fpdf2
```python
# Source: https://py-pdf.github.io/fpdf2/Barcodes.html (verified)
import qrcode
from fpdf import FPDF

def generate_certificate_qr(verify_url: str):
    """Generate QR code as PIL image for certificate PDF."""
    qr = qrcode.QRCode(
        version=1,  # auto-sizes based on data
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=2,  # minimal quiet zone
    )
    qr.add_data(verify_url)
    qr.make(fit=True)
    return qr.make_image(fill_color="black", back_color="white")


# In certificate PDF generation (extends Phase 31 certificate_builder.py):
def add_qr_to_certificate(pdf, certificate_id: str):
    """Add QR code and verify URL text to certificate first page."""
    verify_url = f"https://truqc.co.uk/verify/{certificate_id}"
    qr_img = generate_certificate_qr(verify_url)

    # Top-right corner, 25mm square
    page_width = 210  # A4
    qr_size = 25
    margin_right = 10
    x = page_width - qr_size - margin_right
    y = 15  # below header bar

    pdf.image(qr_img.get_image(), x=x, y=y, w=qr_size)

    # "Scan to verify" text below QR
    pdf.set_font("Helvetica", "", 7)
    pdf.set_text_color(100, 100, 100)
    pdf.set_xy(x - 5, y + qr_size + 1)
    pdf.cell(qr_size + 10, 4, "Scan to verify", align="C")
    pdf.set_xy(x - 5, y + qr_size + 5)
    pdf.set_font("Helvetica", "", 5)
    pdf.cell(qr_size + 10, 3, verify_url, align="C")
```

### Certificate Database Schema (Phase 33 additions)
```sql
-- Phase 33 migration: add revocation support to certificates table
-- Assumes Phase 31 created the base certificates table

ALTER TABLE public.certificates
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'revoked')),
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revoked_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS revocation_reason TEXT;

-- Index for public verification lookups
CREATE INDEX IF NOT EXISTS idx_certificates_id_status
  ON public.certificates(id, status);
```

### Revocation API Endpoint
```python
# backend/app/routers/certificates.py (Phase 33 addition)
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

class RevokeRequest(BaseModel):
    reason: str | None = None

@router.post("/certificates/{cert_id}/revoke")
def revoke_certificate(cert_id: str, body: RevokeRequest):
    """Revoke a certificate. Admin only (enforced by RLS)."""
    supabase = get_supabase_client()
    result = supabase.table("certificates").update({
        "status": "revoked",
        "revoked_at": "now()",
        "revoked_by": user_id,  # from auth context
        "revocation_reason": body.reason,
    }).eq("id", cert_id).eq("status", "active").execute()

    if not result.data:
        raise HTTPException(404, "Certificate not found or already revoked")
    return {"status": "revoked"}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Temp file for QR in PDF | `pdf.image(img.get_image())` direct PIL | fpdf2 2.7+ | No temp file cleanup needed |
| Custom QR rendering | `qrcode` library with PIL backend | Stable for years | 5 lines vs hundreds |
| Blockchain verification | HMAC-SHA256 + public endpoint | Industry trend | Same tamper evidence, zero complexity |

**Deprecated/outdated:**
- `pyfpdf` (original fpdf): Unmaintained. This project uses `fpdf2` which is the maintained fork.
- QR code via `reportlab`: Not needed; fpdf2 + qrcode is simpler and already the project's stack.

## Open Questions

1. **Phase 31 exact schema**
   - What we know: Phase 31 creates a `certificates` table with at minimum: id, dataset_id, run_id, org_id, hmac_hash, created_at, and certificate content fields
   - What's unclear: Exact column names and types (Phase 31 hasn't been planned/executed yet)
   - Recommendation: Phase 33 plan should define the expected Phase 31 schema interface and use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for revocation columns to be resilient

2. **Certificate ID format**
   - What we know: UUID is safe against enumeration, simpler to implement
   - What's unclear: Whether the verify URL should use the full UUID or a shorter format
   - Recommendation: Use UUID. It's 36 chars in the URL (`/verify/550e8400-e29b-41d4-a716-446655440000`) which fits comfortably in a QR code at ERROR_CORRECT_M level. Shorter slugs add unnecessary collision handling.

3. **Verify page data source**
   - What we know: Server component with service role key bypasses RLS
   - What's unclear: Whether to use service role key directly or a Postgres SECURITY DEFINER function
   - Recommendation: Use a dedicated Supabase function (`verify_certificate(cert_id)`) with SECURITY DEFINER that returns only the public-safe fields. This avoids exposing the service role key in application code and provides a clean API boundary.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 8.0+ (backend), existing Next.js test setup (frontend) |
| Config file | `backend/pytest.ini` or `pyproject.toml` |
| Quick run command | `cd backend && python -m pytest tests/test_certificate_builder.py -x` |
| Full suite command | `cd backend && python -m pytest tests/ -x` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CERT-03 | QR code embedded in certificate PDF at correct position with valid URL | unit | `cd backend && python -m pytest tests/test_certificate_builder.py::test_qr_code_in_pdf -x` | No -- Wave 0 |
| CERT-04 | Verify page returns valid/revoked/unknown states correctly | integration | Manual verification (Next.js server component) | No -- Wave 0 |
| CERT-05 | Revocation updates status, revoked certs show revoked on verify | unit + integration | `cd backend && python -m pytest tests/test_certificate_builder.py::test_revoke_certificate -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && python -m pytest tests/test_certificate_builder.py -x`
- **Per wave merge:** `cd backend && python -m pytest tests/ -x`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/test_certificate_builder.py` -- covers CERT-03 (QR generation unit tests)
- [ ] `backend/tests/test_certificate_revocation.py` -- covers CERT-05 (revocation logic)
- [ ] QR code library install: `pip install qrcode[pil]`

## Sources

### Primary (HIGH confidence)
- [fpdf2 Barcodes documentation](https://py-pdf.github.io/fpdf2/Barcodes.html) -- QR code integration pattern with `qrcode` library
- Existing codebase: `backend/app/services/report_builder.py` -- fpdf2 PDF generation patterns, brand colors, image embedding
- Existing codebase: `supabase/migrations/00012_organisations.sql` -- RLS policy patterns using `get_user_org_role()`
- Existing codebase: `src/app/(public)/layout.tsx` -- Public route group structure

### Secondary (MEDIUM confidence)
- Phase 31 CONTEXT.md -- Expected schema and integration points (Phase 31 not yet executed)
- [fpdf2 PyPI](https://pypi.org/project/fpdf2/) -- Version 2.8.7 confirmed current (2026-02-28)

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- fpdf2 + qrcode is documented and verified; existing patterns in codebase
- Architecture: HIGH -- follows established project patterns (public routes, RLS, fpdf2 services)
- Pitfalls: HIGH -- enumeration, QR sizing, and cache issues are well-documented concerns
- Phase 31 interface: MEDIUM -- Phase 31 not yet executed; schema is inferred from CONTEXT.md

**Research date:** 2026-04-13
**Valid until:** 2026-05-13 (stable libraries, no fast-moving dependencies)
