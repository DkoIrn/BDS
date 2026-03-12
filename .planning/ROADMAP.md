# Roadmap: SurveyQC AI

## Overview

SurveyQC AI goes from zero to MVP in 10 phases over 2 months. The journey starts with foundation (auth, UI shell, database schema), builds the core data pipeline (upload, ingestion, validation), layers on the user-facing experience (dashboard, reports), and finishes with the public-facing landing page and subscription structure. Each phase delivers a verifiable capability that the next phase builds on. The critical path runs through file ingestion and the validation engine -- those are the product.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation & Auth** - Next.js shell with Supabase auth, database schema, and design system
- [x] **Phase 2: Project Structure** - Project and job hierarchy for organizing survey work (completed 2026-03-10)
- [x] **Phase 3: File Upload & Storage** - Drag-and-drop upload to Supabase Storage with secure file management (completed 2026-03-11)
- [x] **Phase 4: Ingestion Pipeline** - Column auto-detection, mapping interface, and messy data handling (completed 2026-03-11)
- [ ] **Phase 5: Validation Engine** - Core rule-based checks and statistical anomaly detection with explainable flags
- [ ] **Phase 6: Validation Profiles** - Default survey templates and configurable tolerance thresholds
- [ ] **Phase 7: Async Processing** - Background job execution with status tracking and notifications
- [ ] **Phase 8: Results Dashboard** - Issue viewer with severity grouping, statistics, and processing history
- [ ] **Phase 9: Reports & Export** - PDF QC reports and downloadable cleaned datasets
- [ ] **Phase 10: Landing Page & Subscription** - Public landing page and 3-tier subscription structure

## Phase Details

### Phase 1: Foundation & Auth
**Goal**: Users can securely access their accounts within a professionally designed application shell
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, UIDE-01, UIDE-02
**Success Criteria** (what must be TRUE):
  1. User can create an account with email and password and land on an authenticated dashboard
  2. User can log in, close the browser, reopen it, and still be logged in
  3. User can log out from any page and be redirected to the login screen
  4. User can request a password reset email and use the link to set a new password
  5. Application uses the brand palette (Deep Blue, Teal, Orange) and renders correctly on desktop and tablet
**Plans:** 2/3 plans executed

Plans:
- [ ] 01-01-PLAN.md -- Scaffold Next.js with shadcn/ui, Supabase clients, middleware, design system, and database migration
- [ ] 01-02-PLAN.md -- Auth pages (login, signup, forgot/update password) with split-screen layout and server actions
- [ ] 01-03-PLAN.md -- App shell (collapsible sidebar, top bar, dashboard, settings) with human verification

### Phase 2: Project Structure
**Goal**: Users can organize their survey work into projects and jobs
**Depends on**: Phase 1
**Requirements**: PROJ-01, PROJ-02, PROJ-03, PROJ-04
**Success Criteria** (what must be TRUE):
  1. User can create a new project with a name and see it in their project list
  2. User can create survey jobs within a project
  3. User can view all their projects with status summaries on the projects page
  4. User can drill into a project to see its jobs and datasets
**Plans:** 2/2 plans complete

Plans:
- [ ] 02-01-PLAN.md -- Database schema, types, server actions, projects list page with create dialog and nav update
- [ ] 02-02-PLAN.md -- Project detail page with job creation dialog and jobs list

### Phase 3: File Upload & Storage
**Goal**: Users can upload survey data files that are securely stored and associated with their jobs
**Depends on**: Phase 2
**Requirements**: FILE-01, FILE-06
**Success Criteria** (what must be TRUE):
  1. User can drag-and-drop a CSV or Excel file (up to 50MB) onto the upload area and see it upload successfully
  2. Uploaded files are stored in Supabase Storage and tied to the user's account (other users cannot access them)
**Plans**: 2 plans

Plans:
- [ ] 03-01-PLAN.md -- Database migration, types, server actions for file storage foundation
- [ ] 03-02-PLAN.md -- Job detail page with upload zone, file list, and file management UI

### Phase 4: Ingestion Pipeline
**Goal**: The system can parse uploaded files, detect column types, and let users confirm or correct mappings before processing
**Depends on**: Phase 3
**Requirements**: FILE-02, FILE-03, FILE-04, PROC-03
**Success Criteria** (what must be TRUE):
  1. After upload, the system auto-detects column types (KP, DOB, DOC, TOP, easting, northing) and displays them
  2. User can manually override any column assignment via a mapping interface
  3. User can preview the parsed dataset with column mappings before triggering processing
  4. System successfully parses files with mixed encodings, BOM characters, and metadata header rows
**Plans:** 3/3 plans complete

Plans:
- [ ] 04-01-PLAN.md -- Parsing engine: types, CSV/Excel parsers, header detection, column auto-detection (TDD)
- [ ] 04-02-PLAN.md -- DB migration, parse API route, server actions, and auto-parse trigger
- [ ] 04-03-PLAN.md -- File detail page with column mapping UI, data preview, and status badges

### Phase 5: Validation Engine
**Goal**: The system can run core QC checks on survey data and produce explainable flags for every detected issue
**Depends on**: Phase 4
**Requirements**: VALE-01, VALE-02, VALE-03, VALE-04, VALE-05, VALE-07
**Success Criteria** (what must be TRUE):
  1. System flags values outside configured range/tolerance thresholds
  2. System detects and flags missing data points, null cells, and KP coverage gaps
  3. System detects duplicate rows and near-duplicate KP entries
  4. System identifies statistical outliers using z-score and IQR methods
  5. Every flagged issue includes a plain-English explanation stating what failed, the expected value or range, and the actual value found
**Plans:** 1/3 plans executed

Plans:
- [ ] 05-01-PLAN.md -- FastAPI backend scaffold with TDD validators (range, missing data, duplicates, outliers, monotonicity)
- [ ] 05-02-PLAN.md -- Database migration for validation tables, TypeScript types, and Next.js API proxy route
- [ ] 05-03-PLAN.md -- Frontend Run QC button, progress/summary UI, Railway deployment, and end-to-end verification

### Phase 6: Validation Profiles
**Goal**: Users can select survey-type templates and configure tolerance thresholds for their QC checks
**Depends on**: Phase 5
**Requirements**: VALE-06, VALE-08
**Success Criteria** (what must be TRUE):
  1. User can select from default validation templates for DOB, DOC, and TOP survey types
  2. User can configure tolerance thresholds (e.g., DOC/DOB limits) and see those thresholds applied during processing
**Plans:** 2/3 plans executed

Plans:
- [ ] 06-01-PLAN.md -- Backend: DB migration, Pydantic config models, template definitions, pipeline config passthrough with enabled_checks
- [ ] 06-02-PLAN.md -- Frontend foundation: TypeScript types, template constants, profile CRUD actions, API route config forwarding
- [ ] 06-03-PLAN.md -- Frontend UI: profile selector dropdown, threshold editor panel, FileDetailView integration with human verification

### Phase 7: Async Processing
**Goal**: File processing runs in the background with real-time status updates so users are never stuck waiting
**Depends on**: Phase 5
**Requirements**: PROC-01, PROC-02
**Success Criteria** (what must be TRUE):
  1. User uploads a file and is immediately free to navigate the app while processing runs in the background
  2. User can see the current processing status (queued, processing, complete, failed) update in real time
  3. User receives a notification when processing completes or fails
**Plans:** 1/2 plans executed

Plans:
- [ ] 07-01-PLAN.md -- Backend async conversion: FastAPI BackgroundTasks, Next.js 202 fire-and-forget route, Realtime publication migration
- [ ] 07-02-PLAN.md -- Frontend Realtime integration: RealtimeProvider toasts, FileDetailView fire-and-forget, FileList live status badges

### Phase 8: Results Dashboard
**Goal**: Users can review all QC results in an interactive dashboard with issue details and processing history
**Depends on**: Phase 5, Phase 7
**Requirements**: DASH-01, DASH-02, DASH-03, PROJ-05
**Success Criteria** (what must be TRUE):
  1. User can view flagged issues grouped by severity (critical, warning, info)
  2. User can view summary statistics including total issues, pass rate, and data completeness
  3. User can click into any flagged row to see the full explanation and surrounding data context
  4. User can view processing history for previous QC runs on a dataset
**Plans**: TBD

Plans:
- [ ] 08-01: TBD
- [ ] 08-02: TBD

### Phase 9: Reports & Export
**Goal**: Users can download professional QC reports and cleaned datasets from their results
**Depends on**: Phase 8
**Requirements**: DASH-04, DASH-05, FILE-05
**Success Criteria** (what must be TRUE):
  1. User can download a formatted PDF QC report from the results page
  2. QC report includes summary section, methodology description, issue table, and overall pass/fail status
  3. User can download the cleaned/annotated dataset as CSV or Excel with flagged issues marked
**Plans**: TBD

Plans:
- [ ] 09-01: TBD
- [ ] 09-02: TBD

### Phase 10: Landing Page & Subscription
**Goal**: The platform has a public-facing landing page and visible subscription tier structure
**Depends on**: Phase 1
**Requirements**: UIDE-03, SUBS-01, SUBS-02
**Success Criteria** (what must be TRUE):
  1. Landing page clearly communicates the value proposition to survey/engineering companies
  2. Platform defines and displays 3 subscription tiers (Starter, Professional, Enterprise) with feature breakdowns
  3. Landing page includes a clear call-to-action to sign up
**Plans**: TBD

Plans:
- [ ] 10-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10
Note: Phase 6 and Phase 7 both depend on Phase 5 and can run in parallel.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Auth | 2/3 | In Progress|  |
| 2. Project Structure | 2/2 | Complete   | 2026-03-10 |
| 3. File Upload & Storage | 2/2 | Complete   | 2026-03-11 |
| 4. Ingestion Pipeline | 3/3 | Complete   | 2026-03-11 |
| 5. Validation Engine | 1/3 | In Progress|  |
| 6. Validation Profiles | 2/3 | In Progress|  |
| 7. Async Processing | 1/2 | In Progress|  |
| 8. Results Dashboard | 0/2 | Not started | - |
| 9. Reports & Export | 0/2 | Not started | - |
| 10. Landing Page & Subscription | 0/1 | Not started | - |
