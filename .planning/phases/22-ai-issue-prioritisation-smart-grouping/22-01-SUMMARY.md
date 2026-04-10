---
phase: 22-ai-issue-prioritisation-smart-grouping
plan: 01
subsystem: ai
tags: [clustering, prioritisation, validation, typescript, tdd]

requires:
  - phase: 18-issue-triage-manual-overrides
    provides: ValidationIssue types for server and pipeline flows
provides:
  - Deterministic issue clustering engine (clusterIssues)
  - Priority scoring with severity weights (critical=10, warning=3, info=1)
  - Top blockers extraction (getTopBlockers)
  - Adapter functions for both server and pipeline ValidationIssue types
  - Shared AI types (ClusterInput, IssueCluster, AISummaryResponse)
affects: [22-02-ai-summary-api, pipeline-review, validation-results]

tech-stack:
  added: []
  patterns: [deterministic-clustering, adapter-pattern, severity-weighted-scoring]

key-files:
  created:
    - src/lib/ai/types.ts
    - src/lib/ai/cluster-issues.ts
    - src/lib/ai/cluster-issues.test.ts
  modified: []

key-decisions:
  - "Pluralisation logic: add 's' for count>1 unless label ends in 's' or contains 'data'"
  - "Cluster ID uses composite key rule_type::column_name for stable grouping"
  - "maxSeverity function determines cluster severity from highest individual issue severity"

patterns-established:
  - "Adapter pattern: separate adaptServerIssues/adaptPipelineIssues to normalise different ValidationIssue shapes into ClusterInput"
  - "RULE_LABELS constant for human-readable rule type names across both server and pipeline contexts"
  - "Priority scoring formula: SEVERITY_WEIGHT[severity] * count for deterministic ordering"

requirements-completed: [AIFR-03]

duration: 3min
completed: 2026-04-10
---

# Phase 22 Plan 01: Issue Clustering Engine Summary

**Deterministic issue clustering with TDD -- groups by rule_type+column_name, scores by severity*count, adapts both validation flows**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-10T18:49:45Z
- **Completed:** 2026-04-10T18:52:33Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 3

## Accomplishments
- Built deterministic clustering engine that groups validation issues by rule_type + column_name
- Priority scoring with severity weights (critical=10x, warning=3x, info=1x) multiplied by count
- Human-readable labels with KP ranges (e.g. "5 KP gaps in "DOB" between KP 10.0-50.0")
- Adapter functions bridging both Supabase server-side and pipeline client-side ValidationIssue types
- Full TDD with 10 tests covering grouping, sorting, labeling, adapters, and edge cases

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Types and test stubs** - `33634c6` (test)
2. **Task 1 GREEN: Clustering implementation** - `11fc753` (feat)

## Files Created/Modified
- `src/lib/ai/types.ts` - ClusterInput, IssueCluster, AISummaryResponse type definitions
- `src/lib/ai/cluster-issues.ts` - clusterIssues, getTopBlockers, adaptServerIssues, adaptPipelineIssues
- `src/lib/ai/cluster-issues.test.ts` - 10 tests for all clustering logic and adapters

## Decisions Made
- Cluster ID uses composite key `rule_type::column_name` for stable, deterministic grouping
- Pluralisation adds 's' for count > 1 unless label already ends in 's' or contains 'data'
- maxSeverity picks highest severity in cluster (critical > warning > info) for scoring
- RULE_LABELS covers both server rule types (missing_data, outliers_zscore) and pipeline types (missing, kp_gap)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Clustering engine ready for Plan 02 (AI summary API route)
- Types exported for consumption by UI components and API endpoints
- AISummaryResponse type defined for the LLM integration in Plan 02

---
*Phase: 22-ai-issue-prioritisation-smart-grouping*
*Completed: 2026-04-10*
