---
phase: 33-validation-certificates-verification
plan: 01
subsystem: api
tags: [qrcode, fpdf2, certificates, revocation, verification, fastapi]

requires:
  - phase: 31-validation-certificates-basic
    provides: certificate_builder.py, certificates table, certificates router
provides:
  - QR code generation and PDF embedding (generate_certificate_qr, add_qr_to_certificate)
  - Certificate revocation endpoint (POST /certificates/{id}/revoke)
  - Public certificate verification endpoint (GET /certificates/{id}/verify)
  - Database migration for revocation columns and RLS policies
affects: [33-validation-certificates-verification]

tech-stack:
  added: [qrcode[pil]>=7.4]
  patterns: [public-endpoint-returns-200-always, revocation-filter-on-active-status]

key-files:
  created:
    - supabase/migrations/20260413_certificate_verification.sql
    - backend/tests/test_certificate_revocation.py
  modified:
    - backend/app/services/certificate_builder.py
    - backend/app/routers/certificates.py
    - backend/tests/test_certificate_builder.py
    - backend/requirements.txt

key-decisions:
  - "Verify endpoint returns 200 for all states (active/revoked/not_found) to prevent enumeration timing attacks"
  - "Revoked certificates omit dataset details, showing only ID, status, revoked_at, and reason"
  - "QR code positioned at (175, 15) with 25mm width, ERROR_CORRECT_M for balance of size and resilience"
  - "Cache-Control: no-store on all verify responses to prevent stale verification results"

patterns-established:
  - "Public endpoints return 200 with status field instead of HTTP error codes to prevent enumeration"
  - "Revocation uses filter on status=active so already-revoked certs naturally return 404"

requirements-completed: [CERT-03, CERT-05]

duration: 5min
completed: 2026-04-13
---

# Phase 33 Plan 01: Certificate Verification Backend Summary

**QR code embedding in certificate PDFs with qrcode library, revocation endpoint filtering on active status, and public verify endpoint returning 200 for all states**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-13T16:56:58Z
- **Completed:** 2026-04-13T17:02:20Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- QR code generation with qrcode[pil] library embedded at top-right of certificate PDF with "Scan to verify" caption and plain text URL
- Database migration adding status, revoked_at, revoked_by, revocation_reason columns with RLS policies for org member select and admin update
- Revocation endpoint that atomically updates status to revoked, rejecting already-revoked certificates with 404
- Public verification endpoint returning active details, revoked summary (no dataset info), or not_found status

## Task Commits

Each task was committed atomically:

1. **Task 1: Migration, QR code embedding, and test scaffolds** - `c97c230` (feat)
2. **Task 2: Revocation endpoint, public lookup, and revocation tests** - `09dbd2e` (feat)

## Files Created/Modified
- `backend/app/services/certificate_builder.py` - Added generate_certificate_qr() and add_qr_to_certificate() functions
- `backend/app/routers/certificates.py` - Added revoke_certificate and verify_certificate endpoints
- `supabase/migrations/20260413_certificate_verification.sql` - Revocation columns, index, and RLS policies
- `backend/tests/test_certificate_builder.py` - Extended with 4 QR code tests (12 total)
- `backend/tests/test_certificate_revocation.py` - 5 tests covering revocation and verification scenarios
- `backend/requirements.txt` - Added qrcode[pil]>=7.4

## Decisions Made
- Verify endpoint returns 200 for all states to prevent enumeration timing attacks
- Revoked certs omit dataset details per user decision in CONTEXT.md
- QR code at (175, 15) with 25mm width using ERROR_CORRECT_M
- Cache-Control: no-store on verify responses

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] PDF compression hiding text in tests**
- **Found during:** Task 1 (QR tests)
- **Issue:** fpdf2 default compression (FlateDecode) made text assertions fail since raw bytes are compressed
- **Fix:** Set pdf.set_compression(False) in QR embedding tests to allow byte-level text assertions
- **Files modified:** backend/tests/test_certificate_builder.py
- **Verification:** All QR text assertion tests pass
- **Committed in:** c97c230 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary for test correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend verification infrastructure complete
- Ready for frontend verification page (public /verify/{id} route) and certificate registry UI
- QR code embedding can be integrated into generate_certificate_pdf by calling add_qr_to_certificate(pdf, cert_id) before output

---
*Phase: 33-validation-certificates-verification*
*Completed: 2026-04-13*
