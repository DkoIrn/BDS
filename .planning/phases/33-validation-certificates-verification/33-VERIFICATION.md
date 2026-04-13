---
phase: 33-validation-certificates-verification
verified: 2026-04-13T20:15:00Z
status: human_needed
score: 7/7 must-haves verified
re_verification: true
re_verification_meta:
  previous_status: gaps_found
  previous_score: 6/7
  gaps_closed:
    - "Download PDF now calls GET /api/v1/certificates/{certId}/download which maps to the new backend GET /certificates/{cert_id}/download endpoint — method, ID type, and no-body requirement all align"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Complete end-to-end revocation flow"
    expected: "Admin revokes a certificate via registry dialog, then visits /verify/{id} and sees red Revoked badge with no dataset details"
    why_human: "Requires live Supabase, live backend, and active session — cannot verify programmatically"
  - test: "QR code scan"
    expected: "Scanning the QR code on a generated PDF opens the correct /verify/{id} URL in a browser"
    why_human: "Requires physical PDF generation and a QR code scanner"
  - test: "Non-admin user sees no Revoke action in registry"
    expected: "A user with viewer role sees Download PDF and Copy verify link but no Revoke option"
    why_human: "Requires live auth session with a specific org role"
  - test: "Download PDF from registry"
    expected: "Clicking Download PDF on a certificate row fetches the PDF via GET and the browser initiates a file download"
    why_human: "Requires live backend with a real certificate record stored in the database; window.open behaviour cannot be verified programmatically"
---

# Phase 33: Validation Certificates Verification — Final Re-Verification Report

**Phase Goal:** Anyone can independently verify the authenticity of a QC certificate without needing a TruQC account. Covers CERT-03 (QR code on certificate PDF), CERT-04 (public /verify/{id} page), CERT-05 (certificate registry with revocation).
**Verified:** 2026-04-13T20:15:00Z
**Status:** human_needed — all 7/7 automated checks pass; 4 items require live environment confirmation
**Re-verification:** Yes — third pass, after download PDF gap closure

---

## Re-verification Summary

| Gap from Previous Verification | Result |
|-------------------------------|--------|
| QR code not called in generate_certificate_pdf() | CLOSED (pass 2) |
| Field name mismatch validated_at / issue_count vs backend | CLOSED (pass 2) |
| Download PDF — GET vs POST, cert_id vs run_id mismatch | CLOSED (this pass) |

All three gaps are now fully closed. No regressions detected.

### Download PDF Fix Detail

Previous state: `window.open` issued GET to `/api/v1/certificate/generate/{certId}`, which is a `POST` endpoint expecting a `run_id` (not a cert UUID) and a JSON body with `user_id`/`org_id`/`org_name`.

Current state:
- Frontend (`certificate-table.tsx` line 78): `window.open(`${fastApiUrl}/api/v1/certificates/${certId}/download`, "_blank")`
- Backend (`certificates.py` line 211): `@router.get("/certificates/{cert_id}/download")` — looks up the cert by UUID, fetches org name, reconstructs `cert_data` from stored columns, regenerates PDF via `generate_certificate_pdf()`, and returns a `StreamingResponse` with `Content-Disposition: attachment`.
- Method: GET/GET — aligned
- ID type: cert UUID / cert UUID — aligned
- Request body: none required — aligned

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | QR code is embedded in certificate PDF at top-right with verify URL | VERIFIED | `add_qr_to_certificate(pdf, cert_id)` called at line 247 of `generate_certificate_pdf()`; `generate_certificate_qr()` at line 73 creates QR from `https://truqc.co.uk/verify/{id}` |
| 2 | Certificate revocation updates status to revoked with timestamp and reason | VERIFIED | `revoke_certificate()` sets `status='revoked'`, `revoked_at=now()`, `revoked_by`, `revocation_reason`; filters `.eq("status","active")` |
| 3 | Revoked certificates cannot be revoked again | VERIFIED | `.eq("status","active")` filter returns empty result for already-revoked cert; `if not result.data` raises 404 |
| 4 | Certificate lookup returns valid, revoked, or not-found states | VERIFIED | `verify_certificate()` returns three distinct JSON shapes; `Cache-Control: no-store` set on all responses |
| 5 | Anyone can visit /verify/{id} without authentication and see certificate status | VERIFIED | `force-dynamic` server component, no auth check, public layout, `no-store` fetch |
| 6 | Valid certificate shows green Verified badge with dataset details | VERIFIED | Verify page reads `data.validation_date` (line 109) and `data.total_issues` (line 116) — matches backend response fields; `VerifyResponse` type declares same field names |
| 7 | Admin can revoke a certificate from the registry table and Download PDF works | VERIFIED | Revoke and Copy verify link confirmed in previous passes; Download PDF now calls `GET /api/v1/certificates/{certId}/download` which maps directly to the new backend `GET /certificates/{cert_id}/download` endpoint |

**Score: 7/7 truths verified**

---

## Required Artifacts

### Plan 33-01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/services/certificate_builder.py` | QR code generation and PDF embedding | VERIFIED | `generate_certificate_qr()` at line 73, `add_qr_to_certificate()` at line 95, called from `generate_certificate_pdf()` at line 247 |
| `backend/app/routers/certificates.py` | Revocation endpoint, download endpoint, and public lookup | VERIFIED | `GET /certificates/{cert_id}/download` (line 211), `POST /certificates/{cert_id}/revoke` (line 280), `GET /certificates/{cert_id}/verify` (line 319) — all implemented and registered |
| `supabase/migrations/20260413_certificate_verification.sql` | Revocation columns and RLS policies | VERIFIED | `status`, `revoked_at`, `revoked_by`, `revocation_reason` columns; `idx_certificates_id_status` index; RLS policies |
| `backend/tests/test_certificate_builder.py` | QR code unit tests | VERIFIED | 4 QR-specific tests covering PIL image return, dimensions, Scan-to-verify text, URL embedding |
| `backend/tests/test_certificate_revocation.py` | Revocation logic tests | VERIFIED | 5 tests: revoke active, revoke already-revoked (404), verify active, verify revoked, verify unknown |

### Plan 33-02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/(public)/verify/[id]/page.tsx` | Public certificate verification page | VERIFIED | `force-dynamic`, server fetch to `/api/v1/certificates/${id}/verify`, three render states, reads `validation_date` and `total_issues` |
| `src/app/(dashboard)/reports/certificates/page.tsx` | Certificate registry page | VERIFIED | Auth check, org query, certificate fetch, maps to `Certificate` type, passes `isAdmin` |
| `src/app/(dashboard)/reports/certificates/components/certificate-table.tsx` | Registry table with actions | VERIFIED | 247 lines, status filter tabs, sortable date column, Copy/Revoke work, Download PDF calls `GET /api/v1/certificates/{certId}/download` |
| `src/app/(dashboard)/reports/certificates/components/revoke-dialog.tsx` | Revocation confirmation dialog | VERIFIED | 122 lines, POSTs to backend with reason, loading state, toast on success/error, `router.refresh()` |
| `src/lib/types/certificate.ts` | Certificate TypeScript types | VERIFIED | `Certificate` uses `validation_date`/`total_issues` matching backend; `VerifyResponse` declares same field names |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `certificate_builder.py` | qrcode library | `generate_certificate_qr()` using `QRCode()` | WIRED | `qr.make_image().get_image()` returns PIL Image |
| `generate_certificate_pdf()` | `add_qr_to_certificate()` | direct call at line 247 | WIRED | Called after `pdf.add_page()`, before any content rendering |
| `backend/app/routers/certificates.py` | certificates table | `.update().eq("status","active").execute()` | WIRED | Revocation update filters on active status |
| `src/app/(public)/verify/[id]/page.tsx` | `backend GET /certificates/{id}/verify` | `fetch` at `${backendUrl}/api/v1/certificates/${id}/verify` | WIRED | Server component fetch with `AbortSignal.timeout(5000)` |
| `VerifyResponse` type | backend response shape | field names `validation_date` / `total_issues` | WIRED | Type matches backend wire format |
| `certificate-table.tsx` | `backend POST /certificates/{id}/revoke` | fetch in `RevokeDialog` | WIRED | Direct fetch with `user_id`, `org_id`, `reason` in body |
| `certificate-table.tsx` | `backend GET /certificates/{cert_id}/download` | `window.open` GET to `/api/v1/certificates/${certId}/download` | WIRED | Method (GET/GET), ID type (cert UUID/cert UUID), no body required — all aligned |
| `reports/layout.tsx` | certificates page | `ReportsTabNav` with `usePathname` | WIRED | Tab nav links `/reports` and `/reports/certificates` with active state detection |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CERT-03 | 33-01 | Certificate PDF includes a QR code linking to a public verification URL | VERIFIED | `add_qr_to_certificate()` called from `generate_certificate_pdf()` at line 247; encodes `https://truqc.co.uk/verify/{id}` |
| CERT-04 | 33-02 | Anyone can verify a certificate at /verify/{id} without authentication | VERIFIED | `force-dynamic` public page, no auth check, reads `validation_date`/`total_issues` matching backend |
| CERT-05 | 33-01, 33-02 | Certificate records are stored in a registry with revocation support | VERIFIED | Migration adds revocation columns; registry page displays certificates; revoke endpoint works; Download PDF endpoint exists and is correctly wired |

---

## Anti-Patterns Found

None. The previously identified blocker (handleDownload method/ID mismatch) is resolved. No new anti-patterns detected.

---

## Human Verification Required

### 1. End-to-End Revocation Flow

**Test:** With a live backend and Supabase, generate a certificate, revoke it via the registry dialog, then open /verify/{id} for that certificate.
**Expected:** Page shows red Revoked badge with revocation date and reason. No dataset details shown.
**Why human:** Requires live database, auth session, and backend connectivity.

### 2. QR Code in PDF

**Test:** Generate a certificate PDF and scan the QR code with a phone.
**Expected:** QR code is visible at top-right of the certificate page and scanning it opens https://truqc.co.uk/verify/{id} in the browser.
**Why human:** Requires physical PDF rendering and a QR code scanner.

### 3. Admin vs Non-Admin Registry Actions

**Test:** Log in as a non-admin user, navigate to /reports/certificates, open the row actions dropdown.
**Expected:** Sees Download PDF and Copy verify link but no Revoke option and no separator.
**Why human:** Requires live auth session with a specific org role.

### 4. Download PDF from Registry

**Test:** Log in as any user, navigate to /reports/certificates, click the "..." dropdown on any certificate row, click "Download PDF".
**Expected:** Browser opens a new tab which immediately triggers a PDF file download named `TruQC-Certificate-{dataset}-{date}.pdf`.
**Why human:** `window.open` behaviour and streaming file download cannot be verified programmatically; requires a live backend with a real certificate record.

---

## Summary

All three automated gaps from previous verification runs are now fully closed. The codebase passes all 7 observable truths and all key links are wired end-to-end. The remaining 4 items are standard human-validation checkpoints that require a live environment — none of them indicate a code-level defect.

Phase 33 is ready for human sign-off.

---

_Verified: 2026-04-13T20:15:00Z_
_Verifier: Claude (gsd-verifier)_
