# Requirements: SurveyQC AI

**Defined:** 2026-03-10
**Core Value:** Engineers can upload survey data and receive automated QC reports with every flagged issue explained — replacing hours of manual checking with minutes of automated validation.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication

- [ ] **AUTH-01**: User can sign up with email and password
- [ ] **AUTH-02**: User can log in and stay logged in across sessions
- [ ] **AUTH-03**: User can log out from any page
- [ ] **AUTH-04**: User can reset password via email link

### Project Management

- [ ] **PROJ-01**: User can create a project (e.g., "Pipeline Survey - North Sea")
- [ ] **PROJ-02**: User can create survey jobs within a project (e.g., "Phase 1 Survey")
- [ ] **PROJ-03**: User can view list of their projects with status summaries
- [ ] **PROJ-04**: User can view all jobs and datasets within a project
- [ ] **PROJ-05**: User can view processing history for previous QC runs

### File Handling

- [ ] **FILE-01**: User can upload CSV and Excel files (up to 50MB) via drag-and-drop
- [ ] **FILE-02**: System auto-detects column types (KP, DOB, DOC, TOP, easting, northing, etc.)
- [ ] **FILE-03**: User can manually map/override column assignments via mapping interface
- [ ] **FILE-04**: User can preview uploaded dataset before processing to confirm column mappings
- [ ] **FILE-05**: User can download cleaned/annotated dataset as CSV or Excel
- [ ] **FILE-06**: Files are stored securely in Supabase Storage tied to user account

### Validation Engine

- [ ] **VALE-01**: System performs range and tolerance checks against configurable thresholds
- [ ] **VALE-02**: System detects missing data points, null cells, and KP coverage gaps
- [ ] **VALE-03**: System detects duplicate rows and near-duplicate KP entries
- [ ] **VALE-04**: System detects statistical outliers using z-score and IQR methods
- [ ] **VALE-05**: System validates monotonicity of KP values and logical event sequencing
- [ ] **VALE-06**: System provides default validation templates for DOB, DOC, and TOP survey types
- [ ] **VALE-07**: Every flagged issue includes a plain-English explanation of why it was flagged
- [ ] **VALE-08**: User can configure tolerance thresholds for QC checks (e.g., DOC/DOB limits)

### Processing

- [ ] **PROC-01**: Processing runs asynchronously — user uploads and is notified when complete
- [ ] **PROC-02**: User can see processing status (queued, processing, complete, failed)
- [ ] **PROC-03**: Processing handles messy real-world data (mixed encodings, BOM chars, metadata rows)

### Dashboard & Reports

- [ ] **DASH-01**: User can view results dashboard with flagged issues grouped by severity
- [ ] **DASH-02**: User can view summary statistics (total issues, pass rate, data completeness)
- [ ] **DASH-03**: User can view individual flagged rows with explanations
- [ ] **DASH-04**: User can download formatted QC report as PDF
- [ ] **DASH-05**: QC report includes summary, methodology, issue table, and pass/fail status

### Subscription

- [ ] **SUBS-01**: Platform defines 3 tiers — Starter, Professional, Enterprise
- [ ] **SUBS-02**: Tier structure is visible on the platform (pricing/features page)

### UI & Design

- [ ] **UIDE-01**: Platform has vibrant yet professional design (Deep Blue, Teal, Orange palette)
- [ ] **UIDE-02**: Responsive layout that works on desktop and tablet
- [ ] **UIDE-03**: Landing page communicates value proposition to target audience

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Validation Engine (Enhanced)

- **VALE-09**: User can create custom validation rules with configurable parameters
- **VALE-10**: User can save, clone, and share validation profiles across projects
- **VALE-11**: System performs cross-dataset consistency checks (event listings vs pipeline data)

### Dashboard & Reports (Enhanced)

- **DASH-06**: User can view KP-referenced profile visualization of flagged issues
- **DASH-07**: System auto-generates formatted GC reports from validated data

### File Handling (Enhanced)

- **FILE-07**: User can batch-upload multiple files per survey job
- **FILE-08**: System supports shapefile and LAS/LiDAR formats

### Subscription (Enhanced)

- **SUBS-03**: Tier-based limits enforced (upload size, projects, users)
- **SUBS-04**: Payment processing via Stripe
- **SUBS-05**: API access for Enterprise tier

### AI Features

- **AIFR-01**: AI-powered natural language summaries of QC results
- **AIFR-02**: AI-suggested data corrections with confidence scores

### Team & Collaboration

- **TEAM-01**: Multi-user accounts with role-based access
- **TEAM-02**: Google OAuth login

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Raw sensor data processing | Platform validates post-processed deliverables, not raw instrument data (Kongsberg .all, Reson .s7k, etc.) |
| Real-time vessel data integration | Completely different product category — vessel-side QC handled by EIVA/VisualSoft |
| GIS/mapping visualization | Huge scope; KP-based profile plots sufficient for QC. Users have QGIS/ArcGIS for mapping |
| Built-in data editing/correction | Turns QC tool into a spreadsheet. Flag issues for engineers to fix in their preferred tool |
| Custom ML model training | Requires ML ops infrastructure beyond solo dev capacity |
| Video/image annotation for ROV data | Different product category with massive storage requirements |
| Coordinate transformations | Complex geodetic edge cases; accept data in whatever CRS user provides |
| Real-time collaboration/commenting | Complex sync infrastructure; single-user review for MVP |
| Mobile app | Web-first, responsive design covers tablet use |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| (populated during roadmap creation) | | |

**Coverage:**
- v1 requirements: 30 total
- Mapped to phases: 0
- Unmapped: 30 ⚠️

---
*Requirements defined: 2026-03-10*
*Last updated: 2026-03-10 after initial definition*
