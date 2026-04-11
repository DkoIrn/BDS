# TruQC

## What This Is

A production QC platform for pipeline and seabed survey data. Engineers upload survey datasets (CSV, Excel, GeoJSON, Shapefile, KML, LandXML, DXF), and the platform validates data against configurable domain-specific rule packs, surfaces AI-prioritised issues with clustering and recommendations, enables one-click fixes, and generates branded client-grade PDF reports. Built as a vertical SaaS targeting survey/engineering companies who currently perform QC manually.

## Core Value

Engineers can upload survey data and receive automated QC reports with every flagged issue explained — replacing hours of manual checking with minutes of automated validation.

## Requirements

### Validated

- Authentication (email/password, OTP signup, password reset, sessions) — v1.0
- Project/job/dataset hierarchy with file management — v1.0
- File upload and storage (CSV, Excel, 6 spatial formats, max 50MB) — v1.0
- Rule-based QC validation with 10+ validators and domain QC packs — v1.0
- Statistical anomaly detection (outliers, spikes, missing data, KP drift, segment continuity) — v1.0
- Explainable flags with plain-English explanations on every issue — v1.0
- 6-stage guided pipeline workflow (Import → Inspect → Validate → Triage → Clean → Export) — v1.0
- AI issue prioritisation, clustering, and accept/reject recommendations — v1.0
- One-click data fixes (interpolation, deduplication, spike smoothing) with undo — v1.0
- Results dashboard with severity grouping, statistics, and processing history — v1.0
- Client-grade PDF reports (Executive/Technical) with company branding — v1.0
- Multi-user roles (Admin/Reviewer/Viewer) with org-scoped access — v1.0
- Enterprise REST API with key management and webhooks — v1.0
- Spatial QC map overlay with issue markers and heatmap — v1.0
- Audit trail with row-level traceability — v1.0
- Format conversion, CRS transform, merge tools — v1.0
- Usage tracking with tier enforcement — v1.0
- Guided onboarding tour with demo dataset — v1.0
- Landing page with 3-tier pricing — v1.0

### Active

- [ ] Job queue with retry/recovery (replace fire-and-forget with reliable workers)
- [ ] Dataset versioning (snapshot per validation run, version diff UI)
- [ ] Validation certificates (QC Certificate PDF with unique hash)
- [ ] Finish collaboration (notifications, activity feed, resolve comments)
- [ ] Multi-file cross-dataset validation (as-laid vs as-built comparison)
- [ ] Custom rule builder (simple UI: column comparisons, thresholds, conditions)
- [ ] Context-aware QC (water depth thresholds, event-conditional rules)
- [ ] Trial conversion mechanics (nudges, soft locks, value emails)
- [ ] Landing page conversion optimisation (demo preview, social proof)
- [ ] Split tool completion (KP range and column value modes, ZIP download)

### Out of Scope

- Raw sensor processing — platform validates survey deliverables, not raw instrument data
- Real-time vessel data integration — different product category
- Mobile app — web-first, responsive design covers tablet use
- Video/image annotation for ROV data — different product with massive storage needs
- Full scripting engine for custom rules — simple UI-based rule builder first

## Context

- **Stack**: Next.js 16 (Vercel) + FastAPI (Railway) + Supabase (auth/db/storage)
- **LOC**: ~46,700 (TypeScript + Python)
- **Domain**: Pipeline/seabed survey data (DOB, DOC, TOP, event listings, position data)
- **Target**: Small survey/engineering companies without automated QC
- **Team**: Solo developer
- **Deployed**: truqc.co.uk (Vercel frontend, Railway backend)
- **Custom SMTP**: Resend for transactional emails

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Next.js + Vercel | SSR, Supabase integration, fast deploys | Good |
| Python/FastAPI for processing | Superior for data processing, pandas, statistics | Good |
| Supabase for backend | Auth + DB + Storage in one, simple RLS | Good |
| Rule-based QC first, AI later | Validates market without ML complexity | Good |
| Domain QC packs over generic templates | Pipeline/As-Built/Pre-Comm packs match real workflows | Good |
| fpdf2 over WeasyPrint | No system deps, works on Railway without Docker config | Good |
| SECURITY DEFINER for RLS | Avoids recursive policy references in org-scoped RLS | Good |
| Service role client for API | API key auth bypasses cookie-based RLS cleanly | Good |
| Canvas renderer for map | Performance with 500+ markers | Good |
| Deterministic clustering | Top blockers shown instantly, AI narrative loads async | Good |

## Constraints

- **File size**: Max 50MB uploads
- **Processing**: Async fire-and-forget (to be replaced with job queue in v1.1)
- **Auth**: Supabase Auth (email/password + OTP)
- **Timeline**: Continuous development, solo

---
*Last updated: 2026-04-11 after v1.0 milestone*
