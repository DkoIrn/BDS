# Phase 16: Pipeline Workflow - Research

**Researched:** 2026-03-29
**Domain:** Multi-step workflow UI / state machine orchestration
**Confidence:** HIGH

## Summary

Phase 16 is a **pure frontend orchestration phase** that wires together existing backend capabilities (upload, parse, validate, transform, convert) into a guided 5-stage pipeline: Import, Inspect, Validate, Clean, Export. No new backend endpoints are needed. The core challenge is designing a robust client-side state machine that tracks pipeline progress, manages transitions between stages, persists state to sessionStorage, and renders a professional engineering-tool stepper UI.

The project already has strong patterns for this: the converter tool uses a discriminated union state machine (`ConvertState`), the visualizer uses sessionStorage persistence, and all backend APIs (validate, convert, transform) are proven and tested. The pipeline page needs to compose these existing capabilities into a linear flow with smart gating logic.

**Primary recommendation:** Build a single `/pipeline` route with a `usePipeline` custom hook managing a discriminated union state machine, a horizontal stepper component, and stage-specific panels that import existing components/API calls from prior phases.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **5 stages:** Import, Inspect, Validate, Clean, Export (in that order)
- **Dedicated `/pipeline` page** as new top-level dashboard route
- **Full-width layout** with horizontal stepper/progress bar at top
- **Add "Pipeline" to top navbar** as primary navigation item
- **Smart gating:** Import required, Inspect automatic after import, Validate optional (warning if skipped), Clean optional, Export always available once imported
- **Visual stepper:** Shows current stage, completed stages (checkmark), skipped stages (warning icon)
- **Pipeline state persists in session** so users can leave and return
- **Each stage shows summary** of what was done when revisited
- **Import supports** drag-and-drop upload AND selecting existing project datasets
- **Reuses existing features:** validate API, transform tools (Phase 14), format conversion (Phase 12)

### Claude's Discretion
- Stepper component design (horizontal top bar vs sidebar steps)
- Transition animations between stages
- How to handle large datasets in inspect stage (pagination, virtual scroll)
- Error recovery if a stage fails mid-processing

### Deferred Ideas (OUT OF SCOPE)
- Saving pipeline configurations as reusable templates
- Batch processing multiple files through the same pipeline
- Pipeline history / audit log
- AI-assisted auto-clean suggestions
</user_constraints>

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 19 | 19.2.3 | Component framework | Already installed |
| Next.js | 16.1.6 | Routing, app directory | Already installed |
| Tailwind CSS | 4.x | Styling | Already installed |
| shadcn/ui (base-ui) | 4.x | UI components | Already installed |
| lucide-react | 0.577.0 | Icons | Already installed |
| react-dropzone | 15.0.0 | File upload | Already installed |
| sonner | 2.0.7 | Toast notifications | Already installed |

### No New Dependencies Needed
This phase requires zero new npm packages. Everything is built with existing UI primitives and custom components.

## Architecture Patterns

### Recommended Project Structure
```
src/app/(dashboard)/pipeline/
  page.tsx                    # Server component: auth check, render PipelineWorkflow
  pipeline-workflow.tsx       # Client component: main orchestrator
  lib/
    pipeline-state.ts         # State machine types + reducer
    pipeline-store.ts         # sessionStorage persistence (save/load/clear)
  components/
    pipeline-stepper.tsx      # Horizontal step indicator bar
    stage-import.tsx           # Import stage panel
    stage-inspect.tsx          # Inspect stage panel
    stage-validate.tsx         # Validate stage panel
    stage-clean.tsx            # Clean stage panel
    stage-export.tsx           # Export stage panel
```

### Pattern 1: Discriminated Union State Machine
**What:** Pipeline state as a TypeScript discriminated union with useReducer
**When to use:** When workflow has distinct stages with different data requirements per stage
**Why:** Already proven in project (converter uses same pattern). Type-safe, exhaustive switch, impossible states are unrepresentable.

```typescript
// Source: Existing project pattern (converter.tsx)
type PipelineStage = "import" | "inspect" | "validate" | "clean" | "export"

interface StageStatus {
  completed: boolean
  skipped: boolean
  summary: string | null  // "12 columns, 340 rows detected" etc.
}

interface PipelineState {
  currentStage: PipelineStage
  stages: Record<PipelineStage, StageStatus>
  // Data carried forward through stages
  file: File | null
  fileSource: "upload" | "existing" | null
  datasetId: string | null        // For existing datasets
  parsedData: string[][] | null   // Raw rows from parse
  columnTypes: ColumnMapping[] | null
  rowCount: number | null
  validationRunId: string | null
  issueCount: number | null
  cleanedData: Blob | null
  exportFormat: string | null
}

type PipelineAction =
  | { type: "IMPORT_FILE"; file: File }
  | { type: "IMPORT_EXISTING"; datasetId: string }
  | { type: "INSPECT_COMPLETE"; data: string[][]; columns: ColumnMapping[]; rowCount: number }
  | { type: "SKIP_VALIDATE" }
  | { type: "VALIDATE_START" }
  | { type: "VALIDATE_COMPLETE"; runId: string; issueCount: number }
  | { type: "SKIP_CLEAN" }
  | { type: "CLEAN_COMPLETE"; cleanedData: Blob }
  | { type: "SET_EXPORT_FORMAT"; format: string }
  | { type: "GO_TO_STAGE"; stage: PipelineStage }
  | { type: "RESET" }
```

### Pattern 2: sessionStorage Persistence
**What:** Save/load pipeline state to sessionStorage on every state change
**When to use:** User needs to navigate away and return to pipeline
**Why:** Already proven in project (map visualizer session-store.ts). No server storage needed for workflow state.

```typescript
// Source: Existing project pattern (session-store.ts)
const PIPELINE_KEY = "pipeline-workflow-state"

// Serialize only serializable fields (no File/Blob objects)
interface SerializablePipelineState {
  currentStage: PipelineStage
  stages: Record<PipelineStage, StageStatus>
  fileSource: "upload" | "existing" | null
  datasetId: string | null
  rowCount: number | null
  validationRunId: string | null
  issueCount: number | null
}
```

**Important:** File and Blob objects cannot be serialized to sessionStorage. Only persist metadata (stage progress, dataset ID, summaries). If user returns after uploading, they may need to re-upload or re-select the file.

### Pattern 3: Stage Panel Composition
**What:** Each stage is a self-contained panel component that receives pipeline state and dispatches actions
**When to use:** When stages have very different UIs but share a common state
**Why:** Keeps each stage focused and testable. Panels can import existing components directly.

```typescript
interface StagePanelProps {
  state: PipelineState
  dispatch: React.Dispatch<PipelineAction>
}

// Each stage panel follows this interface
function StageImport({ state, dispatch }: StagePanelProps) { ... }
function StageInspect({ state, dispatch }: StagePanelProps) { ... }
```

### Pattern 4: Horizontal Stepper Component
**What:** Custom stepper showing 5 stages with status icons and connecting lines
**Why horizontal top bar (recommended):** Matches the "professional engineering tool" aesthetic (like FME Workbench). Horizontal steppers convey linear progression naturally. Full-width layout means horizontal space is available.

```typescript
// Stepper visual states per step
type StepVisual = "pending" | "current" | "completed" | "skipped" | "error"

interface StepperProps {
  stages: { id: PipelineStage; label: string; icon: LucideIcon; status: StepVisual }[]
  onStageClick: (stage: PipelineStage) => void
}
```

### Anti-Patterns to Avoid
- **Storing File/Blob in state management libraries or sessionStorage:** These are not serializable. Keep File references in component-local state or refs only.
- **Direct API calls in reducer:** Keep reducer pure. Side effects (API calls) happen in stage panels or via useEffect.
- **Building new backend endpoints:** The pipeline orchestrates existing APIs. Do not create a `/api/pipeline` endpoint -- all processing uses existing routes.
- **Deeply nested state:** Keep pipeline state flat. Each stage adds data to the same top-level object, not nested stage objects.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File upload UI | New dropzone | Inline react-dropzone (same as converter/visualizer) | Proven pattern, consistent UX |
| Data preview table | New table component | Adapt data-preview-table.tsx or OutputPreviewTable | Already handles column types, pagination |
| Validation execution | New validation flow | Call existing `/api/validate` endpoint | Full validation pipeline already built |
| Export/download | New download logic | Reuse ExportButtons pattern / converter download | Blob URL + hidden anchor pattern proven |
| Toast notifications | Custom notification system | sonner toast() | Already used throughout app |
| Step indicator icons | Custom SVG icons | lucide-react icons (Check, AlertTriangle, Circle, etc.) | Consistent with project |

**Key insight:** This entire phase is integration work. Every processing capability already exists. The value is in the guided UX, not new features.

## Common Pitfalls

### Pitfall 1: File Objects Disappearing on Re-render
**What goes wrong:** File references stored in state become null after component unmount/remount
**Why it happens:** File objects are browser API objects, not serializable state. If parent unmounts, refs are lost.
**How to avoid:** For uploaded files, immediately parse or send to server. Store the resulting data (parsed rows, dataset ID), not the File object itself. For "select existing dataset" flow, use the dataset ID.
**Warning signs:** "File is null" errors when user navigates to next stage

### Pitfall 2: Stage Gating Logic Sprawl
**What goes wrong:** Complex if/else chains scattered across components for "can user go to this stage?"
**Why it happens:** Gating rules are defined informally and implemented ad-hoc
**How to avoid:** Centralize gating in a single `canNavigateTo(state, targetStage): boolean` function. All stage transitions go through this function.
**Warning signs:** Duplicate gating checks in stepper clicks, "Continue" buttons, and keyboard handlers

### Pitfall 3: Stale sessionStorage State
**What goes wrong:** User returns to pipeline, state shows "validated" but the underlying dataset was modified elsewhere
**Why it happens:** sessionStorage snapshot doesn't stay in sync with server state
**How to avoid:** On pipeline load, validate that datasetId still exists and check its current server status. If mismatched, show "Pipeline state expired" and offer to restart.
**Warning signs:** User sees "validated" checkmark but tries to export and gets errors

### Pitfall 4: Overcomplicating the Clean Stage
**What goes wrong:** Trying to embed the full transform tool suite inline leads to massive component complexity
**Why it happens:** Transform tools (CRS, merge, split) each have their own multi-step flows
**How to avoid:** Clean stage should offer a curated set of quick fixes (remove flagged rows, fill nulls) inline, plus a "Open in Transform Tools" link for complex operations. Keep it simple.
**Warning signs:** Clean stage component exceeding 500 lines

### Pitfall 5: Not Handling the "No Issues Found" Path
**What goes wrong:** Validate stage shows empty state with no clear action
**Why it happens:** Only designed for the "issues found" happy path
**How to avoid:** Design a clear "All checks passed" celebration state with obvious "Continue to Export" action.
**Warning signs:** User stuck on validate page with no visible next step

## Code Examples

### Pipeline State Reducer
```typescript
// Source: Project convention (useReducer with discriminated unions)
function pipelineReducer(state: PipelineState, action: PipelineAction): PipelineState {
  switch (action.type) {
    case "IMPORT_FILE":
      return {
        ...initialState,
        currentStage: "inspect",
        file: action.file,
        fileSource: "upload",
        stages: {
          ...initialState.stages,
          import: { completed: true, skipped: false, summary: action.file.name },
        },
      }
    case "SKIP_VALIDATE":
      return {
        ...state,
        currentStage: "clean",
        stages: {
          ...state.stages,
          validate: { completed: false, skipped: true, summary: "Skipped -- dataset not validated" },
        },
      }
    case "GO_TO_STAGE": {
      if (!canNavigateTo(state, action.stage)) return state
      return { ...state, currentStage: action.stage }
    }
    // ... other cases
  }
}
```

### Stepper Component Structure
```typescript
// Source: Project UI conventions (lucide icons, Tailwind, base-ui patterns)
const STAGE_CONFIG = [
  { id: "import" as const, label: "Import", icon: Upload },
  { id: "inspect" as const, label: "Inspect", icon: Eye },
  { id: "validate" as const, label: "Validate", icon: ShieldCheck },
  { id: "clean" as const, label: "Clean", icon: Sparkles },
  { id: "export" as const, label: "Export", icon: Download },
]

function PipelineStepper({ stages, currentStage, onStageClick }: StepperProps) {
  return (
    <div className="flex items-center justify-between px-8 py-4 border-b bg-card">
      {STAGE_CONFIG.map((stage, idx) => {
        const status = getStepVisual(stage.id, stages, currentStage)
        return (
          <Fragment key={stage.id}>
            {idx > 0 && <div className={`h-px flex-1 mx-3 ${getLineColor(status)}`} />}
            <button
              onClick={() => onStageClick(stage.id)}
              className={`flex flex-col items-center gap-1.5 ${getStepStyles(status)}`}
            >
              <div className={`flex size-10 items-center justify-center rounded-full border-2 ${getCircleStyles(status)}`}>
                {status === "completed" ? <Check className="size-4" /> :
                 status === "skipped" ? <AlertTriangle className="size-4" /> :
                 <stage.icon className="size-4" />}
              </div>
              <span className="text-xs font-medium">{stage.label}</span>
            </button>
          </Fragment>
        )
      })}
    </div>
  )
}
```

### Adding Pipeline to Navigation
```typescript
// In top-navbar.tsx, add to mainNav array:
const mainNav = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Projects", href: "/projects", icon: FolderOpen },
  { title: "Pipeline", href: "/pipeline", icon: Workflow },  // NEW
  { title: "Reports", href: "/reports", icon: BarChart3 },
]
```

### Import Stage - Dual Source Pattern
```typescript
// Import stage offers two tabs: "Upload New" and "Select Existing"
function StageImport({ state, dispatch }: StagePanelProps) {
  const [mode, setMode] = useState<"upload" | "existing">("upload")

  return (
    <div className="space-y-6">
      {/* Tab toggle */}
      <div className="flex gap-2">
        <Button variant={mode === "upload" ? "default" : "outline"} onClick={() => setMode("upload")}>
          Upload New File
        </Button>
        <Button variant={mode === "existing" ? "default" : "outline"} onClick={() => setMode("existing")}>
          Select Existing Dataset
        </Button>
      </div>

      {mode === "upload" ? (
        <UploadDropzone onFile={(file) => dispatch({ type: "IMPORT_FILE", file })} />
      ) : (
        <DatasetSelector onSelect={(id) => dispatch({ type: "IMPORT_EXISTING", datasetId: id })} />
      )}
    </div>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Multi-page wizard (separate routes per step) | Single-page with client-side state machine | React 18+ | Faster transitions, no page loads between steps |
| Redux for workflow state | useReducer + context (local) | React 19 | Simpler, no extra dependency, sufficient for single-page flow |
| localStorage for persistence | sessionStorage | N/A | Session-scoped (clears on tab close) is appropriate for in-progress workflows |
| npm stepper libraries | Custom stepper with Tailwind | N/A | Avoids dependency; 5 steps is simple enough to not need a library |

**Deprecated/outdated:**
- react-step-wizard, react-stepper-horizontal: Unmaintained packages. Custom is better for 5 fixed steps.
- formik/react-hook-form for wizard: Overkill when stages aren't forms -- this is a processing pipeline, not a form wizard.

## Open Questions

1. **Existing dataset selection UI**
   - What we know: User wants to select from their project datasets
   - What's unclear: Should this show all user datasets flat, or grouped by project/job? How much metadata to show?
   - Recommendation: Flat list of recent datasets with project name as subtitle. Keep it simple. A search/filter input for users with many datasets.

2. **Clean stage scope**
   - What we know: Should reuse transform tools from Phase 14
   - What's unclear: Which transforms make sense inline vs. linking out? CRS conversion requires multiple inputs (source/target CRS).
   - Recommendation: Offer "Remove flagged rows" and "Fill missing values" inline. For CRS/merge/split, show "Open in Transform Tools" links that open in new tab. Don't try to embed the full transform tool flows.

3. **Inspect stage auto-trigger**
   - What we know: Inspect runs automatically after import
   - What's unclear: For uploaded files, this means parsing client-side (PapaParse/SheetJS). For existing datasets, this means fetching already-parsed data from the server.
   - Recommendation: Two code paths in inspect stage -- if `fileSource === "upload"`, parse locally and show preview. If `fileSource === "existing"`, fetch dataset rows from Supabase and show preview.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x with jsdom |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements - Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PIPE-01 | Pipeline reducer handles all action types correctly | unit | `npx vitest run tests/pipeline/pipeline-state.test.ts -x` | No - Wave 0 |
| PIPE-02 | Stage gating logic (canNavigateTo) enforces rules | unit | `npx vitest run tests/pipeline/pipeline-state.test.ts -x` | No - Wave 0 |
| PIPE-03 | sessionStorage save/load round-trips correctly | unit | `npx vitest run tests/pipeline/pipeline-store.test.ts -x` | No - Wave 0 |
| PIPE-04 | Stepper renders correct visual states | unit | `npx vitest run tests/pipeline/pipeline-stepper.test.ts -x` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/pipeline/ --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/pipeline/pipeline-state.test.ts` -- covers reducer + gating logic
- [ ] `tests/pipeline/pipeline-store.test.ts` -- covers sessionStorage persistence
- [ ] `tests/pipeline/pipeline-stepper.test.ts` -- covers stepper rendering

## Sources

### Primary (HIGH confidence)
- Project codebase inspection -- converter.tsx state machine pattern, session-store.ts persistence pattern, top-navbar.tsx navigation structure, validate route.ts API pattern, existing component library
- React 19 documentation -- useReducer, discriminated unions, component composition

### Secondary (MEDIUM confidence)
- Project CONTEXT.md -- user decisions and constraints for this phase
- Project STATE.md -- accumulated architectural decisions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, all existing libraries
- Architecture: HIGH - follows proven patterns already in codebase (converter state machine, session store)
- Pitfalls: HIGH - identified from similar wizard/stepper implementations and project-specific patterns
- Integration points: HIGH - all APIs and components already exist and are documented in STATE.md decisions

**Research date:** 2026-03-29
**Valid until:** 2026-04-28 (stable -- no external dependencies changing)
