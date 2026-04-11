# Phase 28: Guided Onboarding Flow - Research

**Researched:** 2026-04-10
**Domain:** Frontend onboarding UX, guided tours, demo data pipeline
**Confidence:** HIGH

## Summary

Phase 28 adds a guided first-run experience for new TruQC users. The project already has a `TutorialOverlay` component (`src/components/tutorial-overlay.tsx`) that handles navbar-level spotlight tours with localStorage + Supabase user_metadata tracking. This phase extends that foundation significantly: instead of just highlighting nav items, users walk through the actual 6-stage pipeline (Import, Inspect, Validate, Review, Resolve, Export) with a preloaded demo dataset and contextual tooltips at each stage.

The pipeline workflow is managed by `useReducer` with `pipelineReducer` in `src/app/(dashboard)/pipeline/lib/pipeline-state.ts`. The state machine supports 6 stages with actions like `IMPORT_FILE`, `INSPECT_COMPLETE`, `VALIDATE_COMPLETE`, etc. The guided tour will programmatically drive this state machine, auto-advancing through stages while showing explanatory tooltips. The existing `pipeline-dirty-fail.csv` test data demonstrates the exact kind of issues (missing values, outliers, duplicates, monotonicity violations) that make a compelling demo.

**Primary recommendation:** Build a `GuidedOnboarding` wrapper component that orchestrates the pipeline workflow in "demo mode" -- preloading a bundled demo CSV, auto-dispatching pipeline actions, and rendering contextual tooltip overlays at each stage. Track completion via a `profiles.onboarding_completed` column (not just user_metadata) for reliable server-side querying.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ONBD-01 | Guided first-run tour with preloaded demo dataset | Demo CSV bundled in public/, pipeline driven programmatically in demo mode, welcome screen at splash/dashboard entry |
| ONBD-02 | Contextual tooltips explaining each pipeline stage | Spotlight overlay pattern from existing TutorialOverlay, extended with stage-specific `data-onboarding` selectors |
| ONBD-03 | Tour completion tracking (show once per user) | `profiles.onboarding_completed` boolean column + localStorage fast-check (same dual-layer pattern as existing tutorial) |
| ONBD-04 | Tour replay from settings or help menu | Settings page section + help button in top navbar, clears onboarding flag and redirects to pipeline in demo mode |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 19 | 19.2.3 | UI framework | Already in project |
| Next.js | 16.1.6 | App router, server components | Already in project |
| Supabase JS | 2.99.0 | Auth + DB for tracking | Already in project |
| Tailwind CSS | 4.x | Styling overlays/tooltips | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | 0.577.0 | Icons for tooltips | Already in project |
| sonner | 2.0.7 | Toast notifications | Already in project |
| shadcn/ui | 4.x | Button, Card, Dialog components | Already in project |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom overlay | react-joyride | Adds ~25KB dependency for a feature that existing TutorialOverlay pattern handles; not worth it |
| Custom overlay | shepherd.js | Same: external dependency for something the project already implements |
| user_metadata tracking | profiles column | Profiles column is more queryable and server-side verifiable; use BOTH like existing pattern |

**Installation:**
```bash
# No new dependencies needed -- all existing
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  app/(dashboard)/pipeline/
    components/
      guided-onboarding.tsx       # Main onboarding orchestrator
      onboarding-tooltip.tsx      # Spotlight + tooltip overlay (extends TutorialOverlay pattern)
      onboarding-welcome.tsx      # Welcome screen (start/skip)
      onboarding-celebration.tsx  # Completion screen with stats
    lib/
      demo-data.ts                # Bundled demo dataset + expected results
      onboarding-steps.ts         # Step definitions per pipeline stage
  lib/actions/
    onboarding.ts                 # Server actions: check/set completion
  components/
    help-button.tsx               # Help menu with "Replay Tour" option
public/
  demo/
    pipeline-demo.csv             # Preloaded demo dataset (20-25 rows)
```

### Pattern 1: Demo Mode Pipeline Wrapper
**What:** A wrapper around `PipelineWorkflow` that intercepts pipeline state and auto-advances through stages with delays, showing tooltips between transitions.
**When to use:** When the user starts the guided tour.
**Example:**
```typescript
// guided-onboarding.tsx
interface GuidedOnboardingProps {
  user: { id: string; email: string }
  onComplete: () => void
  onSkip: () => void
}

export function GuidedOnboarding({ user, onComplete, onSkip }: GuidedOnboardingProps) {
  const [tourStep, setTourStep] = useState(0)
  // Render PipelineWorkflow with demoMode flag
  // Overlay tooltips based on tourStep
  // Auto-advance pipeline after user clicks "Next" on each tooltip
}
```

### Pattern 2: Dual-Layer Completion Tracking
**What:** localStorage for instant checks (no network) + Supabase profiles column for authoritative server-side state.
**When to use:** Same pattern as existing `TutorialOverlay` (localStorage + user_metadata), but using a proper profiles column instead.
**Example:**
```typescript
const ONBOARDING_KEY = "truqc-onboarding-completed"

// Fast check
if (localStorage.getItem(ONBOARDING_KEY)) return // Already done

// Authoritative check
const { data } = await supabase
  .from("profiles")
  .select("onboarding_completed")
  .eq("id", userId)
  .single()

if (data?.onboarding_completed) {
  localStorage.setItem(ONBOARDING_KEY, "true")
  return
}
```

### Pattern 3: Programmatic Pipeline Driving
**What:** Instead of building a separate "fake" pipeline, drive the real `pipelineReducer` with demo data. The demo mode flag controls whether actual API calls are made or simulated results are used.
**When to use:** During the guided tour.
**Example:**
```typescript
// Auto-advance after tooltip dismissal
function advanceToNextStep() {
  switch (currentOnboardingStage) {
    case "import":
      dispatch({ type: "IMPORT_FILE", fileName: "demo-pipeline-survey.csv" })
      break
    case "inspect":
      dispatch({
        type: "INSPECT_COMPLETE",
        parsedData: DEMO_PARSED_DATA,
        columnCount: 8,
        rowCount: 22,
      })
      break
    // ... etc
  }
}
```

### Pattern 4: Welcome Screen Entry Point
**What:** After first login, redirect from splash to a welcome screen (or overlay on dashboard) offering "Start Guided Tour" or "Skip and Explore".
**When to use:** First-time users only (onboarding_completed === false).
**Example:**
```typescript
// In splash page or dashboard, check onboarding status
// If not completed, show welcome overlay before proceeding
```

### Anti-Patterns to Avoid
- **Don't build a separate fake pipeline UI:** Reuse the real `PipelineWorkflow` component with a `demoMode` prop. This ensures the tour always matches the actual product.
- **Don't make API calls during demo:** Pre-compute validation results and bundle them. Real API calls would be slow and could fail.
- **Don't block the entire page with a modal for every step:** Use spotlight overlays like the existing `TutorialOverlay` -- they show the real UI underneath.
- **Don't store completion only in localStorage:** It gets cleared. Always persist to the database.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Spotlight overlay | New overlay system | Extend existing `TutorialOverlay` clip-path pattern | Already battle-tested, handles resize/scroll |
| Demo validation results | Fake validation API | Pre-computed JSON constant | Faster, no network dependency, deterministic |
| Tour state machine | Custom state tracker | Simple `useState<number>` for step index | Tour is linear, no complex branching needed |
| Completion persistence | Custom API route | Server action + profiles column | Consistent with project patterns |

**Key insight:** The existing `TutorialOverlay` already solves the hardest part (spotlight cutout with clip-path, positioning, progress dots). Extend that pattern rather than starting from scratch.

## Common Pitfalls

### Pitfall 1: Tour Breaks When UI Changes
**What goes wrong:** Hardcoded CSS selectors (`.class-name`) break when components are refactored.
**Why it happens:** Tight coupling between tour steps and implementation details.
**How to avoid:** Use `data-onboarding="stage-name"` attributes on target elements. These are stable, intentional anchors.
**Warning signs:** Tour tooltips appear in wrong positions or don't appear at all.

### Pitfall 2: Demo Data Doesn't Trigger Enough Issues
**What goes wrong:** The demo feels flat because the dataset is too clean or too messy.
**Why it happens:** Not designing the demo data to showcase specific features.
**How to avoid:** Craft the demo CSV to include exactly: 2-3 missing values, 1 outlier spike, 1 duplicate row, 1 monotonicity violation, 1 range violation. This gives a compelling "TruQC found 7 issues" result.
**Warning signs:** Celebration screen shows 0 issues or 50+ issues.

### Pitfall 3: Tour Takes Too Long
**What goes wrong:** Users abandon the tour before seeing value.
**Why it happens:** Too many tooltip steps, too much text, waiting for real processing.
**How to avoid:** Target 6-8 tooltip steps total (one intro per stage), keep text to 1-2 sentences, pre-compute all results so transitions are instant. Under 3 minutes total.
**Warning signs:** User testing shows >50% skip rate.

### Pitfall 4: Splash Page Race Condition
**What goes wrong:** Splash animation completes and redirects to dashboard before onboarding check resolves.
**Why it happens:** The splash page uses fixed timeouts (4.3s total) and the onboarding check is async.
**How to avoid:** Check onboarding status in the dashboard page (server component) or in a client wrapper, not in the splash page. Let splash always redirect to dashboard, then dashboard shows the welcome overlay.
**Warning signs:** New users see dashboard briefly before welcome screen appears.

### Pitfall 5: sessionStorage Pipeline Conflicts
**What goes wrong:** Demo mode pipeline state leaks into real pipeline usage.
**Why it happens:** Both share the same sessionStorage key.
**How to avoid:** Use a separate sessionStorage key for demo mode (e.g., `truqc-pipeline-demo`) or clear pipeline state when exiting demo mode.
**Warning signs:** After completing tour, real pipeline shows demo data.

## Code Examples

### Spotlight Overlay (Existing Pattern)
```typescript
// Source: src/components/tutorial-overlay.tsx (lines 286-318)
// Uses clip-path polygon for spotlight cutout
<div
  className="absolute inset-0 bg-black/60 transition-all duration-300"
  style={{
    clipPath: `polygon(
      0% 0%, 0% 100%, 100% 100%, 100% 0%, 0% 0%,
      ${rect.left - pad}px ${rect.top - pad}px,
      ${rect.left - pad}px ${rect.bottom + pad}px,
      ${rect.right + pad}px ${rect.bottom + pad}px,
      ${rect.right + pad}px ${rect.top - pad}px,
      ${rect.left - pad}px ${rect.top - pad}px
    )`,
  }}
/>
```

### Pipeline State Dispatch (Existing Pattern)
```typescript
// Source: src/app/(dashboard)/pipeline/lib/pipeline-state.ts
// Dispatch actions to advance pipeline programmatically
dispatch({ type: "IMPORT_FILE", fileName: "demo-pipeline-survey.csv" })
dispatch({ type: "INSPECT_COMPLETE", parsedData, columnCount: 8, rowCount: 22 })
dispatch({ type: "VALIDATE_COMPLETE", runId: "demo-run", issueCount: 7 })
```

### Demo Data Structure
```typescript
// Pre-computed demo results bundled as constants
export const DEMO_DATASET = {
  fileName: "North_Sea_Pipeline_Survey.csv",
  parsedData: [ /* 22 rows of pipeline survey data */ ],
  columnCount: 8,
  rowCount: 22,
}

export const DEMO_VALIDATION = {
  runId: "demo-validation-run",
  issueCount: 7,
  issues: [
    { type: "missing_data", severity: "warning", row: 3, column: "DOB", message: "Missing depth of burial value" },
    { type: "outlier", severity: "critical", row: 9, column: "DOB", message: "Value 18.50 exceeds 3x IQR threshold" },
    { type: "duplicate", severity: "warning", row: 15, column: "KP", message: "Duplicate row at KP 0.600" },
    // ... more issues crafted for demo impact
  ],
}
```

### Onboarding Step Definitions
```typescript
export interface OnboardingStep {
  stage: PipelineStage
  selector: string             // data-onboarding target
  title: string
  description: string
  action?: () => void          // Auto-advance callback
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    stage: "import",
    selector: '[data-onboarding="import-zone"]',
    title: "Import Your Data",
    description: "Upload survey CSV or Excel files. We've loaded a demo pipeline survey for you.",
  },
  {
    stage: "inspect",
    selector: '[data-onboarding="data-preview"]',
    title: "Inspect Your Data",
    description: "TruQC auto-detects column types -- KP, coordinates, depth, DOB. Check the preview below.",
  },
  // ... one per stage
]
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| External tour libraries (react-joyride, shepherd) | Built-in spotlight overlay with clip-path | 2024+ | No dependency overhead, full control over UX |
| Tour as separate pages | Tour drives real UI | Current best practice | Users learn the actual product, not a simulation |
| localStorage only tracking | Dual-layer (localStorage + DB) | Current best practice | Survives browser changes, works cross-device |

**Deprecated/outdated:**
- intro.js: Unmaintained, jQuery-era patterns
- Full-page tutorial modals: Poor engagement, users close immediately

## Open Questions

1. **Welcome screen location**
   - What we know: Splash page redirects to /dashboard after animation. Dashboard is a server component.
   - What's unclear: Should the welcome appear as an overlay on /dashboard, or should splash redirect to a /welcome route for first-time users?
   - Recommendation: Overlay on /dashboard. Avoids new route, keeps navigation simple. Check `onboarding_completed` in the dashboard server component and pass a prop.

2. **Demo data: bundled CSV vs hardcoded constant**
   - What we know: Pipeline Import stage expects a File object or existing dataset ID.
   - What's unclear: Whether to put a real CSV in `/public/demo/` and fetch it, or hardcode the parsed data as a TS constant.
   - Recommendation: Hardcode as a TS constant (both raw CSV string and pre-parsed data). Avoids network fetch, instant loading, works offline.

3. **Real vs simulated validation**
   - What we know: Validation normally calls FastAPI backend. Demo mode should not depend on backend availability.
   - What's unclear: Whether to pre-compute results or make a real API call with the demo data.
   - Recommendation: Pre-compute. Bundle the expected validation results as a constant. This guarantees the demo works reliably and loads instantly.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ONBD-01 | Demo data loads and pipeline advances through all stages | unit | `npx vitest run src/app/(dashboard)/pipeline/lib/demo-data.test.ts -x` | No -- Wave 0 |
| ONBD-02 | Onboarding steps map to valid selectors and correct stages | unit | `npx vitest run src/app/(dashboard)/pipeline/lib/onboarding-steps.test.ts -x` | No -- Wave 0 |
| ONBD-03 | Completion tracking writes to localStorage and calls server action | unit | `npx vitest run src/lib/actions/onboarding.test.ts -x` | No -- Wave 0 |
| ONBD-04 | Replay clears completion flag and re-enables tour | unit | `npx vitest run src/lib/actions/onboarding.test.ts -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/app/(dashboard)/pipeline/lib/demo-data.test.ts` -- covers ONBD-01 (demo data structure validation)
- [ ] `src/app/(dashboard)/pipeline/lib/onboarding-steps.test.ts` -- covers ONBD-02 (step definitions match stage order)
- [ ] `src/lib/actions/onboarding.test.ts` -- covers ONBD-03, ONBD-04 (completion tracking)

## Sources

### Primary (HIGH confidence)
- Existing codebase: `src/components/tutorial-overlay.tsx` -- spotlight overlay pattern, completion tracking
- Existing codebase: `src/app/(dashboard)/pipeline/lib/pipeline-state.ts` -- state machine, actions, gating
- Existing codebase: `src/app/(dashboard)/pipeline/pipeline-workflow.tsx` -- workflow component structure
- Existing codebase: `src/app/splash/page.tsx` -- post-login entry point
- Existing codebase: `test-data/pipeline-dirty-fail.csv` -- demo data template

### Secondary (MEDIUM confidence)
- Existing codebase: `src/app/(dashboard)/settings/page.tsx` -- settings page structure for replay button
- Existing codebase: `src/components/top-navbar.tsx` -- data-tutorial attribute pattern

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No new dependencies, all existing project libraries
- Architecture: HIGH -- Extends proven patterns (TutorialOverlay, pipelineReducer, dual-layer tracking)
- Pitfalls: HIGH -- Based on direct codebase analysis (splash timing, sessionStorage keys, selector stability)

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stable -- all patterns are internal to project)
