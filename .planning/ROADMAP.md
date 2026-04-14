# Roadmap: TruQC

## Milestones

- **v1.0 MVP** — Phases 1-28 (shipped 2026-04-11) — [archive](milestones/v1.0-ROADMAP.md)
- **v1.1 Production-Grade QC Platform** — Phases 29-37 (in progress)

## Phases

<details>
<summary>v1.0 MVP (Phases 1-28) — SHIPPED 2026-04-11</summary>

- [x] Phase 1: Foundation & Auth (3/3 plans)
- [x] Phase 2: Project Structure (2/2 plans)
- [x] Phase 3: File Upload & Storage (2/2 plans)
- [x] Phase 4: Ingestion Pipeline (3/3 plans)
- [x] Phase 5: Validation Engine (3/3 plans)
- [x] Phase 6: Validation Profiles (3/3 plans)
- [x] Phase 7: Async Processing (2/2 plans)
- [x] Phase 8: Results Dashboard (3/3 plans)
- [x] Phase 9: Reports & Export (2/2 plans)
- [x] Phase 10: Landing Page & Subscription (2/2 plans)
- [x] Phase 11: File Format Parsers (3/3 plans)
- [x] Phase 12: Format Conversion (2/2 plans)
- [x] Phase 13: Map Visualization (2/2 plans)
- [x] Phase 14: Data Transform Tools (3/3 plans)
- [x] Phase 15: Dataset Comparison (built outside GSD)
- [x] Phase 16: Pipeline Workflow (3/3 plans)
- [x] Phase 17: Audit Trail & Data Lineage (2/2 plans)
- [x] Phase 18: Issue Triage & Manual Overrides (2/2 plans)
- [x] Phase 19: Client-Grade Reports (2/2 plans)
- [x] Phase 20: Domain-Specific QC Packs (2/2 plans)
- [x] Phase 21: Usage Tracking & Tier Enforcement (2/2 plans)
- [x] Phase 22: AI Issue Prioritisation & Smart Grouping (2/2 plans)
- [x] Phase 23: One-Click Data Fixes (2/2 plans)
- [x] Phase 24: Branded Client Reports (2/2 plans)
- [x] Phase 25: Multi-User & Roles (3/3 plans)
- [x] Phase 26: Enterprise API (3/3 plans)
- [x] Phase 27: Spatial QC Map Overlay (2/2 plans)
- [x] Phase 28: Guided Onboarding Flow (2/2 plans)

</details>

### v1.1 Production-Grade QC Platform

**Milestone Goal:** Transform TruQC from a technical MVP into a production-ready platform that survey companies can trust for daily use -- reliable processing, dataset auditability, and deeper workflow integration.

- [x] **Phase 29: Job Queue Infrastructure** - Replace fire-and-forget processing with persistent, retry-capable job queue
- [x] **Phase 30: Dataset Versioning** - Immutable snapshots per validation run with version comparison UI
- [ ] **Phase 31: Validation Certificates (Basic)** - QC Certificate PDF generation with cryptographic hash
- [x] **Phase 32: Collaboration (Core)** - In-app notifications, comment resolution, and @mentions
- [x] **Phase 33: Validation Certificates (Verification)** - QR code verification, public verify endpoint, certificate registry (completed 2026-04-13)
- [ ] **Phase 34: Collaboration (Extended)** - Email notifications and project activity feed
- [ ] **Phase 35: Cross-Dataset Validation** - Multi-dataset comparison integrated into validation pipeline
- [ ] **Phase 36: Custom Rule Builder** - Visual IF/THEN rule builder with preview and profile integration
- [ ] **Phase 37: Context-Aware QC** - Dynamic thresholds by context zones and event-conditional rules

## Phase Details

### Phase 29: Job Queue Infrastructure
**Goal**: Validation jobs survive server restarts, retry on failure, and give users real-time visibility into processing status
**Depends on**: Nothing (v1.1 foundation)
**Requirements**: JOBQ-01, JOBQ-02, JOBQ-03, JOBQ-04, JOBQ-05, JOBQ-06
**Success Criteria** (what must be TRUE):
  1. User submits a validation job and it completes successfully even if the server restarts mid-processing
  2. User sees a progress bar with percentage during validation (not just a spinner)
  3. When a job fails, user sees a clear error message and can click "Retry" to resubmit without duplicating results
  4. User can view a history of recent jobs with their outcomes (success/failed/retrying)
**Plans**: 2 plans
Plans:
- [x] 29-01-PLAN.md — Procrastinate queue backend: infrastructure, migrations, task definitions, jobs API
- [x] 29-02-PLAN.md — Frontend job queue UI: progress bar, error/retry display, job history, Realtime integration

### Phase 30: Dataset Versioning
**Goal**: Every validation run creates a traceable snapshot so users can see how their data changed over time
**Depends on**: Phase 29 (job queue provides reliable completion events for snapshot creation)
**Requirements**: DVER-01, DVER-02, DVER-03, DVER-04, DVER-05
**Success Criteria** (what must be TRUE):
  1. After each validation run, user can see a new version entry in the dataset's version history
  2. User can select two versions and see a summary of what changed (rows added, removed, modified) with row-level detail
  3. Each version in the history shows the linked issue count from that validation run
  4. When a dataset exceeds 10 versions, the oldest versions are automatically pruned without user intervention
**Plans**: 2 plans
Plans:
- [x] 30-01-PLAN.md — Backend: migration, versioning service (snapshot + pruning + diff), API endpoints, tests
- [x] 30-02-PLAN.md — Frontend: types, API routes, Versions tab with timeline, diff comparison view, Realtime

### Phase 31: Validation Certificates (Basic)
**Goal**: Users can generate a tamper-evident QC certificate PDF that proves a dataset passed validation
**Depends on**: Phase 30 (certificates reference version snapshots and content hashes)
**Requirements**: CERT-01, CERT-02
**Success Criteria** (what must be TRUE):
  1. User can click "Generate Certificate" on a passed validation run and download a QC Certificate PDF
  2. Certificate PDF includes dataset name, validation date, rules applied, pass/fail summary, and a unique HMAC-SHA256 hash
**Plans**: 2 plans
Plans:
- [ ] 31-01-PLAN.md — Backend: certificate builder service, HMAC signing, database migration, FastAPI endpoint
- [ ] 31-02-PLAN.md — Frontend: TypeScript types, Next.js proxy route, CertificateButton component, UI integration

### Phase 32: Collaboration (Core)
**Goal**: Team members stay informed about validation activity through in-app notifications and can communicate via resolvable comments with @mentions
**Depends on**: Phase 29 (notifications triggered by job completion events)
**Requirements**: COLB-01, COLB-03, COLB-04
**Success Criteria** (what must be TRUE):
  1. User sees a bell icon with unread count that updates when validations complete, comments are posted, or they are @mentioned
  2. User can @mention org members in comments with autocomplete, and the mentioned user receives a notification
  3. User can mark comments as resolved and filter to show only unresolved comments
**Plans**: 2 plans
Plans:
- [x] 32-01-PLAN.md — Database migrations, types, server actions, and @mention utilities
- [x] 32-02-PLAN.md — Notification bell UI, comment resolution UI, @mention input, Realtime integration

### Phase 33: Validation Certificates (Verification)
**Goal**: Anyone can independently verify the authenticity of a QC certificate without needing a TruQC account
**Depends on**: Phase 31 (basic certificate generation must exist before adding verification layer)
**Requirements**: CERT-03, CERT-04, CERT-05
**Success Criteria** (what must be TRUE):
  1. Certificate PDF includes a QR code that links to a public verification URL
  2. Anyone can visit /verify/{id} without authentication and see whether the certificate is valid, revoked, or unknown
  3. Admin can revoke a certificate from the certificate registry, and subsequent verification shows "revoked" status
**Plans**: 2 plans
Plans:
- [ ] 33-01-PLAN.md — Backend: QR code embedding in PDFs, revocation migration, revocation + lookup API endpoints
- [ ] 33-02-PLAN.md — Frontend: public verify page, certificate registry table with revocation UI, reports tab navigation

### Phase 34: Collaboration (Extended)
**Goal**: Users receive email notifications for critical events and can track project activity in a chronological feed
**Depends on**: Phase 32 (core notification infrastructure must exist before extending to email and activity feed)
**Requirements**: COLB-02, COLB-05
**Success Criteria** (what must be TRUE):
  1. User receives email notifications for job failures and @mentions, with per-category on/off toggles in settings
  2. User can view a project-scoped activity feed showing recent validations, fixes, comments, and exports in chronological order
**Plans**: 2 plans
Plans:
- [ ] 34-01-PLAN.md — Backend: migration, email service (Resend + React Email), notification preferences, activity logging, createNotification email dispatch
- [ ] 34-02-PLAN.md — Frontend: notification preferences toggles on settings page, activity feed timeline on project detail page

### Phase 35: Cross-Dataset Validation
**Goal**: Users can validate consistency between related datasets (e.g., DOB vs DOC) within the standard pipeline workflow
**Depends on**: Phase 29 (multi-dataset jobs require reliable queue processing)
**Requirements**: XVAL-01, XVAL-02, XVAL-03, XVAL-04
**Success Criteria** (what must be TRUE):
  1. User can select two datasets within the same job and run a cross-dataset validation
  2. System validates column-to-column consistency between paired datasets with user-configurable tolerance
  3. Cross-dataset issues appear in the standard triage view under a "Cross-Dataset" category alongside single-dataset issues
  4. Domain-specific presets (DOB vs DOC consistency, position vs event alignment) are available out of the box
**Plans**: TBD

### Phase 36: Custom Rule Builder
**Goal**: Users can define their own validation rules with conditional logic, capturing domain knowledge that predefined rules cannot cover
**Depends on**: Phase 29 (custom rules execute within the validation pipeline)
**Requirements**: RULE-01, RULE-02, RULE-03, RULE-04, RULE-05
**Success Criteria** (what must be TRUE):
  1. User can create a custom rule using a visual IF/THEN builder with three rule types: threshold check, column comparison, and null check
  2. User can combine conditions with AND/OR grouping (up to 2 levels of nesting)
  3. User can test a rule against the current dataset and preview which rows match before saving
  4. Saved custom rules run alongside built-in validators when included in a validation profile
**Plans**: TBD

### Phase 37: Context-Aware QC
**Goal**: Validators apply different thresholds based on pipeline context (zones, events), reducing false positives in complex survey environments
**Depends on**: Phase 36 (shares conditional logic patterns from custom rule builder)
**Requirements**: CTXQ-01, CTXQ-02, CTXQ-03, CTXQ-04
**Success Criteria** (what must be TRUE):
  1. User can define context zones/segments (e.g., KP ranges) with associated threshold modifiers via a configuration UI
  2. Validators automatically apply context-specific thresholds instead of global defaults when data falls within a defined zone
  3. User can define event-conditional rules (e.g., "if event = trench crossing, relax depth thresholds by 20%")
  4. Domain QC packs include pre-configured context rules for common pipeline scenarios (shore approach, trench crossing, J-tube)
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 29. Job Queue Infrastructure | 2/2 | Complete    | 2026-04-11 | - |
| 30. Dataset Versioning | 1/2 | Complete    | 2026-04-12 | - |
| 31. Validation Certificates (Basic) | v1.1 | 0/2 | Planned | - |
| 32. Collaboration (Core) | 2/2 | Complete    | 2026-04-12 | - |
| 33. Validation Certificates (Verification) | 2/2 | Complete    | 2026-04-13 | - |
| 34. Collaboration (Extended) | 1/2 | In Progress|  | - |
| 35. Cross-Dataset Validation | v1.1 | 0/TBD | Not started | - |
| 36. Custom Rule Builder | v1.1 | 0/TBD | Not started | - |
| 37. Context-Aware QC | v1.1 | 0/TBD | Not started | - |
