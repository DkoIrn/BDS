# Phase 33: Validation Certificates (Verification) - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Anyone can independently verify the authenticity of a QC certificate without needing a TruQC account. Covers CERT-03 (QR code on certificate PDF), CERT-04 (public /verify/{id} page), CERT-05 (certificate registry with revocation). Basic certificate generation (CERT-01, CERT-02) is Phase 31 — this phase adds the verification and management layer on top.

</domain>

<decisions>
## Implementation Decisions

### Public Verify Page
- Summary card with key details when valid: TruQC logo, green "Verified" badge, dataset name, validation date, rules applied, issue count, pass rate, certificate hash, issuing organisation, certificate ID
- Revoked state: red "Revoked" badge with revocation date and note ("This certificate has been revoked by the issuing organisation") — no dataset details shown for revoked certs
- Unknown/not found: neutral message ("No certificate found with this ID. It may have been issued on a different platform or the ID may be incorrect.") — safe against enumeration
- TruQC branded page with logo, brand colours, footer "Powered by TruQC — truqc.co.uk"
- Lives under existing `(public)` route group — no authentication required

### QR Code on Certificate PDF
- Top-right corner of the first page, alongside TruQC logo on the left
- Encodes direct URL: `truqc.co.uk/verify/{id}`
- "Scan to verify" text below QR code plus the URL in plain text for non-scanners
- Generated using fpdf2 (existing PDF library) — no new dependencies needed

### Revocation Flow
- Admin only — reviewers and viewers cannot revoke
- Revoke action lives in the certificate registry table row menu (... dropdown)
- Confirmation dialog with optional reason field (e.g., "Data found to be incorrect") — reason stored and displayed on verify page for revoked certs
- Revocation is permanent — no un-revoking. If data was correct, issue a new certificate

### Certificate Registry
- Lives under QC Reports as a sub-page/tab (Reports | Certificates)
- Table columns: Dataset name, Validation date, Result (pass/fail), Status (active/revoked), Issued by, Certificate ID (truncated), Actions menu
- Sortable by date
- Row actions: Download PDF, Copy verify link, Revoke (admin only)
- Status filter: All / Active / Revoked tabs/toggle — no search or date filter for now

### Claude's Discretion
- QR code generation library choice (within fpdf2 or separate)
- QR code exact size and padding
- Certificate ID format (UUID vs shorter slug)
- Registry table pagination approach
- Verify page responsive layout details
- Database schema for certificate registry table

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/services/report_builder.py`: fpdf2-based PDF generation with brand colours, charts — extend for certificate PDF with QR code
- `src/app/(public)/`: Existing public route group (privacy, terms) — add /verify/{id} here
- `src/app/(public)/layout.tsx`: Public page layout — reuse for verify page
- `backend/app/services/webhooks.py`: HMAC-SHA256 signing pattern — reference for certificate hash generation (Phase 31)

### Established Patterns
- fpdf2 for all PDF generation — no new PDF library needed
- Public routes under `(public)` group with their own layout
- Row-level security via `get_user_org_role()` — use for registry access control
- Dropdown menus for table row actions (existing pattern in team management, job history)

### Integration Points
- Phase 31 output: Certificate generation with HMAC-SHA256 hash — Phase 33 adds QR code to that PDF and builds the verification endpoint
- `src/components/top-navbar.tsx`: QC Reports nav item — add Certificates sub-navigation
- `supabase/migrations/`: Certificates table (from Phase 31) needs revocation columns (revoked_at, revoked_by, revocation_reason)
- Backend: New `/api/verify/{id}` or Next.js server component for public certificate lookup

</code_context>

<specifics>
## Specific Ideas

- Verify page should feel authoritative and professional — like a bank or government verification page. Clean, minimal, trust-building
- The QR code + plain text URL is "belt and suspenders" — works for both phone scanners and desktop users
- Revocation reason adds audit trail value — survey companies may need to explain to clients why a certificate was revoked

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 33-validation-certificates-verification*
*Context gathered: 2026-04-13*
