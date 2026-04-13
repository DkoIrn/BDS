# Phase 31: Validation Certificates (Basic) - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can generate a tamper-evident QC certificate PDF that proves a dataset passed validation. Certificate includes dataset name, validation date, rules applied, pass/fail summary, and a unique HMAC-SHA256 hash. This phase covers basic certificate generation and download only — public verification URLs, QR codes, and certificate registry are Phase 33.

</domain>

<decisions>
## Implementation Decisions

### Certificate PDF Layout
- TruQC header branding (logo + brand colors) with org name in the certificate body — TruQC is the certifying platform, org is the certificate holder
- All other layout decisions at Claude's discretion: style (formal vs branded report), page count strategy, visual hierarchy

### Generate Button & Flow
- Button placement and UX flow at Claude's discretion — existing export dropdown pattern available as reference
- Certificate eligibility criteria (pass-only vs pass+warnings) at Claude's discretion based on survey QC domain
- Download flow (immediate vs preview) at Claude's discretion based on existing export patterns
- Certificate storage/history approach at Claude's discretion — should consider Phase 33 downstream needs (verification URLs require stored records)

### HMAC Hash Presentation
- Hash display prominence, format (full vs truncated), and visual treatment at Claude's discretion
- Hash input data scope at Claude's discretion — should provide meaningful tamper evidence for survey QC
- HMAC secret key storage approach at Claude's discretion based on security best practices and Phase 33 needs

### Certificate Data Scope
- Required fields: dataset name, validation date, rules applied, pass/fail summary, HMAC-SHA256 hash
- Additional fields beyond requirements at Claude's discretion — consider what survey engineers need for audit trails
- Signatory line approach at Claude's discretion
- Rules detail level (profile name vs full list) at Claude's discretion
- PDF filename convention at Claude's discretion

### Claude's Discretion
- Nearly all implementation details — user trusts Claude to make domain-appropriate decisions
- Key constraint: TruQC branding in header + org name in body (the one locked decision)
- Should design with Phase 33 (verification/QR/registry) in mind as downstream consumer
- Should follow existing QC report PDF patterns where appropriate (fpdf2, brand colors)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/services/report_builder.py`: QCReport class (fpdf2-based) with brand colors, logo embedding, severity charts — can extend or parallel for certificates
- `backend/app/services/chart_builder.py`: Matplotlib chart generation for reports
- `src/components/files/export-buttons.tsx`: Export dropdown with PDF/CSV/XLSX options — natural integration point for certificate button
- `src/app/api/reports/pdf/route.ts`: Next.js API route for PDF report generation — pattern for certificate endpoint
- `backend/app/routers/reports.py`: FastAPI report generation endpoint — pattern for certificate endpoint

### Established Patterns
- fpdf2 for PDF generation with custom FPDF subclass (QCReport)
- Brand colors defined as RGB tuples (BRAND_DARK, BRAND_TEAL, etc.)
- Logo embedding from raw bytes with PIL
- Next.js API route proxies to FastAPI backend for PDF generation
- Export dropdown with mode selection (executive/technical)
- Supabase Storage for file storage (datasets bucket)

### Integration Points
- `backend/app/routers/` — new certificate endpoint (POST /certificates/generate or similar)
- `src/app/api/` — Next.js API route proxy for certificate generation
- `src/components/files/export-buttons.tsx` or results page — add certificate generation trigger
- `supabase/migrations/` — certificates table if storing records (consider Phase 33 needs)
- `backend/app/services/` — new certificate builder service (parallel to report_builder.py)
- `dataset_versions` table — certificates reference version snapshots and could use content hashes

</code_context>

<specifics>
## Specific Ideas

- Both TruQC and org should appear: TruQC as platform authority in header, org name in certificate body as the holder
- Phase 33 adds QR codes, public verification URLs, and certificate registry — design the data model to accommodate these extensions
- Existing QC report PDF is a mature reference for fpdf2 patterns, brand consistency, and PDF generation flow
- HMAC should cover enough data to be meaningful tamper evidence — not just cosmetic

</specifics>

<deferred>
## Deferred Ideas

- QR code on certificate linking to verification URL — Phase 33 (CERT-03)
- Public verification page at /verify/{id} — Phase 33 (CERT-04)
- Certificate registry with revocation support — Phase 33 (CERT-05)
- Cell-level diff highlighting — v1.2 (DVER-06)

</deferred>

---

*Phase: 31-validation-certificates-basic*
*Context gathered: 2026-04-13*
