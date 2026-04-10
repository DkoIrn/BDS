# Phase 22: AI Issue Prioritisation & Smart Grouping - Research

**Researched:** 2026-04-10
**Domain:** AI-driven validation intelligence (clustering, summarisation, recommendations)
**Confidence:** HIGH

## Summary

This phase adds an AI intelligence layer on top of existing validation results. The codebase already has a working Anthropic SDK integration (`@anthropic-ai/sdk ^0.81.0`) in the ai-clean route, a `ValidationIssue` type with `rule_type`, `severity`, `message`, `row_number`, `column_name`, and `kp_value` fields, and two validation flows (project-based server-side via Supabase, pipeline client-side via `client-validate.ts`). The phase needs to: (1) cluster similar issues deterministically (no AI needed), (2) call Anthropic to generate a natural-language summary and accept/reject recommendation, and (3) surface "Top 3 Blockers" in the UI.

The key architectural insight is that **clustering and prioritisation should be deterministic** (group by `rule_type` + `column_name` + KP proximity), while the **natural-language summary and accept/reject recommendation use the Anthropic API**. This keeps costs low, results fast, and AI calls to a single request per analysis. The existing `ai-clean` route pattern (auth check, SDK instantiation, JSON extraction from response) should be reused exactly.

**Primary recommendation:** Build a pure-function clustering/prioritisation engine in TypeScript (works both client-side and server-side), then a single API route that sends the clustered summary to Claude for natural-language narrative + accept/reject recommendation.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AIFR-01 | AI-powered natural language summaries of QC results | Anthropic SDK already integrated; single API call with clustered issue data produces narrative summary |
| AIFR-03 | AI-driven issue prioritisation with top blockers and clustering | Deterministic clustering by rule_type + column_name + KP range; priority scoring by severity weight x count |
| AIFR-04 | Dataset accept/reject recommendation with confidence score | AI generates recommendation based on issue severity distribution, critical count, and pass rate |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @anthropic-ai/sdk | ^0.81.0 | AI summary + recommendation generation | Already installed and used in ai-clean route |
| TypeScript | (project version) | Clustering/prioritisation logic | Pure functions, testable, no extra deps |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sonner | (existing) | Toast notifications for AI analysis loading states | Already used project-wide |
| lucide-react | (existing) | Icons for blocker cards, cluster UI, recommendation badge | Already used project-wide |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Client-side clustering | Server-side clustering in Python | Unnecessary -- issue lists are small (<500 typically), TS is fine |
| Multiple AI calls per cluster | Single AI call with all data | Single call is cheaper, faster, and produces more coherent narrative |
| OpenAI/other LLM | Anthropic Claude | Already integrated, API key in .env.local, proven pattern |

**Installation:**
No new packages needed. All dependencies already installed.

## Architecture Patterns

### Recommended Project Structure
```
src/
  lib/
    ai/
      cluster-issues.ts          # Pure function: group + prioritise issues
      types.ts                   # IssueCluster, AISummary, Recommendation types
  app/
    api/
      ai-summary/
        route.ts                 # POST: auth + Anthropic call for summary + recommendation
  components/
    files/
      ai-summary-panel.tsx       # Top blockers + narrative + recommendation UI
      issue-cluster.tsx          # Expandable cluster component
```

### Pattern 1: Deterministic Clustering
**What:** Group validation issues by `rule_type` + `column_name`, then sub-cluster by KP proximity within each group
**When to use:** Always -- this is the primary data transformation before any AI call or UI rendering
**Example:**
```typescript
// src/lib/ai/cluster-issues.ts
interface IssueCluster {
  id: string
  rule_type: string
  column_name: string
  severity: 'critical' | 'warning' | 'info'
  count: number
  label: string         // e.g. "23 KP gaps between KP 102-118"
  kp_range?: { min: number; max: number }
  row_range?: { min: number; max: number }
  issues: ValidationIssue[]  // individual instances
}

function clusterIssues(issues: ValidationIssue[]): IssueCluster[] {
  // 1. Group by rule_type + column_name
  // 2. Within each group, sub-cluster by KP proximity (issues within 5x median spacing)
  // 3. Generate human-readable label per cluster
  // 4. Sort by priority score: severity_weight * count (critical=10, warning=3, info=1)
  // 5. Return sorted clusters
}
```

### Pattern 2: Single AI Call for Summary + Recommendation
**What:** Send clustered issue summary (not raw issues) to Anthropic, get back narrative + accept/reject + confidence
**When to use:** After clustering is complete, triggered by user action or automatically on results load
**Example:**
```typescript
// API route pattern matching existing ai-clean route
const message = await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1500,
  messages: [{
    role: "user",
    content: `You are a survey data QC specialist. Analyze these validation results and provide:
1. A 2-3 sentence plain-English summary
2. The top 3 most impactful issues (blockers)
3. An accept/reject recommendation with confidence percentage (0-100%)

Dataset: ${fileName}, ${rowCount} rows, ${columnCount} columns
Pass rate: ${passRate}%

Issue clusters:
${clusters.map(c => `- [${c.severity.toUpperCase()}] ${c.label} (${c.count} instances)`).join('\n')}

Respond in JSON: { "summary": "...", "topBlockers": ["...", "...", "..."], "recommendation": "accept"|"reject", "confidence": 85, "reasoning": "..." }`
  }]
})
```

### Pattern 3: Unified Interface for Both Flows
**What:** The clustering function works on both `ValidationIssue` (server-side, from Supabase) and pipeline `ValidationIssue` (client-side)
**When to use:** Map pipeline client-side issues to the same cluster input format
**Example:**
```typescript
// Adapter for pipeline client-side issues
function adaptPipelineIssues(issues: PipelineValidationIssue[]): ClusterInput[] {
  return issues.map((issue, idx) => ({
    rule_type: issue.type,        // "missing" -> "missing_data" etc
    severity: issue.severity,
    row_number: issue.row ?? 0,
    column_name: issue.column ?? '',
    message: issue.message,
    kp_value: null,               // pipeline issues may lack KP
    id: `pipeline-${idx}`,
  }))
}
```

### Anti-Patterns to Avoid
- **Sending raw issues to AI:** Wasteful and slow. Cluster first, send summary. A dataset with 200 KP gaps should send "200 KP gaps between KP 50-120" not 200 individual issues.
- **Calling AI for clustering:** Deterministic grouping is cheaper, faster, and more reliable. AI is only for narrative generation.
- **Blocking UI on AI response:** Show clusters immediately (deterministic), load AI summary asynchronously.
- **Storing AI summaries in DB:** For MVP, generate on-demand. Caching can come later if needed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| LLM API calls | Raw fetch to Anthropic | `@anthropic-ai/sdk` | Already installed, handles retries, types, auth |
| Issue severity scoring | Custom ML model | Weighted formula (critical=10, warning=3, info=1) | Deterministic, testable, no training data needed |
| KP proximity clustering | Complex spatial algorithms | Simple sorted-diff threshold (issues within N * median_spacing) | Survey data is 1D (along pipeline), simple math suffices |

**Key insight:** 90% of this phase is deterministic TypeScript logic. AI is used for exactly one thing: turning structured data into a natural-language narrative with a recommendation.

## Common Pitfalls

### Pitfall 1: Over-relying on AI for Deterministic Logic
**What goes wrong:** Sending raw issue arrays to Claude for clustering/prioritisation
**Why it happens:** Temptation to "let AI do everything"
**How to avoid:** Cluster and prioritise deterministically, only use AI for the narrative layer
**Warning signs:** AI response times > 5 seconds, inconsistent clustering between calls

### Pitfall 2: Pipeline vs Project Issue Schema Mismatch
**What goes wrong:** Pipeline `ValidationIssue` (from `client-validate.ts`) has different fields than Supabase `ValidationIssue`
**Why it happens:** Two separate validation flows with different type definitions
**How to avoid:** Create a common `ClusterInput` interface that both types map to via adapters
**Warning signs:** TypeScript errors when trying to use the same clustering function for both flows

### Pitfall 3: AI JSON Parsing Failures
**What goes wrong:** Claude returns malformed JSON or extra text around JSON
**Why it happens:** LLMs don't always follow format instructions perfectly
**How to avoid:** Use the exact same JSON extraction pattern as `ai-clean` route (regex match for ```json blocks, fallback to raw text, graceful degradation)
**Warning signs:** Empty summaries, "AI analysis unavailable" errors in production

### Pitfall 4: Excessive AI Costs from Large Issue Sets
**What goes wrong:** Sending 500+ issues to Claude in a single prompt
**Why it happens:** Not capping the data sent to the LLM
**How to avoid:** Send only cluster summaries (typically 5-15 clusters), not individual issues. Cap at 30 clusters max.
**Warning signs:** Token usage spikes, slow response times

### Pitfall 5: Blocking Results Display on AI
**What goes wrong:** User waits 3-5 seconds for AI before seeing any results
**Why it happens:** Making AI summary a prerequisite for rendering
**How to avoid:** Show deterministic clusters immediately. Load AI summary with a skeleton/spinner, render when ready.
**Warning signs:** "Loading..." for several seconds on results page

## Code Examples

### Clustering Function
```typescript
// src/lib/ai/cluster-issues.ts
interface ClusterInput {
  id: string
  rule_type: string
  severity: 'critical' | 'warning' | 'info'
  row_number: number
  column_name: string
  message: string
  kp_value: number | null
}

interface IssueCluster {
  id: string
  rule_type: string
  column_name: string
  severity: 'critical' | 'warning' | 'info'
  count: number
  label: string
  kp_range: { min: number; max: number } | null
  row_range: { min: number; max: number }
  issues: ClusterInput[]
}

const SEVERITY_WEIGHT = { critical: 10, warning: 3, info: 1 }

export function clusterIssues(issues: ClusterInput[]): IssueCluster[] {
  // Group by rule_type + column_name
  const groups = new Map<string, ClusterInput[]>()
  for (const issue of issues) {
    const key = `${issue.rule_type}::${issue.column_name}`
    const group = groups.get(key) ?? []
    group.push(issue)
    groups.set(key, group)
  }

  const clusters: IssueCluster[] = []
  for (const [key, group] of groups) {
    const [ruleType, columnName] = key.split('::')
    const kpValues = group.map(i => i.kp_value).filter((v): v is number => v != null)
    const rows = group.map(i => i.row_number).sort((a, b) => a - b)
    const maxSeverity = group.reduce((max, i) =>
      SEVERITY_WEIGHT[i.severity] > SEVERITY_WEIGHT[max] ? i.severity : max,
      group[0].severity
    )

    clusters.push({
      id: `cluster-${ruleType}-${columnName}`,
      rule_type: ruleType,
      column_name: columnName,
      severity: maxSeverity,
      count: group.length,
      label: generateClusterLabel(ruleType, columnName, group.length, kpValues),
      kp_range: kpValues.length > 0 ? { min: Math.min(...kpValues), max: Math.max(...kpValues) } : null,
      row_range: { min: rows[0], max: rows[rows.length - 1] },
      issues: group,
    })
  }

  // Sort by priority: severity weight * count
  return clusters.sort((a, b) =>
    (SEVERITY_WEIGHT[b.severity] * b.count) - (SEVERITY_WEIGHT[a.severity] * a.count)
  )
}

function generateClusterLabel(
  ruleType: string,
  columnName: string,
  count: number,
  kpValues: number[]
): string {
  const ruleLabel = RULE_LABELS[ruleType] ?? ruleType
  const kpRange = kpValues.length >= 2
    ? ` between KP ${Math.min(...kpValues).toFixed(1)}-${Math.max(...kpValues).toFixed(1)}`
    : ''
  return `${count} ${ruleLabel}${count > 1 ? 's' : ''} in "${columnName}"${kpRange}`
}
```

### AI Summary API Route
```typescript
// src/app/api/ai-summary/route.ts -- follows ai-clean pattern
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import Anthropic from "@anthropic-ai/sdk"

interface AISummaryResponse {
  summary: string
  topBlockers: string[]
  recommendation: 'accept' | 'reject'
  confidence: number
  reasoning: string
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 503 })

  const body = await request.json()
  // body: { clusters, passRate, totalIssues, rowCount, columnCount, fileName }

  const anthropic = new Anthropic({ apiKey })
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1500,
    messages: [{ role: "user", content: buildPrompt(body) }],
  })

  // Extract JSON (same pattern as ai-clean)
  const text = message.content[0].type === "text" ? message.content[0].text : ""
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/)
  const parsed = JSON.parse((jsonMatch?.[1] ?? text).trim())

  return NextResponse.json(parsed)
}
```

### Top Blockers UI Component
```typescript
// src/components/files/ai-summary-panel.tsx
// Renders: top 3 blockers, narrative summary, accept/reject badge
// Loads asynchronously after clusters are computed
// Skeleton state while AI processes
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| List every issue individually | Cluster similar issues with expandable groups | Current phase | Reduces cognitive load from 200+ items to ~10 clusters |
| Pass/Fail only | Accept/Reject with confidence % | Current phase | Actionable recommendation vs binary status |
| Issue table only | Top Blockers + narrative summary | Current phase | Engineers see what matters first |

**Note:** The existing issues-table.tsx already groups by rule_type. This phase extends that with KP-aware sub-clustering and adds the AI narrative layer.

## Open Questions

1. **Caching AI summaries**
   - What we know: AI calls cost money and take 2-5 seconds
   - What's unclear: Whether to cache summaries in Supabase or regenerate each time
   - Recommendation: Generate on-demand for MVP. Cache later if usage warrants it. The deterministic clusters display instantly regardless.

2. **Pipeline flow integration depth**
   - What we know: Pipeline issues use a different type (`client-validate.ts` `ValidationIssue`) than Supabase issues
   - What's unclear: Whether pipeline AI summary should call the API route (requires auth) or run entirely client-side
   - Recommendation: Use the API route for both flows. Pipeline users are authenticated. Pass adapted issue data to the same endpoint.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (frontend), pytest (backend) |
| Config file | vitest.config.ts (if exists), backend/pytest.ini |
| Quick run command | `npx vitest run src/lib/ai/cluster-issues.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AIFR-03 | Issues are clustered by rule_type + column_name | unit | `npx vitest run src/lib/ai/cluster-issues.test.ts` | No - Wave 0 |
| AIFR-03 | Top 3 blockers are the highest-priority clusters | unit | `npx vitest run src/lib/ai/cluster-issues.test.ts` | No - Wave 0 |
| AIFR-03 | Cluster labels include KP range when KP values present | unit | `npx vitest run src/lib/ai/cluster-issues.test.ts` | No - Wave 0 |
| AIFR-01 | AI summary API returns narrative + recommendation | integration | `npx vitest run src/app/api/ai-summary/route.test.ts` | No - Wave 0 |
| AIFR-04 | Recommendation includes confidence 0-100 | integration | `npx vitest run src/app/api/ai-summary/route.test.ts` | No - Wave 0 |
| AIFR-03 | Pipeline issues adapt to cluster input format | unit | `npx vitest run src/lib/ai/cluster-issues.test.ts` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/lib/ai/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/ai/cluster-issues.test.ts` -- covers AIFR-03 clustering logic
- [ ] `src/app/api/ai-summary/route.test.ts` -- covers AIFR-01, AIFR-04 (mock Anthropic SDK)
- [ ] Vitest config verification -- ensure vitest.config.ts exists and resolves `@/` paths

## Sources

### Primary (HIGH confidence)
- Existing codebase: `src/app/api/ai-clean/route.ts` -- proven Anthropic SDK pattern
- Existing codebase: `src/lib/types/validation.ts` -- ValidationIssue schema
- Existing codebase: `src/components/files/issues-table.tsx` -- current grouping UI
- Existing codebase: `src/app/(dashboard)/pipeline/lib/client-validate.ts` -- pipeline issue type
- Existing codebase: `src/components/files/results-dashboard.tsx` -- results UI structure

### Secondary (MEDIUM confidence)
- Anthropic SDK docs -- message creation, JSON extraction patterns
- Project patterns from ai-clean route -- auth, error handling, JSON parsing

### Tertiary (LOW confidence)
- None -- all patterns verified from existing codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all dependencies already installed, pattern proven in ai-clean
- Architecture: HIGH -- deterministic clustering + single AI call is well-understood
- Pitfalls: HIGH -- identified from existing ai-clean implementation experience

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stable -- no fast-moving dependencies)
