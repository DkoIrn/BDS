# Requirements: SurveyQC AI

**Defined:** 2026-03-10
**Core Value:** Engineers can upload survey data and receive automated QC reports with every flagged issue explained — replacing hours of manual checking with minutes of automated validation.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication

- [x] **AUTH-01**: User can sign up with email and password
- [x] **AUTH-02**: User can log in and stay logged in across sessions
- [x] **AUTH-03**: User can log out from any page
- [x] **AUTH-04**: User can reset password via email link

### Project Management

- [x] **PROJ-01**: User can create a project (e.g., "Pipeline Survey - North Sea")
- [x] **PROJ-02**: User can create survey jobs within a project (e.g., "Phase 1 Survey")
- [x] **PROJ-03**: User can view list of their projects with status summaries
- [x] **PROJ-04**: User can view all jobs and datasets within a project
- [ ] **PROJ-05**: User can view processing history for previous QC runs

### File Handling

- [x] **FILE-01**: User can upload CSV and Excel files (up to 50MB) via drag-and-drop
- [x] **FILE-02**: System auto-detects column types (KP, DOB, DOC, TOP, easting, northing, etc.)
- [x] **FILE-03**: User can manually map/override column assignments via mapping interface
- [x] **FILE-04**: User can preview uploaded dataset before processing to confirm column mappings
- [x] **FILE-05**: User can download cleaned/annotated dataset as CSV or Excel
- [x] **FILE-06**: Files are stored securely in Supabase Storage tied to user account

### Validation Engine

- [x] **VALE-01**: System performs range and tolerance checks against configurable thresholds
- [x] **VALE-02**: System detects missing data points, null cells, and KP coverage gaps
- [x] **VALE-03**: System detects duplicate rows and near-duplicate KP entries
- [x] **VALE-04**: System detects statistical outliers using z-score and IQR methods
- [x] **VALE-05**: System validates monotonicity of KP values and logical event sequencing
- [x] **VALE-06**: System provides default validation templates for DOB, DOC, and TOP survey types
- [x] **VALE-07**: Every flagged issue includes a plain-English explanation of why it was flagged
- [x] **VALE-08**: User can configure tolerance thresholds for QC checks (e.g., DOC/DOB limits)

### Processing

- [x] **PROC-01**: Processing runs asynchronously — user uploads and is notified when complete
- [x] **PROC-02**: User can see processing status (queued, processing, complete, failed)
- [x] **PROC-03**: Processing handles messy real-world data (mixed encodings, BOM chars, metadata rows)

### Dashboard & Reports

- [ ] **DASH-01**: User can view results dashboard with flagged issues grouped by severity
- [ ] **DASH-02**: User can view summary statistics (total issues, pass rate, data completeness)
- [ ] **DASH-03**: User can view individual flagged rows with explanations
- [x] **DASH-04**: User can download formatted QC report as PDF
- [x] **DASH-05**: QC report includes summary, methodology, issue table, and pass/fail status

### Subscription

- [x] **SUBS-01**: Platform defines 3 tiers — Starter, Professional, Enterprise
- [x] **SUBS-02**: Tier structure is visible on the platform (pricing/features page)

### UI & Design

- [x] **UIDE-01**: Platform has vibrant yet professional design (Deep Blue, Teal, Orange palette)
- [x] **UIDE-02**: Responsive layout that works on desktop and tablet
- [x] **UIDE-03**: Landing page communicates value proposition to target audience

### File Format Parsers

- [x] **FMT-01**: System parses GeoJSON files (FeatureCollection with Point/LineString/Polygon) into tabular rows
- [x] **FMT-02**: System parses Shapefile ZIP archives (.shp/.dbf/.shx) into attribute rows with coordinates
- [x] **FMT-03**: System parses KML/KMZ files extracting placemarks with name, description, and coordinates
- [x] **FMT-04**: System parses LandXML files extracting CgPoints and Alignment coordinate data
- [x] **FMT-05**: System parses DXF files extracting entity coordinates (POINT, LINE, LWPOLYLINE, INSERT, etc.)
- [x] **FMT-06**: System routes files to correct parser by extension and integrates with upload/parse pipeline

### Format Conversion

- [x] **CONV-01**: User can upload any supported format file (CSV, Excel, GeoJSON, Shapefile, KML/KMZ, LandXML, DXF) for conversion
- [x] **CONV-02**: User can select target format (CSV, GeoJSON, KML) with smart filtering based on input type
- [x] **CONV-03**: System converts file and provides download with correct filename and format
- [x] **CONV-04**: Conversion handles errors gracefully with clear inline messages
- [x] **CONV-05**: Partial conversions succeed with warnings for skipped rows

### Data Transform Tools

- [x] **XFRM-01**: System transforms coordinates between CRS (WGS84, UTM zones, OSGB36) using pyproj
- [x] **XFRM-02**: System auto-detects source CRS from coordinate value ranges
- [x] **XFRM-03**: System merges multiple datasets with union columns and missing value padding
- [x] **XFRM-04**: System splits datasets by KP range into separate output files
- [x] **XFRM-05**: System splits datasets by column value into one file per unique value
- [x] **XFRM-06**: Transform endpoints accept file uploads and return transformed output via FastAPI
- [ ] **XFRM-07**: Landing page shows clickable tool cards with Coming Soon badge on Auto-Clean
- [ ] **XFRM-08**: CRS tool provides upload, auto-detect source CRS, target CRS selection, and download flow
- [ ] **XFRM-09**: Merge tool provides multi-file upload, preview, and single merged file download
- [ ] **XFRM-10**: Split tool supports both KP range and column value split modes
- [ ] **XFRM-11**: Split output provides ZIP download with one file per split segment

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
| Real-time collaboration/commenting | Complex sync infrastructure; single-user review for MVP |
| Mobile app | Web-first, responsive design covers tablet use |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1: Foundation & Auth | Complete |
| AUTH-02 | Phase 1: Foundation & Auth | Complete |
| AUTH-03 | Phase 1: Foundation & Auth | Complete |
| AUTH-04 | Phase 1: Foundation & Auth | Complete |
| UIDE-01 | Phase 1: Foundation & Auth | Complete |
| UIDE-02 | Phase 1: Foundation & Auth | Complete |
| PROJ-01 | Phase 2: Project Structure | Complete |
| PROJ-02 | Phase 2: Project Structure | Complete |
| PROJ-03 | Phase 2: Project Structure | Complete |
| PROJ-04 | Phase 2: Project Structure | Complete |
| FILE-01 | Phase 3: File Upload & Storage | Complete |
| FILE-06 | Phase 3: File Upload & Storage | Complete |
| FILE-02 | Phase 4: Ingestion Pipeline | Complete |
| FILE-03 | Phase 4: Ingestion Pipeline | Complete |
| FILE-04 | Phase 4: Ingestion Pipeline | Complete |
| PROC-03 | Phase 4: Ingestion Pipeline | Complete |
| VALE-01 | Phase 5: Validation Engine | Complete |
| VALE-02 | Phase 5: Validation Engine | Complete |
| VALE-03 | Phase 5: Validation Engine | Complete |
| VALE-04 | Phase 5: Validation Engine | Complete |
| VALE-05 | Phase 5: Validation Engine | Complete |
| VALE-07 | Phase 5: Validation Engine | Complete |
| VALE-06 | Phase 6: Validation Profiles | Complete |
| VALE-08 | Phase 6: Validation Profiles | Complete |
| PROC-01 | Phase 7: Async Processing | Complete |
| PROC-02 | Phase 7: Async Processing | Complete |
| DASH-01 | Phase 8: Results Dashboard | Pending |
| DASH-02 | Phase 8: Results Dashboard | Pending |
| DASH-03 | Phase 8: Results Dashboard | Pending |
| PROJ-05 | Phase 8: Results Dashboard | Pending |
| DASH-04 | Phase 9: Reports & Export | Complete |
| DASH-05 | Phase 9: Reports & Export | Complete |
| FILE-05 | Phase 9: Reports & Export | Complete |
| UIDE-03 | Phase 10: Landing Page & Subscription | Complete |
| SUBS-01 | Phase 10: Landing Page & Subscription | Complete |
| SUBS-02 | Phase 10: Landing Page & Subscription | Complete |
| FMT-01 | Phase 11: File Format Parsers | Complete |
| FMT-02 | Phase 11: File Format Parsers | Complete |
| FMT-03 | Phase 11: File Format Parsers | Complete |
| FMT-04 | Phase 11: File Format Parsers | Complete |
| FMT-05 | Phase 11: File Format Parsers | Complete |
| FMT-06 | Phase 11: File Format Parsers | Complete |
| CONV-01 | Phase 12: Format Conversion Tool | Complete |
| CONV-02 | Phase 12: Format Conversion Tool | Complete |
| CONV-03 | Phase 12: Format Conversion Tool | Complete |
| CONV-04 | Phase 12: Format Conversion Tool | Complete |
| CONV-05 | Phase 12: Format Conversion Tool | Complete |
| XFRM-01 | Phase 14: Data Transform Tools | Complete |
| XFRM-02 | Phase 14: Data Transform Tools | Complete |
| XFRM-03 | Phase 14: Data Transform Tools | Complete |
| XFRM-04 | Phase 14: Data Transform Tools | Complete |
| XFRM-05 | Phase 14: Data Transform Tools | Complete |
| XFRM-06 | Phase 14: Data Transform Tools | Complete |
| XFRM-07 | Phase 14: Data Transform Tools | Pending |
| XFRM-08 | Phase 14: Data Transform Tools | Pending |
| XFRM-09 | Phase 14: Data Transform Tools | Pending |
| XFRM-10 | Phase 14: Data Transform Tools | Pending |
| XFRM-11 | Phase 14: Data Transform Tools | Pending |

**Coverage:**
- v1 requirements: 52 total
- Mapped to phases: 52
- Unmapped: 0

---
*Requirements defined: 2026-03-10*
*Last updated: 2026-03-30 after Phase 14 planning*
