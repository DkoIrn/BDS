# Phase 8: Results Dashboard - Research

**Researched:** 2026-03-14
**Domain:** Next.js dashboard UI — tables, expandable rows, tabs, stat cards
**Confidence:** HIGH

## Summary

Phase 8 builds the results dashboard for QC validation output. This is a pure frontend phase — all data sources already exist (validation_runs, validation_issues tables, server actions with ownership checks). The work involves restructuring the file detail page with tabs, building an issues table with expandable rows, creating summary stat cards, adding a run history switcher, and building job-level aggregation.

The codebase already has all needed UI primitives (Tabs, Table, Card, Badge, Select from shadcn/ui with base-ui), established sorting patterns (ProjectsTable), and the existing ValidationSummary component as a starting point. The primary technical challenge is the expandable row detail with surrounding data context — this requires fetching the original parsed data rows to show 5 rows above/below a flagged row.

**Primary recommendation:** Restructure FileDetailView into a tabbed layout, replace ValidationSummary with the new stat cards + issues table, and add a server action for fetching surrounding row context on-demand (lazy load on expand).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Expandable rows in the issues table — click a row to expand inline showing full explanation, expected vs actual values, and surrounding data context
- 5 rows above and below the flagged row shown as surrounding context
- Severity tabs for filtering: All | Critical | Warning | Info — each showing count
- Sortable columns — click column headers to sort by row number, column name, or severity (matches existing ProjectsTable sorting pattern)
- Stat cards only — no charting library needed
- Three cards: Total Issues (with severity breakdown badges), Pass Rate %, Data Completeness %
- Color-coded pass rate: green above 90%, yellow 70-90%, red below 70% (card border color)
- Severity breakdown badges in Total Issues card are clickable — clicking jumps to that severity tab in the issues table
- Prominent PASS/FAIL verdict at top — FAIL if any critical issues exist
- Per-dataset results on the file detail page — primary results view
- File detail page reorganized with tabs: Mapping | Results | Data Preview
- After validation, Results tab becomes active automatically
- Job-level Results tab shows summary table: dataset name, verdict (PASS/FAIL), issue count, pass rate, last run date
- Job-level aggregate header above table: "X of Y datasets validated — N total issues — M FAIL, K PASS"
- Clicking a dataset row in the job-level table navigates to that file's detail page
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

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DASH-01 | User can view results dashboard with flagged issues grouped by severity | Severity tabs with counts, issues table with expandable rows, stat cards |
| DASH-02 | User can view summary statistics (total issues, pass rate, data completeness) | Three stat cards with color-coded borders, PASS/FAIL verdict banner |
| DASH-03 | User can view individual flagged rows with explanations | Expandable row detail showing message, expected/actual, surrounding rows context |
| PROJ-05 | User can view processing history for previous QC runs | Run switcher dropdown using Select component, loads run data on selection |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @base-ui/react | ^1.2.0 | Tabs, Select primitives | Already in use via shadcn/ui v4 |
| shadcn/ui components | v4 | Card, Table, Badge, Tabs, Select | Project standard — all needed primitives available |
| lucide-react | ^0.577.0 | Icons (AlertTriangle, AlertCircle, Info, CheckCircle, XCircle) | Already in use for severity indicators |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sonner | ^2.0.7 | Toast notifications | Error states when fetching issues fails |
| class-variance-authority | ^0.7.1 | Conditional styling | Card border colors for pass rate thresholds |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Expandable table rows | Separate detail panel | Inline expansion matches user expectation of "click to see more" |
| shadcn Select for run switcher | Custom dropdown | Select already exists and works; no reason to build custom |

**Installation:**
No new packages needed. All dependencies are already installed.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   └── files/
│       ├── file-detail-view.tsx        # MODIFY: add Tabs wrapper (Mapping | Results | Data Preview)
│       ├── validation-summary.tsx      # REPLACE: becomes stat cards + verdict
│       ├── results-dashboard.tsx       # NEW: orchestrates stat cards + issues table + run switcher
│       ├── results-stat-cards.tsx      # NEW: three stat cards with verdict
│       ├── issues-table.tsx            # NEW: sortable table with severity tabs + expandable rows
│       ├── issue-row-detail.tsx        # NEW: expanded row content (explanation + surrounding context)
│       └── run-switcher.tsx            # NEW: Select dropdown for processing history
├── components/
│   └── jobs/
│       └── job-results-table.tsx       # NEW: job-level aggregation table
├── lib/
│   └── actions/
│       └── validation.ts              # MODIFY: add getIssueContext() for surrounding rows, add getJobValidationSummary()
```

### Pattern 1: FileDetailView Tab Restructure
**What:** Wrap existing FileDetailView content in Tabs (Mapping | Results | Data Preview). Current column mapping + validation profile + run button go under "Mapping". New results dashboard goes under "Results". Existing DataPreviewTable goes under "Data Preview".
**When to use:** When dataset status is 'validated', auto-activate Results tab.
**Example:**
```typescript
// Using existing Tabs component from @base-ui/react
<Tabs defaultValue={datasetStatus === 'validated' ? 'results' : 'mapping'}>
  <TabsList>
    <TabsTrigger value="mapping">Mapping</TabsTrigger>
    <TabsTrigger value="results">Results</TabsTrigger>
    <TabsTrigger value="preview">Data Preview</TabsTrigger>
  </TabsList>
  <TabsContent value="mapping">
    {/* Existing column mapping + profile + run button */}
  </TabsContent>
  <TabsContent value="results">
    <ResultsDashboard datasetId={dataset.id} />
  </TabsContent>
  <TabsContent value="preview">
    <DataPreviewTable ... />
  </TabsContent>
</Tabs>
```

### Pattern 2: Expandable Table Rows
**What:** Click a table row to expand inline, showing detail panel below the row.
**When to use:** Issues table — each row expands to show full explanation + surrounding data.
**Example:**
```typescript
// Use state to track expanded row IDs
const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

function toggleRow(issueId: string) {
  setExpandedRows(prev => {
    const next = new Set(prev)
    if (next.has(issueId)) next.delete(issueId)
    else next.add(issueId)
    return next
  })
}

// In table body:
{issues.map(issue => (
  <Fragment key={issue.id}>
    <TableRow
      className="cursor-pointer hover:bg-muted/50"
      onClick={() => toggleRow(issue.id)}
    >
      {/* Row cells */}
    </TableRow>
    {expandedRows.has(issue.id) && (
      <TableRow>
        <TableCell colSpan={columnCount}>
          <IssueRowDetail issue={issue} datasetId={datasetId} />
        </TableCell>
      </TableRow>
    )}
  </Fragment>
))}
```

### Pattern 3: Sorting Pattern (from ProjectsTable)
**What:** Client-side sorting with useState for column and direction.
**When to use:** Issues table with sortable columns (row number, column name, severity).
**Example:**
```typescript
type SortColumn = 'row_number' | 'column_name' | 'severity'
type SortDirection = 'asc' | 'desc'

const [sortColumn, setSortColumn] = useState<SortColumn>('row_number')
const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

function handleSort(column: SortColumn) {
  if (sortColumn === column) {
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
  } else {
    setSortColumn(column)
    setSortDirection('asc')
  }
}

// Sort with severity ordinal mapping (same as validation.ts pattern)
const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 }
```

### Pattern 4: Surrounding Rows Context (Lazy Load)
**What:** Fetch the 5 rows above and below a flagged row from the original file, on-demand when the row is expanded.
**When to use:** IssueRowDetail component — fetch on mount.
**Recommendation:** Create a new API route or server action that re-parses the file and extracts rows [rowNum-5, rowNum+5]. The parse API already downloads and parses the file; extract this into a reusable utility.
**Example:**
```typescript
// New server action: getIssueContext(datasetId, rowNumber, contextSize = 5)
// Returns: { headers: string[], rows: { rowNumber: number, cells: string[], isFlagged: boolean }[] }
// This fetches from Supabase storage, parses, and returns the slice
```

### Anti-Patterns to Avoid
- **Fetching all surrounding context eagerly:** Would multiply data transfer by 11x per issue. Fetch on-expand only.
- **Re-rendering entire issues list on expand:** Use React.Fragment with conditional row, not a separate table.
- **Storing parsed file data in client state:** Files can be large; only fetch the slice needed for context.
- **Duplicating severity color logic:** Extract severity-to-color mapping into a shared utility since it's used in badges, table rows, stat cards, and verdict.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tab navigation | Custom tab state machine | shadcn Tabs (base-ui) | Already styled and accessible |
| Dropdown selection | Custom dropdown | shadcn Select (base-ui) | Already handles keyboard nav, portal rendering |
| Severity colors | Ad-hoc className strings | Shared utility mapping severity to Tailwind classes | Used in 5+ places across this phase |
| Table sorting | Custom sort implementation | Copy ProjectsTable pattern exactly | Proven pattern, consistent UX |

**Key insight:** Every UI primitive needed for this phase already exists in the project. The work is composition, not creation.

## Common Pitfalls

### Pitfall 1: Tab Default Value on Re-render
**What goes wrong:** Tabs defaultValue only applies on mount. If dataset status changes to 'validated' while user is viewing the page, tabs don't auto-switch.
**Why it happens:** base-ui Tabs with defaultValue is uncontrolled.
**How to avoid:** Use controlled value prop with useState. Update the state when realtime subscription fires 'validated' status.
**Warning signs:** User runs validation but stays on Mapping tab; has to manually click Results.

### Pitfall 2: File Re-parsing Performance for Context Rows
**What goes wrong:** Every row expansion triggers a full file download + parse just to get 11 rows.
**Why it happens:** No cached/indexed version of parsed data exists server-side.
**How to avoid:** Cache the parsed rows in the server action (or use a simple in-memory cache keyed by datasetId). Alternatively, accept the performance cost for MVP since files are max 50MB and parsing is fast. Consider adding a `parsed_data` column later if needed.
**Warning signs:** Expanding a row takes >2 seconds.

### Pitfall 3: Run Switcher Stale State
**What goes wrong:** Switching runs but issues table still shows previous run's data.
**Why it happens:** Issues are fetched per-run, and the fetch is async. Old state visible during loading.
**How to avoid:** Show loading skeleton when run changes. Clear issues state immediately on run switch, then fetch.
**Warning signs:** Mismatched run timestamp and issue data displayed simultaneously.

### Pitfall 4: Job-Level Data Fetching
**What goes wrong:** Job detail page needs to aggregate across all datasets — total issues, pass rates — but no single query provides this.
**Why it happens:** Each dataset has independent validation runs. Need to join datasets with their latest validation run.
**How to avoid:** Create a dedicated server action `getJobValidationSummary(jobId)` that fetches all datasets for the job and their latest validation run in one query using Supabase relational queries.
**Warning signs:** N+1 queries — one per dataset to get its latest run.

### Pitfall 5: Severity Tab Counts vs Filtered List Mismatch
**What goes wrong:** Tab shows "3 Critical" but filtering shows 2 rows because count comes from run summary but list comes from issues query.
**Why it happens:** Using run.critical_count for tab badge but filtering issues client-side.
**How to avoid:** Derive tab counts from the actual issues array, not from the run summary. This ensures consistency: `issues.filter(i => i.severity === 'critical').length`.
**Warning signs:** Count badges don't match visible rows in the filtered table.

## Code Examples

### Verdict Banner
```typescript
// PASS if zero critical issues, FAIL otherwise
const verdict = run.critical_count === 0 ? 'PASS' : 'FAIL'

<div className={cn(
  "rounded-lg border-2 p-4 flex items-center gap-3",
  verdict === 'PASS'
    ? "border-green-500 bg-green-50 dark:bg-green-950/30"
    : "border-red-500 bg-red-50 dark:bg-red-950/30"
)}>
  {verdict === 'PASS'
    ? <CheckCircle className="size-6 text-green-600" />
    : <XCircle className="size-6 text-red-600" />
  }
  <span className="text-lg font-bold">
    {verdict}
  </span>
</div>
```

### Pass Rate Color Logic
```typescript
function getPassRateColor(rate: number): string {
  if (rate >= 90) return "border-green-500"
  if (rate >= 70) return "border-yellow-500"
  return "border-red-500"
}
```

### Run Switcher with Profile Name
```typescript
// config_snapshot has the profile config; profile_id links to named profile
// For display: show run timestamp + issue count, profile name from config_snapshot context
<Select value={selectedRunId} onValueChange={handleRunChange}>
  <SelectTrigger className="w-[280px]">
    <SelectValue placeholder="Select run" />
  </SelectTrigger>
  <SelectContent>
    {runs.map(run => (
      <SelectItem key={run.id} value={run.id}>
        {formatRunDate(run.run_at)} — {run.total_issues} issues
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

### Severity Filter Tabs
```typescript
type SeverityFilter = 'all' | 'critical' | 'warning' | 'info'

const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all')

const filteredIssues = severityFilter === 'all'
  ? issues
  : issues.filter(i => i.severity === severityFilter)

// Using Tabs component for visual consistency
<Tabs value={severityFilter} onValueChange={(v) => setSeverityFilter(v as SeverityFilter)}>
  <TabsList>
    <TabsTrigger value="all">All ({issues.length})</TabsTrigger>
    <TabsTrigger value="critical">Critical ({issues.filter(i => i.severity === 'critical').length})</TabsTrigger>
    <TabsTrigger value="warning">Warning ({issues.filter(i => i.severity === 'warning').length})</TabsTrigger>
    <TabsTrigger value="info">Info ({issues.filter(i => i.severity === 'info').length})</TabsTrigger>
  </TabsList>
</Tabs>
```

### Job-Level Summary Query
```typescript
// Server action: getJobValidationSummary(jobId)
// Uses Supabase relational query to get datasets with their latest run
const { data: datasets } = await supabase
  .from('datasets')
  .select('id, file_name, status, validation_runs(id, total_issues, critical_count, pass_rate, run_at, status)')
  .eq('job_id', jobId)
  .eq('user_id', user.id)
  .order('run_at', { referencedTable: 'validation_runs', ascending: false })

// For each dataset, take only the first (latest) run
const summary = datasets.map(d => ({
  id: d.id,
  fileName: d.file_name,
  verdict: (d.validation_runs?.[0]?.critical_count ?? 0) === 0 ? 'PASS' : 'FAIL',
  issueCount: d.validation_runs?.[0]?.total_issues ?? 0,
  passRate: d.validation_runs?.[0]?.pass_rate ?? null,
  lastRunAt: d.validation_runs?.[0]?.run_at ?? null,
  isValidated: d.status === 'validated',
}))
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ValidationSummary card (simple badges) | Full dashboard with expandable issues table | This phase | Major enhancement to results visibility |
| No processing history | Run switcher dropdown | This phase | Enables comparison across validation runs |
| File detail shows all sections linearly | Tabbed layout (Mapping/Results/Preview) | This phase | Cleaner UX, less scrolling |

**Deprecated/outdated:**
- ValidationSummary component: Will be replaced by ResultsDashboard. Can be deleted or kept as fallback for non-validated states.

## Open Questions

1. **Surrounding rows context performance**
   - What we know: Files are max 50MB, parse API already downloads and parses entire file. The parse route returns only first 50 preview rows.
   - What's unclear: Whether re-downloading and re-parsing per expand is acceptable latency for MVP, or if a cached approach is needed.
   - Recommendation: Start with on-demand re-parse approach. If latency is noticeable, add a simple server-side LRU cache keyed by datasetId. The file parse is already proven fast enough for the parse API route.

2. **Pagination for large issue lists**
   - What we know: getValidationIssues() currently returns all issues for a run with no limit.
   - What's unclear: How many issues a typical validation run produces. If thousands, client-side filtering may be slow.
   - Recommendation: Start without pagination. Add client-side pagination (e.g., 50 issues per page) if performance degrades. The issues are already fetched in one call — paginating the display is trivial with array slicing.

3. **Profile name display in run switcher**
   - What we know: ValidationRun has config_snapshot (full config object) and profile_id (nullable UUID). Profile name is not stored on the run record.
   - What's unclear: Whether to join to validation_profiles table for name, or store profile name in the run record.
   - Recommendation: Show the profile_id display as a secondary concern. For MVP, show timestamp + issue count in the run switcher. If profile_id is present, fetch the profile name with a separate lightweight query, or just show "Custom profile" vs "Default template".

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 + @testing-library/react 16.3.2 + jsdom |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DASH-01 | Issues grouped by severity with tab filtering | unit | `npx vitest run tests/components/issues-table.test.tsx -x` | No — Wave 0 |
| DASH-02 | Summary stat cards show correct values and colors | unit | `npx vitest run tests/components/results-stat-cards.test.tsx -x` | No — Wave 0 |
| DASH-03 | Expandable row shows explanation and context | unit | `npx vitest run tests/components/issue-row-detail.test.tsx -x` | No — Wave 0 |
| PROJ-05 | Run switcher loads different run data | unit | `npx vitest run tests/components/run-switcher.test.tsx -x` | No — Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/components/issues-table.test.tsx` — covers DASH-01 severity filtering and sorting
- [ ] `tests/components/results-stat-cards.test.tsx` — covers DASH-02 stat card rendering and color thresholds
- [ ] `tests/components/issue-row-detail.test.tsx` — covers DASH-03 expanded detail display
- [ ] `tests/components/run-switcher.test.tsx` — covers PROJ-05 run selection behavior

## Sources

### Primary (HIGH confidence)
- Project codebase — file-detail-view.tsx, validation-summary.tsx, validation.ts actions, validation types
- Project codebase — ProjectsTable sorting pattern, Tabs/Select/Card/Table/Badge components
- Project codebase — job detail page (placeholder Results tab at line ~137)
- CONTEXT.md — locked decisions from discuss-phase session

### Secondary (MEDIUM confidence)
- base-ui Tabs API — controlled vs uncontrolled value prop behavior
- Supabase relational queries — nested select with order on referenced table

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in use, no new dependencies
- Architecture: HIGH — extends existing patterns (tabs, sorting, server actions) with well-understood composition
- Pitfalls: HIGH — identified from direct code analysis of existing components and data flow

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (stable — no external dependencies changing)
