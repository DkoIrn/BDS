# Feature Research

**Domain:** Pipeline & seabed survey data QA/validation platform (vertical SaaS)
**Researched:** 2026-03-10
**Confidence:** MEDIUM-HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| File upload (CSV, Excel) | Engineers work with tabular exports from survey systems; drag-and-drop upload is baseline UX | LOW | 50MB cap is fine for MVP; most survey exports are 1-20MB. Support .csv, .xlsx, .xls |
| Column auto-detection & mapping | Survey exports vary by client/instrument; users need the system to recognize KP, DOB, DOC, TOP, easting, northing, etc. | MEDIUM | Use header-name heuristics + let users confirm/override. Critical for first-run experience |
| Configurable validation rules | Every client has different tolerances and specs; hard-coded rules are useless | MEDIUM | Provide sensible defaults (e.g., DOB range 0-5m, KP monotonically increasing) but let users create/edit profiles |
| Range & tolerance checks | Most basic QC check -- values outside acceptable bounds | LOW | Min/max, delta between consecutive readings, absolute thresholds |
| Missing data detection | Gaps in KP coverage, null cells, incomplete rows are the most common data issue | LOW | Flag missing cells, highlight KP gaps, report coverage percentage |
| Duplicate detection | Duplicate KP entries or repeated rows are common copy-paste/export errors | LOW | Exact and near-duplicate detection on key columns |
| Anomaly/outlier flagging | Statistical spikes in DOB/DOC/TOP measurements indicate instrument errors or real issues; users need both surfaced | MEDIUM | Z-score, IQR, rolling window deviation. Mark as "statistical outlier" not "error" -- user decides |
| Results dashboard with issue summary | Engineers need an at-a-glance view: how many issues, what severity, where along the pipeline | MEDIUM | Summary stats + issue list grouped by severity + KP location reference |
| Downloadable QC report (PDF) | The primary deliverable. Clients expect a formatted document they can hand to their client | MEDIUM | Must include: summary, methodology, issue table, pass/fail status, company branding placeholder |
| Downloadable cleaned dataset | After reviewing flags, users want to export the corrected/validated data | LOW | Export as CSV/Excel with flagged rows annotated or removed per user choice |
| Project/job organization | Survey companies run dozens of jobs simultaneously; data must be organized by project and job | LOW | Hierarchical: Client > Project > Survey Job > Datasets > Reports |
| User authentication & accounts | Multi-user access with secure login | LOW | Supabase Auth handles this. Email/password for MVP |
| Async processing with status | Large files take time; users must not stare at a spinner | LOW | Upload > "Processing..." > notification/email when done |

### Differentiators (Competitive Advantage)

Features that set SurveyQC AI apart from manual spreadsheet QC and from heavyweight desktop tools like EIVA NaviSuite or VisualSoft.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Explainable flags with plain-English reasoning | Every flagged issue includes WHY it was flagged ("DOB value of 8.3m exceeds project tolerance of 5.0m at KP 12.445"). Competitors show red cells; we show reasoning | MEDIUM | This is the core differentiator per PROJECT.md. Engineers need to trust and understand each flag to sign off on QC |
| Cross-dataset consistency checks | Compare event listings against pipeline position data, verify DOB matches DOC+TOP geometry, check ROV inspection events align with survey KPs | HIGH | This catches errors that single-file checks miss. E.g., freespan event at KP 4.200 but DOB data shows full burial at that KP |
| Pre-built survey-type templates | One-click validation profiles for DOB surveys, DOC surveys, pipeline route surveys, ROV inspection data -- not generic "data quality" rules | MEDIUM | Domain expertise baked into templates. Competitors are either generic (Great Expectations) or heavyweight desktop (EIVA). This is the sweet spot |
| GC (General Condition) report generation | Auto-generate formatted GC reports from validated data with event summaries, burial status tables, freespan listings, anomaly logs | HIGH | This replaces hours of manual report writing. Must match industry-expected format. Huge time-saver and primary sales hook |
| KP-referenced issue visualization | Show issues plotted along the pipeline chainage (KP axis), not just in a table. Engineers think in KP, not row numbers | MEDIUM | Simple KP-vs-value chart with flagged points highlighted. Does not need to be a full GIS -- a 2D profile plot is sufficient and expected |
| Validation profile library (shareable) | Teams can create, save, and share validation rule sets across projects. New project? Apply last client's profile | LOW | Profiles stored per organization. Clone and modify. Saves setup time on repeat clients |
| Monotonicity & sequence validation | KP values must be monotonically increasing, event sequences must follow logical order (e.g., "start burial" before "end burial") | MEDIUM | Domain-specific logic that generic tools don't have. Catches data ordering errors from instrument exports |
| Batch processing (multiple files per job) | Upload 5 datasets for one survey job, validate all against each other and individually | MEDIUM | Real workflow: DOB file + event listing + pipeline position data all uploaded together and cross-referenced |
| Tier-gated AI analysis (future) | Professional/Enterprise tiers get AI-powered natural language summaries of QC results, suggested corrections, trend analysis | HIGH | Not MVP. Layer on after rule-based engine is proven. Use OpenAI/Claude API for summarization |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Raw sensor data processing | "Can it read raw multibeam/sonar files?" | Massively complex, requires specialized parsers (Kongsberg .all, Reson .s7k, etc.), and competitors like EIVA/QPS own this space | Stay firmly in the "post-processed deliverables" lane. Accept CSV/Excel exports that survey processors already produce |
| Real-time vessel data integration | "Can it connect to the survey vessel?" | Requires hardware integration, real-time protocols (SIS, NaviPac), vessel IT infrastructure access. Completely different product | Focus on post-survey QC. Vessel-side QC is done by EIVA/VisualSoft. We validate the deliverables after |
| GIS/mapping visualization | "Show the pipeline on a map" | Requires coordinate reference system handling, map tiles, GIS libraries. Huge scope creep for limited QC value | Use KP-based profile plots instead. If users need GIS, they already have QGIS/ArcGIS. Export clean data for those tools |
| Full CAD/GIS export (shapefiles, DXF) | "Export to AutoCAD/ArcGIS" | Multiple complex format specifications, projection handling, attribute mapping | Offer CSV/Excel export with coordinates. Users can import into their existing GIS tools. Add shapefile export in v2+ if demand proves real |
| Custom ML model training | "Let me train my own anomaly model" | Requires ML ops infrastructure, training data management, model versioning. Solo dev cannot maintain this | Provide configurable statistical thresholds. Future: pre-trained models per survey type that improve over time, but users don't train them |
| Built-in data editing/correction | "Let me fix the data right in the app" | Turns a QC tool into a spreadsheet. Engineers already have Excel. Editing introduces liability questions | Flag issues clearly with enough context to fix in source. Offer "export with annotations" so fixes happen in the engineer's tool of choice |
| Real-time collaboration/commenting | "Let users comment on flags like Google Docs" | Complex real-time sync, conflict resolution, significant frontend complexity | Single-user review workflow for MVP. Add simple "resolved/not resolved" status per flag. Multi-user review can come later |
| Video/image annotation for ROV data | "Tag defects on ROV video frames" | Entirely different product category (VisualSoft territory), massive storage/streaming requirements | Accept ROV inspection data exports (event listings, measurements). Leave video handling to specialized tools |
| Coordinate transformations (datum/projection) | "Convert between WGS84 and local grid" | Geodetic transformations are complex and error-prone. Many edge cases by geography | Accept data in whatever CRS the user has. If coordinates are present, validate consistency but don't transform. Defer to v2+ |

## Feature Dependencies

```
[User Auth]
    |
    v
[Project/Job Structure]
    |
    v
[File Upload & Storage]
    |
    +-----> [Column Auto-Detection]
    |           |
    |           v
    |       [Validation Rule Engine] <--- [Validation Profile Templates]
    |           |
    |           +-----> [Range/Tolerance Checks]
    |           +-----> [Missing Data Detection]
    |           +-----> [Duplicate Detection]
    |           +-----> [Monotonicity/Sequence Checks]
    |           +-----> [Anomaly/Outlier Detection]
    |           |
    |           v
    |       [Explainable Flag Generation]
    |           |
    |           v
    +-----> [Results Dashboard]
    |           |
    |           +-----> [KP-Referenced Visualization]
    |           +-----> [Issue Summary & Statistics]
    |           |
    |           v
    |       [QC Report Generation (PDF)]
    |       [GC Report Generation]
    |       [Cleaned Dataset Export]
    |
    v
[Batch Processing] ----requires----> [Cross-Dataset Consistency Checks]

[Validation Profile Library] ----enhances----> [Validation Rule Engine]

[Subscription Tiers] ----gates----> [Batch Processing (Professional+)]
                     ----gates----> [GC Report Generation (Professional+)]
                     ----gates----> [AI Analysis (Enterprise)]
```

### Dependency Notes

- **Validation Rule Engine requires Column Auto-Detection:** Rules reference column names/types. The system must know which column is KP, which is DOB, etc. before rules can execute.
- **Explainable Flags require Validation Rule Engine:** Each rule produces a flag with context. The flag text is generated during rule execution, not after.
- **Cross-Dataset Consistency requires Batch Processing:** You can only cross-reference datasets if multiple files are uploaded to the same job.
- **GC Report Generation requires Results Dashboard:** The GC report is essentially a formatted export of the dashboard data plus additional summaries. Build the dashboard data model first.
- **KP Visualization enhances Results Dashboard:** Optional but high-value addition to the dashboard. Can be added after initial dashboard ships.
- **Profile Library enhances Rule Engine:** Not required for rules to work (defaults suffice), but dramatically improves repeat-use experience.

## MVP Definition

### Launch With (v1)

Minimum viable product -- what's needed for a small survey company to upload a dataset and get value.

- [ ] User auth (email/password via Supabase) -- gate access, track usage
- [ ] Project/job hierarchy -- organize datasets logically
- [ ] CSV/Excel upload (max 50MB) to Supabase Storage -- get data in
- [ ] Column auto-detection with manual override -- map columns to survey data types
- [ ] Default validation profiles for DOB, DOC, TOP surveys -- out-of-box value
- [ ] Core validation checks: range, missing data, duplicates, monotonicity -- catch the most common issues
- [ ] Statistical anomaly detection (z-score, IQR) -- catch spikes and outliers
- [ ] Explainable flags on every issue -- the core differentiator
- [ ] Results dashboard with issue list and summary stats -- view and review results
- [ ] Downloadable QC report (PDF) -- the primary deliverable
- [ ] Downloadable cleaned/annotated dataset (CSV/Excel) -- take corrected data downstream
- [ ] Async processing with status indicator -- handle large files gracefully
- [ ] Starter tier (free or low-cost, limited uploads) -- get users in the door

### Add After Validation (v1.x)

Features to add once core QC workflow is proven and users are giving feedback.

- [ ] Custom validation rule creation (user-defined) -- when users outgrow defaults
- [ ] Validation profile library (save, clone, share) -- when users have repeat projects
- [ ] KP-referenced profile visualization -- when users request visual QC review
- [ ] Cross-dataset consistency checks -- when users upload multiple related files
- [ ] GC report generation (formatted industry-standard) -- when users ask to replace their manual report writing
- [ ] Batch file upload per job -- when users want full job processing
- [ ] Professional tier with expanded limits -- when conversion/retention metrics support it
- [ ] Email notifications on processing completion -- when async jobs are common

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] AI-powered natural language QC summaries -- requires API cost management, tier gating
- [ ] AI-suggested data corrections -- needs confidence in rule engine first
- [ ] API access for pipeline integration (Enterprise tier) -- when enterprise customers request it
- [ ] Team management and role-based access -- when multi-user orgs adopt
- [ ] Coordinate validation and basic CRS checks -- when geo-awareness adds value
- [ ] Advanced file format support (LAS, shapefiles) -- when market demands it
- [ ] Audit trail / version history for QC runs -- when compliance-focused clients appear
- [ ] White-label reporting (client branding on reports) -- Enterprise tier perk

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| File upload (CSV/Excel) | HIGH | LOW | P1 |
| Column auto-detection | HIGH | MEDIUM | P1 |
| Default validation profiles (DOB/DOC/TOP) | HIGH | MEDIUM | P1 |
| Range/tolerance checks | HIGH | LOW | P1 |
| Missing data detection | HIGH | LOW | P1 |
| Duplicate detection | MEDIUM | LOW | P1 |
| Anomaly/outlier detection | HIGH | MEDIUM | P1 |
| Explainable flags | HIGH | MEDIUM | P1 |
| Results dashboard | HIGH | MEDIUM | P1 |
| QC report (PDF) | HIGH | MEDIUM | P1 |
| Cleaned dataset export | MEDIUM | LOW | P1 |
| Project/job organization | MEDIUM | LOW | P1 |
| Auth & accounts | HIGH | LOW | P1 |
| Async processing | HIGH | LOW | P1 |
| Monotonicity/sequence checks | MEDIUM | LOW | P1 |
| Custom validation rules | MEDIUM | MEDIUM | P2 |
| Validation profile library | MEDIUM | LOW | P2 |
| KP-referenced visualization | MEDIUM | MEDIUM | P2 |
| Cross-dataset consistency | HIGH | HIGH | P2 |
| GC report generation | HIGH | HIGH | P2 |
| Batch processing | MEDIUM | MEDIUM | P2 |
| AI analysis summaries | MEDIUM | HIGH | P3 |
| API access | LOW | MEDIUM | P3 |
| Team management / RBAC | LOW | MEDIUM | P3 |
| White-label reporting | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible (v1.x)
- P3: Nice to have, future consideration (v2+)

## Competitor Feature Analysis

| Feature | EIVA NaviSuite | VisualSoft | Coda Octopus Survey Engine | Manual (Excel) | SurveyQC AI (Our Approach) |
|---------|---------------|------------|---------------------------|----------------|---------------------------|
| Target user | Survey vessel operators, large contractors | ROV/inspection teams on vessel | Geophysicists interpreting sonar data | Anyone | Small survey companies doing post-survey QC |
| Deployment | Desktop (vessel-installed) | Desktop (vessel-installed) | Desktop | Desktop | Web SaaS (browser-based) |
| Price point | $10K-50K+ licenses | $10K-50K+ licenses | $10K-30K+ licenses | Free (but hours of labor) | $49-499/mo SaaS tiers |
| Data input | Raw sensor data + processed | Raw video + sensor | Raw sidescan sonar | Any CSV/Excel | CSV/Excel deliverables |
| Real-time acquisition | Yes | Yes | Yes | No | No (post-survey) |
| Automated QC checks | Some (positioning QC) | Limited (data consistency) | Limited (interpretation tools) | Manual formulas | Yes -- core product |
| Explainable flags | No | No | No | N/A (manual review) | Yes -- every flag explained |
| GC reporting | Integrated | Integrated | Export-based | Manual writing | Auto-generated |
| Anomaly detection | Basic | Basic | Basic | Manual (conditional formatting) | Statistical + configurable |
| Cross-dataset validation | Within suite only | Within suite only | No | Manual cross-reference | Automated (v1.x) |
| Accessibility | Vessel/office desktop | Vessel/office desktop | Office desktop | Anywhere | Anywhere (browser) |

### Competitive Positioning

The existing tools (EIVA, VisualSoft, Coda Octopus) are **acquisition and processing** platforms -- they run on survey vessels and process raw sensor data. They cost $10K-50K+ and require training. They are NOT competitors; they are **upstream tools** whose outputs become our inputs.

Our real competitor is **Excel + manual checking** -- the current workflow for small companies that receive processed survey deliverables and must QC them before client delivery. We replace that manual process with automated, explainable validation at a SaaS price point.

## Sources

- [EIVA NaviSuite QC Toolbox -- BP Case Study](https://www.eiva.com/about/case-studies/cable-pipe-and-asset-inspections/navisuite-qc-toolbox-bp) -- NaviSuite QC capabilities
- [VisualSoft Subsea Survey Software](https://f-e-t.com/subsea/software-and-control-system-solutions/visualsoft/) -- VisualSoft feature overview
- [Coda Octopus Survey Engine Pipeline+](https://www.codaoctopus.com/products/geo/survey-engine-pipeline) -- Pipeline interpretation features
- [EIVA NaviSuite Deep Learning Pipeline Inspection](https://www.eiva.com/products/navisuite/navisuite-processing-software/navisuite-deep-learning-pipeline-inspection) -- AI inspection features
- [Hydro International -- Quality Control of Survey Data](https://www.hydro-international.com/content/article/quality-control-of-survey-data) -- Survey QC pain points
- [Anomalo -- Data Validation Platform](https://www.anomalo.com/) -- General data quality platform patterns
- [QPS Fledermaus Pipeline Visualization](https://confluence.qps.nl/fledermaus7/reference-manual/scientific-data-sd-types/pipeline-visualization-classes) -- Pipeline data types and KP conventions

---
*Feature research for: Pipeline & seabed survey data QA/validation platform*
*Researched: 2026-03-10*
