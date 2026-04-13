---
phase: 33-validation-certificates-verification
plan: 02
subsystem: ui
tags: [certificates, verification, revocation, nextjs, public-page, registry, reports]

requires:
  - phase: 33-validation-certificates-verification
    provides: certificate verification backend (GET /certificates/{id}/verify, POST /certificates/{id}/revoke)
  - phase: 31-validation-certificates-basic
    provides: certificate_builder.py, certificates table, certificates router
provides:
  - Public certificate verification page at /verify/{id} with active/revoked/not-found states
  - Certificate registry page under Reports with status filtering and admin revocation UI
  - Reports tab navigation (Reports | Certificates)
  - Certificate TypeScript types (Certificate, CertificateStatus, VerifyResponse)
affects: [33-validation-certificates-verification]

tech-stack:
  added: []
  patterns: [public-verify-page-three-states, reports-tab-layout, registry-table-with-admin-actions]

key-files:
  created:
    - src/app/(public)/verify/[id]/page.tsx
    - src/app/(public)/verify/[id]/copy-button.tsx
    - src/app/(dashboard)/reports/certificates/page.tsx
    - src/app/(dashboard)/reports/certificates/components/certificate-table.tsx
    - src/app/(dashboard)/reports/certificates/components/revoke-dialog.tsx
    - src/app/(dashboard)/reports/layout.tsx
    - src/app/(dashboard)/reports/reports-tab-nav.tsx
    - src/lib/types/certificate.ts
  modified: []

key-decisions:
  - "Public verify page uses server component with force-dynamic to ensure revocation is always current"
  - "Copy-to-clipboard button extracted as client component to keep verify page as server component"
  - "Reports tab navigation uses client component (reports-tab-nav.tsx) with usePathname for active state"

patterns-established:
  - "Public pages use TruQC branding with centered card layout, max-w-lg, mobile-friendly"
  - "Registry tables use client-side status filtering with dropdown row actions"

requirements-completed: [CERT-04, CERT-05]

duration: ~30min
completed: 2026-04-13
---

# Phase 33 Plan 02: Certificate Verification Frontend Summary

**Public /verify/{id} page with three-state rendering (active/revoked/not-found), certificate registry table with admin revocation dialog, and Reports tab navigation**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-04-13T17:02:20Z
- **Completed:** 2026-04-13T17:32:54Z
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files created:** 8

## Accomplishments
- Public certificate verification page at /verify/{id} showing green Verified badge with full dataset details for active certs, red Revoked badge with reason (no dataset details) for revoked certs, and neutral not-found message for unknown IDs
- Certificate registry page under /reports/certificates with filterable table (All/Active/Revoked), sortable by date, with row actions (Download PDF, Copy verify link, Revoke for admins)
- Revocation confirmation dialog with optional reason field and destructive styling
- Reports tab navigation layout enabling navigation between Reports and Certificates views
- TypeScript types for Certificate, CertificateStatus, and VerifyResponse

## Task Commits

Each task was committed atomically:

1. **Task 1: Types, public verify page, and reports tab layout** - `ea3ae2d` (feat)
2. **Task 2: Certificate registry table with revocation UI** - `b49e59b` (feat)
3. **Task 2.5: Fix fetch timeout on verify page** - `4a3968f` (fix)
4. **Task 3: Human-verify checkpoint** - approved by user

## Files Created/Modified
- `src/lib/types/certificate.ts` - Certificate, CertificateStatus, and VerifyResponse TypeScript types
- `src/app/(public)/verify/[id]/page.tsx` - Public verification page with three-state rendering (active/revoked/not-found)
- `src/app/(public)/verify/[id]/copy-button.tsx` - Client component for copy-to-clipboard on certificate hash
- `src/app/(dashboard)/reports/layout.tsx` - Reports section layout with tab navigation
- `src/app/(dashboard)/reports/reports-tab-nav.tsx` - Client component for Reports/Certificates tab navigation with active state
- `src/app/(dashboard)/reports/certificates/page.tsx` - Server component with auth check, fetches certificates for org
- `src/app/(dashboard)/reports/certificates/components/certificate-table.tsx` - Registry table with status filter, sorting, dropdown row actions
- `src/app/(dashboard)/reports/certificates/components/revoke-dialog.tsx` - Revocation confirmation dialog with optional reason

## Decisions Made
- Public verify page uses server component with force-dynamic to ensure revocation status is always current
- Copy-to-clipboard button extracted as separate client component to keep verify page as server component
- Reports tab navigation uses client component with usePathname for active tab detection

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added fetch timeout to prevent hanging on verify page**
- **Found during:** Post-Task 2
- **Issue:** Certificate verify fetch had no timeout, could hang indefinitely if backend is slow/unreachable
- **Fix:** Added timeout to fetch request on the verify page
- **Files modified:** src/app/(public)/verify/[id]/page.tsx
- **Committed in:** 4a3968f

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary for reliability. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Full certificate verification flow complete (backend + frontend)
- Phase 33 complete: QR codes in PDFs, public verification, registry with revocation
- Ready for Phase 35 (custom rule builder) or other v1.1 phases

## Self-Check: PASSED

All 8 created files verified on disk. All 3 commits (ea3ae2d, b49e59b, 4a3968f) verified in git log.

---
*Phase: 33-validation-certificates-verification*
*Completed: 2026-04-13*
