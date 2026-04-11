# Phase 8: Results Dashboard - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can review all QC results in an interactive dashboard with issue details and processing history. This phase delivers: issue viewer with severity grouping and expandable row detail, summary statistics with pass/fail verdict, per-dataset results on the file detail page, job-level results aggregation, and a processing history switcher for previous validation runs. PDF reports (Phase 9), data editing/correction (out of scope), and charting/visualization libraries (not needed) are excluded.

</domain>

<decisions>
## Implementation Decisions

### Issue Viewer Interaction
- Expandable rows in the issues table — click a row to expand inline showing full explanation, expected vs actual values, and surrounding data context
- 5 rows above and below the flagged row shown as surrounding context
- Severity tabs for filtering: All | Critical | Warning | Info — each showing count
- Sortable columns — click column headers to sort by row number, column name, or severity (matches existing ProjectsTable sorting pattern)

### Summary Statistics Display
- Stat cards only — no charting library needed
- Three cards: Total Issues (with severity breakdown badges), Pass Rate %, Data Completeness %
- Color-coded pass rate: green above 90%, yellow 70-90%, red below 70% (card border color)
- Severity breakdown badges in Total Issues card are clickable — clicking jumps to that severity tab in the issues table
- Prominent PASS/FAIL verdict at top — FAIL if any critical issues exist

### Dashboard Structure
- Per-dataset results on the file detail page — primary results view
- File detail page reorganized with tabs: Mapping | Results | Data Preview
- After validation, Results tab becomes active automatically
- Job-level Results tab shows summary table: dataset name, verdict (PASS/FAIL), issue count, pass rate, last run date
- Job-level aggregate header above table: "X of Y datasets validated — N total issues — M FAIL, K PASS"
- Clicking a dataset row in the job-level table navigates to that file's detail page

### Processing History
- Run list with dropdown switcher in the Results tab header (top-right, next to verdict)
- Each run entry shows: timestamp, profile name used (from config_snapshot), issue count
- Selecting a run loads its results into the dashboard below
- Latest run shown by default
- Runs are always kept — no delete option (audit trail preservation)

### Claude's Discretion
- Exact component structure and file organization
- How the expandable row animation works
- Pagination strategy for large issue lists
- How surrounding rows data is fetched (eager vs on-expand)
- Tab component implementation details
- Empty states for datasets with no validation runs
- Loading states while fetching issues
- How the run switcher dropdown is implemented (Select component vs custom)

</decisions>

<specifics>
## Specific Ideas

- Verdict (PASS/FAIL) gives engineers an instant signal — matches how QC reports work in survey industry
- Clickable severity badges create a shortcut from overview to filtered detail — one click from "3 critical" to seeing only critical issues
- Run switcher showing profile name helps engineers understand why results changed between runs (e.g., switched from DOB Template to Custom thresholds)
- 5 surrounding rows gives enough context to see if a flagged value is a sudden spike or part of a gradual trend
- Job-level aggregate header provides a quick job health check without drilling into individual datasets

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ValidationSummary` component (src/components/files/validation-summary.tsx) — displays severity badge grid, can be extended or replaced for the new stat cards layout
- `ValidationProgress` component — spinner + status text for processing state
- Badge component with established severity colors: destructive (critical), yellow (warning), blue (info), green (success)
- Card, Table, Tabs components from shadcn/ui — all needed primitives available
- Lucide icons: AlertTriangle, AlertCircle, Info, CheckCircle, XCircle for severity indicators
- Select component available for run switcher dropdown

### Established Patterns
- Client orchestrator pattern in FileDetailView — manages state locally, will need tabs added
- Server actions: `getValidationRuns()` and `getValidationIssues()` already exist with ownership checks
- Sortable tables pattern (ProjectsTable) with useState for column/direction
- Severity-based color coding consistent across app
- Realtime subscriptions for live status updates (RealtimeProvider)

### Integration Points
- File detail page (src/components/files/file-detail-view.tsx) — needs tab restructure: Mapping | Results | Data Preview
- Job detail page Results tab (src/app/(dashboard)/projects/[projectId]/jobs/[jobId]/page.tsx line ~137) — currently placeholder, needs job-level results table
- ValidationRun type has `config_snapshot` field for profile name in run switcher
- validation_issues table has all fields needed: row_number, column_name, severity, message, expected, actual, kp_value

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-results-dashboard*
*Context gathered: 2026-03-14*
