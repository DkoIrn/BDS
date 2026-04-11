# Requirements: TruQC

**Defined:** 2026-04-11
**Core Value:** Engineers can upload survey data and receive automated QC reports with every flagged issue explained — replacing hours of manual checking with minutes of automated validation.

## v1.1 Requirements

Requirements for v1.1 Production-Grade QC Platform. Each maps to roadmap phases.

### Job Queue & Processing

- [ ] **JOBQ-01**: Validation jobs are enqueued persistently so no job is lost on server restart or crash
- [ ] **JOBQ-02**: Failed jobs retry automatically with exponential backoff (up to 3 attempts)
- [ ] **JOBQ-03**: User can see job status with progress percentage (not just spinning indicator)
- [ ] **JOBQ-04**: After 3 failed retries, user sees clear failure message with "Retry" button
- [ ] **JOBQ-05**: Jobs are idempotent — retrying a job does not create duplicate validation runs
- [ ] **JOBQ-06**: Job status is persisted and queryable via API and UI (history of recent jobs with outcomes)

### Dataset Versioning

- [ ] **DVER-01**: Each validation run creates an immutable snapshot of the dataset state
- [ ] **DVER-02**: User can view version history for a dataset showing all snapshots with timestamps
- [ ] **DVER-03**: User can compare any two versions and see row-level changes with summary stats
- [ ] **DVER-04**: Version history shows linked validation results (issue count per version)
- [ ] **DVER-05**: Storage retention limits snapshots to 10 versions per dataset (oldest auto-pruned)

### Validation Certificates (Basic)

- [ ] **CERT-01**: User can generate a QC Certificate PDF for a passed validation run
- [ ] **CERT-02**: Certificate includes dataset name, validation date, rules applied, pass/fail summary, and unique HMAC-SHA256 hash

### Validation Certificates (Verification)

- [ ] **CERT-03**: Certificate PDF includes a QR code linking to a public verification URL
- [ ] **CERT-04**: Anyone can verify a certificate at /verify/{id} without authentication
- [ ] **CERT-05**: Certificate records are stored in a registry with revocation support

### Collaboration (Core)

- [ ] **COLB-01**: User receives in-app notifications (bell icon with unread count) for validation completions, comments, and @mentions
- [ ] **COLB-03**: User can mark comments as resolved, and filter to show unresolved only
- [ ] **COLB-04**: User can @mention org members in comments with autocomplete, triggering a notification

### Collaboration (Extended)

- [ ] **COLB-02**: User receives email notifications for job failures and @mentions (toggle on/off per category)
- [ ] **COLB-05**: User can view a project-scoped activity feed showing recent actions (validations, fixes, comments, exports)

### Cross-Dataset Validation

- [ ] **XVAL-01**: User can select two datasets within the same job for cross-dataset validation
- [ ] **XVAL-02**: System validates column-to-column consistency between paired datasets with configurable tolerance
- [ ] **XVAL-03**: Cross-dataset issues appear in the standard triage view under a "Cross-Dataset" category
- [ ] **XVAL-04**: Domain-specific cross-dataset presets exist (DOB vs DOC consistency, position vs event alignment)

### Custom Rule Builder

- [ ] **RULE-01**: User can create custom validation rules with IF/THEN conditions via a visual builder
- [ ] **RULE-02**: Rule builder supports three rule types: threshold check, column comparison, and null check
- [ ] **RULE-03**: Rules support AND/OR grouping (max 2 levels of nesting)
- [ ] **RULE-04**: User can test a rule against the current dataset and preview matching rows before saving
- [ ] **RULE-05**: Custom rules are saved to validation profiles and run alongside built-in validators

### Context-Aware QC

- [ ] **CTXQ-01**: User can define context zones/segments with associated threshold modifiers
- [ ] **CTXQ-02**: Validators apply context-specific thresholds instead of global defaults when a context match exists
- [ ] **CTXQ-03**: User can define event-conditional rules (e.g., "if event = trench crossing, relax depth thresholds")
- [ ] **CTXQ-04**: Domain QC packs include pre-configured context rules for common pipeline scenarios

## v1.2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Dataset Versioning (Enhanced)

- **DVER-06**: Cell-level diff highlighting between dataset versions (upgrade from row-level)

### Advanced Intelligence

- **ADVI-01**: Automatic context detection from data patterns (ML-based zone boundary identification)
- **ADVI-02**: AI-generated rule suggestions based on usage patterns
- **ADVI-03**: Notification digest emails (daily/weekly summary instead of individual)

### Conversion & Growth

- **CONV-01**: Usage-triggered in-app nudges approaching limits
- **CONV-02**: Soft locks — view results but gate exports when limit hit
- **CONV-03**: Value reinforcement emails at key milestones
- **CONV-04**: Interactive demo preview on landing page
- **CONV-05**: Social proof section (testimonials, case study metrics)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Full scripting engine for custom rules | Visual rule builder covers 90% of use cases; scripting invites security issues and unbounded complexity |
| Real-time collaborative editing | Survey engineers don't co-edit; sequential workflow with comments is sufficient |
| AI-generated validation rules | Rule library too small to train on; undermines trust without explainability |
| Blockchain-backed certificates | HMAC-SHA256 + verification endpoint provides equivalent tamper-evidence without complexity |
| Granular notification preferences | Simple on/off per category is enough at v1.1 scale; defer granular controls |
| Redis infrastructure | PostgreSQL-backed queue avoids new infrastructure for solo developer |
| Rule nesting beyond 2 levels | Complexity explosion for users and developers; 3 rule types with AND/OR is sufficient |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| JOBQ-01 | Phase 29 | Pending |
| JOBQ-02 | Phase 29 | Pending |
| JOBQ-03 | Phase 29 | Pending |
| JOBQ-04 | Phase 29 | Pending |
| JOBQ-05 | Phase 29 | Pending |
| JOBQ-06 | Phase 29 | Pending |
| DVER-01 | Phase 30 | Pending |
| DVER-02 | Phase 30 | Pending |
| DVER-03 | Phase 30 | Pending |
| DVER-04 | Phase 30 | Pending |
| DVER-05 | Phase 30 | Pending |
| CERT-01 | Phase 31 | Pending |
| CERT-02 | Phase 31 | Pending |
| CERT-03 | Phase 33 | Pending |
| CERT-04 | Phase 33 | Pending |
| CERT-05 | Phase 33 | Pending |
| COLB-01 | Phase 32 | Pending |
| COLB-02 | Phase 34 | Pending |
| COLB-03 | Phase 32 | Pending |
| COLB-04 | Phase 32 | Pending |
| COLB-05 | Phase 34 | Pending |
| XVAL-01 | Phase 35 | Pending |
| XVAL-02 | Phase 35 | Pending |
| XVAL-03 | Phase 35 | Pending |
| XVAL-04 | Phase 35 | Pending |
| RULE-01 | Phase 36 | Pending |
| RULE-02 | Phase 36 | Pending |
| RULE-03 | Phase 36 | Pending |
| RULE-04 | Phase 36 | Pending |
| RULE-05 | Phase 36 | Pending |
| CTXQ-01 | Phase 37 | Pending |
| CTXQ-02 | Phase 37 | Pending |
| CTXQ-03 | Phase 37 | Pending |
| CTXQ-04 | Phase 37 | Pending |

**Coverage:**
- v1.1 requirements: 34 total
- Mapped to phases: 34/34
- Unmapped: 0

---
*Requirements defined: 2026-04-11*
*Last updated: 2026-04-11 after roadmap creation*
