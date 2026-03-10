# SurveyQC AI

## What This Is

An AI-powered data QA & validation platform for pipeline and seabed survey data. Engineers upload survey datasets (CSV, Excel), and the platform automatically detects anomalies, validates data against configurable rules, cleans data to client specifications, and generates downloadable GC reports. Built as a vertical SaaS targeting smaller survey/engineering companies who currently perform these checks manually.

## Core Value

Engineers can upload survey data and receive automated QC reports with every flagged issue explained — replacing hours of manual checking with minutes of automated validation.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- Current scope. Building toward these. -->

- [ ] User authentication (email/password) via Supabase Auth
- [ ] Project/job structure (project → survey job → datasets → reports)
- [ ] File upload and storage (CSV, Excel, max 50MB) via Supabase Storage
- [ ] Rule-based QC validation with default and custom validation profiles
- [ ] Anomaly detection (statistical outliers, spikes, missing data, tolerance violations, event mismatches)
- [ ] Explainable flags on every detected issue
- [ ] Results dashboard with in-browser viewing of flagged issues and statistics
- [ ] Downloadable outputs: cleaned datasets, GC reports, anomaly reports
- [ ] Validation rule templates (pipeline survey, engineering measurements, custom)
- [ ] Async processing with notification when complete
- [ ] 3-tier subscription model (Starter, Professional, Enterprise)
- [ ] Vibrant yet professional UI (Deep Blue #1E3A8A, Teal #14B8A6, Orange #F97316)

### Out of Scope

- Raw sensor processing — platform validates survey deliverables, not raw instrument data
- Custom ML models — rule-based and statistical methods first, ML layered on later
- Advanced file formats (shapefiles, LAS/LiDAR, GIS exports) — future versions
- Coordinate transformations — later feature
- Real-time chat/support widget — not needed for MVP
- Mobile app — web-first
- Payment processing — evaluate after MVP (Stripe integration later)
- Magic link / OAuth login — email/password for MVP, Google login later
- API access — Enterprise tier, post-MVP

## Context

- **Domain**: Pipeline and seabed survey data — includes Depth of Burial (DOB), Depth of Cover (DOC), Top of Pipe (TOP), event listings, pipeline position data, survey line measurements, ROV inspection data exports
- **Target users**: Small survey/engineering companies without AI solutions, still doing QC manually
- **Key insight**: The first version does NOT need AI to be valuable. Rule-based QC + anomaly detection already solves a real problem. AI can be layered on later
- **Prior experience**: User has completed a 6-phase project previously; main hurdle was sign-in page implementation — needs to be simple and effective
- **Processing approach**: Statistical methods and rule-based validation first, AI APIs (OpenAI/Claude) later for enhanced analysis
- **Explainability**: Critical for engineers reviewing GC — every flag must include a clear explanation

## Constraints

- **Tech stack**: Next.js (frontend) + Python/FastAPI (processing backend) + Supabase (auth/db/storage) + Vercel (hosting)
- **Timeline**: 2 months to MVP
- **Team**: Solo developer
- **File size**: Max 50MB uploads for MVP
- **Processing**: Async — upload → queue → process → notify user
- **Auth**: Supabase Auth for simplicity (handles login, password reset, sessions, security)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Next.js + Vercel | Natural pairing, SSR support, good Supabase integration | — Pending |
| Python/FastAPI for processing | Python far superior for CSV processing, pandas, statistics, future ML | — Pending |
| Supabase for backend | Auth + DB + Storage in one, simple integration, recommended by peer | — Pending |
| Rule-based QC first, AI later | Solves real problem without AI complexity, validates market first | — Pending |
| Async processing | Prevents browser freezing, better UX for large files | — Pending |
| 3-tier subscription | Starter/Professional/Enterprise covers SMB to larger companies | — Pending |
| Brand palette: Blue/Teal/Orange | Blue = trust/engineering, Teal = tech/data, Orange = highlights/anomalies | — Pending |

---
*Last updated: 2026-03-10 after initialization*
