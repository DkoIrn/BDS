# Milestones

## v1.0 MVP (Shipped: 2026-04-11)

**Phases:** 28 (1-14, 16-28) | **Plans:** 64 | **Commits:** 390
**LOC:** 46,701 (TypeScript/Python) | **Timeline:** 32 days (2026-03-10 to 2026-04-11)
**Git range:** b9e32e2..d0cf405

**Key accomplishments:**
- Full authentication system with OTP signup, password reset, session management
- Project/job/dataset hierarchy with file upload (CSV, Excel, GeoJSON, Shapefile, KML, DXF, LandXML)
- Rule-based QC engine with 10+ validators, domain QC packs (As-Laid, As-Built, Pre-Commissioning)
- 6-stage guided pipeline workflow (Import, Inspect, Validate, Triage, Clean, Export)
- AI-powered issue prioritisation, clustering, and dataset accept/reject recommendations
- One-click data fixes (interpolation, deduplication, spike smoothing) with preview and undo
- Client-grade PDF reports (Executive/Technical modes) with company branding, Statement of Quality
- Multi-user roles (Admin/Reviewer/Viewer) with org-scoped RLS, comments, and approval workflow
- Enterprise REST API with key management, webhooks, and rate limiting
- Spatial QC map overlay with issue markers, heatmap, and dataset comparison
- Audit trail with row-level traceability and validation re-run capability
- Guided onboarding tour with demo dataset for first-time users
- Format conversion, CRS transform, merge, and data tools suite
- Interactive map visualiser (public, no auth required)
- Usage tracking with tier enforcement and upgrade prompts
- Landing page with pricing tiers (Starter/Professional/Enterprise)

**Known gaps (carried to v1.1):**
- XFRM-10/11: Split tool KP range and column value modes incomplete
- ONBD-05/06/07: Trial conversion mechanics (nudges, soft locks, emails) not built
- ONBD-08/09/10: Landing page conversion optimisation not built
- PROJ-05: Processing history view (partially covered by audit trail)

**Archives:**
- [v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- [v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md)

---
