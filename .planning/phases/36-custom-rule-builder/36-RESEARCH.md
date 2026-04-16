# Phase 36: Custom Rule Builder - Research

**Researched:** 2026-04-15
**Domain:** Visual rule builder UI + backend custom rule execution engine
**Confidence:** HIGH

## Summary

The Custom Rule Builder adds user-defined validation rules with IF/THEN conditional logic to TruQC's existing validation pipeline. The system has a well-established pattern: `ProfileConfig` defines validation parameters, `resolve_config()` flattens them, and `run_validation_pipeline()` executes checks that produce `ValidationIssue` objects. Custom rules must slot into this existing flow seamlessly.

The implementation spans three layers: (1) a Supabase `custom_rules` table storing rule definitions as structured JSON, (2) a Python executor in the backend that interprets rule definitions and produces `ValidationIssue` objects, (3) a React visual builder component with condition groups, operators, and a test/preview mode. The rule schema is a JSON AST with condition groups (AND/OR), max 2 nesting levels, and three rule types (threshold, column comparison, null check).

**Primary recommendation:** Store rules as structured JSON in a new `custom_rules` table linked to `validation_profiles`. Execute rules in Python using pandas vectorized operations, producing standard `ValidationIssue` objects. Build the frontend as a standalone `RuleBuilder` component that can be embedded in the validate stage.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RULE-01 | User can create custom validation rules with IF/THEN conditions via a visual builder | Frontend `RuleBuilder` component with condition row UI, operator selects, value inputs |
| RULE-02 | Rule builder supports three rule types: threshold check, column comparison, and null check | JSON rule schema with `rule_type` discriminator; each type has specific operator sets |
| RULE-03 | Rules support AND/OR grouping (max 2 levels of nesting) | Condition group model with `logic` field (AND/OR) and nested `groups` array (depth <= 2) |
| RULE-04 | User can test a rule against the current dataset and preview matching rows before saving | Backend `/api/v1/rules/test` endpoint that executes rule against dataset, returns matching row indices |
| RULE-05 | Custom rules are saved to validation profiles and run alongside built-in validators | `custom_rules` table with `profile_id` FK; `run_validation_pipeline` extended to execute custom rules after built-in checks |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React (existing) | 19 | Rule builder UI components | Already in stack |
| shadcn/ui (existing) | latest | Select, Input, Button, Card components | Already in stack, consistent design |
| Pydantic (existing) | v2 | Rule definition schema validation | Already used for ProfileConfig |
| pandas (existing) | 2.x | Rule execution via vectorized operations | Already in validation pipeline |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react (existing) | latest | Icons for rule builder UI (Plus, Trash, Play, etc.) | All rule builder UI |
| sonner (existing) | latest | Toast notifications for save/test results | User feedback |
| uuid (existing) | - | Client-side temp IDs for condition rows before save | Rule builder state |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom JSON AST | react-querybuilder library | Adds dependency for a simple 3-type rule system; custom is cleaner for this scope |
| Python eval for rules | pandas query strings | eval/query is a security risk; explicit operator mapping is safer |

**Installation:**
No new packages needed. All required libraries already in stack.

## Architecture Patterns

### Recommended Project Structure
```
backend/
  app/
    models/schemas.py          # Add CustomRuleDefinition, ConditionGroup models
    services/custom_rules.py   # Rule executor (JSON -> pandas operations -> ValidationIssue[])
    routers/custom_rules.py    # CRUD + test endpoint
src/
  app/(dashboard)/pipeline/
    components/rule-builder/
      rule-builder.tsx          # Main builder component
      condition-row.tsx         # Single condition (column + operator + value)
      condition-group.tsx       # AND/OR group wrapper
      rule-test-preview.tsx     # Test results table
    lib/rule-types.ts           # TypeScript types matching backend schema
  lib/
    actions/custom-rules.ts     # Server actions for CRUD
    types/custom-rules.ts       # Shared type definitions
supabase/
  migrations/
    00014_custom_rules.sql      # New table + RLS policies
```

### Pattern 1: Rule Definition JSON Schema
**What:** Structured JSON AST for rule definitions, validated by Pydantic on backend and TypeScript types on frontend
**When to use:** Every rule CRUD operation and execution
**Example:**
```python
# Backend Pydantic models
class Condition(BaseModel):
    column: str                    # Column name from dataset
    rule_type: Literal["threshold", "comparison", "null_check"]
    operator: str                  # ">", "<", ">=", "<=", "==", "!=", "is_null", "is_not_null"
    value: float | str | None = None       # For threshold: numeric value; for comparison: column name
    compare_column: str | None = None      # For column comparison type

class ConditionGroup(BaseModel):
    logic: Literal["AND", "OR"] = "AND"
    conditions: list[Condition] = []
    groups: list["ConditionGroup"] = []    # Nested groups (max depth 2)

class CustomRuleDefinition(BaseModel):
    name: str
    description: str = ""
    severity: Literal["critical", "warning", "info"] = "warning"
    root_group: ConditionGroup
    
    @model_validator(mode="after")
    def validate_nesting_depth(self):
        """Ensure max 2 levels of nesting."""
        def check_depth(group: ConditionGroup, depth: int = 0):
            if depth > 2:
                raise ValueError("Maximum nesting depth is 2 levels")
            for g in group.groups:
                check_depth(g, depth + 1)
        check_depth(self.root_group)
        return self
```

```typescript
// Frontend TypeScript types
interface Condition {
  id: string  // client-side temp ID
  column: string
  ruleType: "threshold" | "comparison" | "null_check"
  operator: string
  value?: number | string
  compareColumn?: string
}

interface ConditionGroup {
  id: string
  logic: "AND" | "OR"
  conditions: Condition[]
  groups: ConditionGroup[]
}

interface CustomRuleDefinition {
  name: string
  description: string
  severity: "critical" | "warning" | "info"
  rootGroup: ConditionGroup
}
```

### Pattern 2: Rule Execution via Pandas Masks
**What:** Convert each condition to a pandas boolean Series, combine with AND/OR, flag matching rows
**When to use:** Backend rule execution in validation pipeline and test endpoint
**Example:**
```python
def execute_custom_rule(
    df: pd.DataFrame,
    rule: CustomRuleDefinition,
    kp_column: str | None = None,
) -> list[ValidationIssue]:
    """Execute a single custom rule against a DataFrame."""
    mask = evaluate_group(df, rule.root_group)
    issues = []
    for idx in df.index[mask]:
        row_num = int(idx) + 1
        kp = float(df[kp_column].iloc[idx]) if kp_column and kp_column in df.columns else None
        issues.append(ValidationIssue(
            row_number=row_num,
            column_name=rule.root_group.conditions[0].column if rule.root_group.conditions else "custom",
            rule_type="custom_rule",
            severity=Severity(rule.severity),
            message=f"Custom rule '{rule.name}' triggered",
            kp_value=kp,
        ))
    return issues

def evaluate_group(df: pd.DataFrame, group: ConditionGroup) -> pd.Series:
    """Recursively evaluate a condition group to a boolean mask."""
    masks = []
    for cond in group.conditions:
        masks.append(evaluate_condition(df, cond))
    for sub_group in group.groups:
        masks.append(evaluate_group(df, sub_group))
    
    if not masks:
        return pd.Series(False, index=df.index)
    
    if group.logic == "AND":
        result = masks[0]
        for m in masks[1:]:
            result = result & m
    else:  # OR
        result = masks[0]
        for m in masks[1:]:
            result = result | m
    return result

def evaluate_condition(df: pd.DataFrame, cond: Condition) -> pd.Series:
    """Evaluate a single condition to a boolean mask."""
    if cond.column not in df.columns:
        return pd.Series(False, index=df.index)
    
    series = df[cond.column]
    
    if cond.rule_type == "null_check":
        if cond.operator == "is_null":
            return series.isna() | (series.astype(str).str.strip() == "")
        return series.notna() & (series.astype(str).str.strip() != "")
    
    if cond.rule_type == "threshold":
        numeric = pd.to_numeric(series, errors="coerce")
        val = float(cond.value)
        ops = {">": numeric > val, "<": numeric < val, ">=": numeric >= val,
               "<=": numeric <= val, "==": numeric == val, "!=": numeric != val}
        return ops.get(cond.operator, pd.Series(False, index=df.index))
    
    if cond.rule_type == "comparison":
        if cond.compare_column not in df.columns:
            return pd.Series(False, index=df.index)
        a = pd.to_numeric(series, errors="coerce")
        b = pd.to_numeric(df[cond.compare_column], errors="coerce")
        ops = {">": a > b, "<": a < b, ">=": a >= b, "<=": a <= b, "==": a == b, "!=": a != b}
        return ops.get(cond.operator, pd.Series(False, index=df.index))
    
    return pd.Series(False, index=df.index)
```

### Pattern 3: Integration with Validation Pipeline
**What:** Load custom rules from profile, execute after built-in checks
**When to use:** Every validation run where profile has custom rules
**Example:**
```python
# In run_validation_pipeline or the background task:
# After all built-in checks:
if custom_rules:
    from app.services.custom_rules import execute_custom_rule
    for rule in custom_rules:
        all_issues.extend(execute_custom_rule(df, rule, kp_column=kp_column))
```

### Pattern 4: Test/Preview Endpoint
**What:** Execute rule against dataset without saving, return matching row indices and sample data
**When to use:** RULE-04 test functionality
**Example:**
```python
@router.post("/rules/test")
async def test_rule(request: TestRuleRequest):
    """Test a rule definition against a dataset, returning matching rows."""
    # Load dataset into DataFrame (same as validation flow)
    # Execute rule
    # Return: { matching_rows: int, total_rows: int, sample_matches: [...] }
```

### Anti-Patterns to Avoid
- **eval() or exec() for rule execution:** Never evaluate user-provided strings as code. Use explicit operator mapping only.
- **Deep nesting without limits:** Requirements explicitly cap at 2 levels. Enforce in both frontend UI (disable "Add Group" at depth 2) and backend validation.
- **Storing rules in ProfileConfig.config JSONB:** Rules are complex enough to warrant their own table with proper foreign keys, not embedded in the profile config blob.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID generation (frontend) | Math.random IDs | `crypto.randomUUID()` | Browser-native, proper uniqueness |
| Form validation | Custom validators | Pydantic (backend) + inline checks (frontend) | Pydantic already validates ProfileConfig; extend pattern |
| Condition operator labels | Hardcoded strings | Const lookup objects with human-readable labels | Reusable, testable, i18n-ready |

**Key insight:** The existing validation pipeline is already well-structured. Custom rules should produce the same `ValidationIssue` objects and integrate at the end of `run_validation_pipeline`, not replace or duplicate any infrastructure.

## Common Pitfalls

### Pitfall 1: Column Name Mismatch Between UI and Backend
**What goes wrong:** User selects column "Depth of Burial" in UI but backend expects "dob" (mapped type)
**Why it happens:** Dataset has original column names and mapped types; rule must reference the right one
**How to avoid:** Rules reference mapped column types (the same ones used in validation pipeline), not original headers. Frontend displays human-readable labels but stores mapped types.
**Warning signs:** Rule silently matches zero rows despite obvious violations

### Pitfall 2: Type Coercion Failures
**What goes wrong:** Threshold comparison fails because column data is strings, not numbers
**Why it happens:** DataFrame loaded with `dtype=str` in the pipeline
**How to avoid:** Always use `pd.to_numeric(series, errors="coerce")` before numeric comparisons. NaN from coercion should NOT trigger threshold rules (only null_check rules).
**Warning signs:** All threshold checks return zero matches

### Pitfall 3: Empty Condition Groups
**What goes wrong:** User creates a group with no conditions, which matches all or no rows unpredictably
**Why it happens:** UI allows adding empty groups
**How to avoid:** Frontend validates that every group has at least one condition before save/test. Backend `evaluate_group` returns `False` mask for empty groups (fail-safe).
**Warning signs:** Rule matches every row or no rows

### Pitfall 4: Rule Test Performance on Large Datasets
**What goes wrong:** Test endpoint takes too long, blocking UI
**Why it happens:** Loading full dataset from storage + parsing for each test
**How to avoid:** Reuse the dataset DataFrame that's already parsed in the pipeline. For standalone test, cap preview to first 10,000 rows with a warning. Return only matching row count + sample (first 50 matches), not all matching data.
**Warning signs:** Spinner hangs for 30+ seconds on test

### Pitfall 5: Orphaned Rules After Profile Deletion
**What goes wrong:** Rules remain in `custom_rules` table after parent profile is deleted
**Why it happens:** Missing cascade delete on FK
**How to avoid:** `REFERENCES validation_profiles(id) ON DELETE CASCADE` in the migration
**Warning signs:** Database grows with unreachable rule records

## Code Examples

### Database Migration
```sql
-- Migration: 00014_custom_rules.sql
CREATE TABLE public.custom_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES validation_profiles(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  org_id UUID REFERENCES organisations(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('critical', 'warning', 'info')),
  rule_definition JSONB NOT NULL,  -- ConditionGroup JSON
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_custom_rules_profile_id ON custom_rules(profile_id);
CREATE INDEX idx_custom_rules_org_id ON custom_rules(org_id);

ALTER TABLE custom_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select org rules"
  ON custom_rules FOR SELECT
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));

CREATE POLICY "Reviewers can insert rules"
  ON custom_rules FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role IN ('admin', 'reviewer')));

CREATE POLICY "Reviewers can update own rules"
  ON custom_rules FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can delete rules"
  ON custom_rules FOR DELETE
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role = 'admin')
    OR user_id = auth.uid());

CREATE TRIGGER set_custom_rules_updated_at
  BEFORE UPDATE ON custom_rules
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();
```

### Frontend Rule Builder Component Structure
```typescript
// Operator options per rule type
const THRESHOLD_OPERATORS = [
  { value: ">", label: "greater than" },
  { value: "<", label: "less than" },
  { value: ">=", label: "greater than or equal" },
  { value: "<=", label: "less than or equal" },
  { value: "==", label: "equals" },
  { value: "!=", label: "not equal to" },
]

const COMPARISON_OPERATORS = [
  { value: ">", label: "greater than" },
  { value: "<", label: "less than" },
  { value: ">=", label: "greater than or equal" },
  { value: "<=", label: "less than or equal" },
  { value: "==", label: "equals" },
  { value: "!=", label: "not equal to" },
]

const NULL_OPERATORS = [
  { value: "is_null", label: "is empty" },
  { value: "is_not_null", label: "is not empty" },
]

// Column options derived from dataset column mappings
const AVAILABLE_COLUMNS = [
  { value: "dob", label: "Depth of Burial" },
  { value: "doc", label: "Depth of Cover" },
  // ... populated from dataset column_mappings
]
```

### Validate Route Integration
```typescript
// In src/app/api/validate/route.ts, add custom_rule_ids to the request body
// that gets forwarded to FastAPI:
body: JSON.stringify({
  dataset_id: datasetId,
  config: config ?? null,
  custom_rule_ids: customRuleIds ?? [],  // NEW
})
```

### Backend Pipeline Integration Point
```python
# In validation.py or the background task, after run_validation_pipeline():
# Load custom rules for the profile
if profile_id:
    rules_result = supabase.table("custom_rules") \
        .select("*").eq("profile_id", profile_id).eq("enabled", True).execute()
    if rules_result.data:
        for rule_row in rules_result.data:
            rule_def = CustomRuleDefinition(**rule_row["rule_definition"], 
                                             name=rule_row["name"],
                                             severity=rule_row["severity"])
            issues.extend(execute_custom_rule(df, rule_def, kp_column=kp_column))
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded validators only | Configurable thresholds via ProfileConfig | Phase 29 (v1.1) | Custom rules extend this pattern |
| Client-side only validation | Backend validation pipeline with job queue | Phase 29 (v1.1) | Custom rules execute server-side |

**Explicitly excluded:**
- Full scripting engine (REQUIREMENTS.md Out of Scope): Visual builder covers 90% of use cases; scripting invites security issues
- AI-generated rule suggestions (v1.2 ADVI-02): Deferred, rule library too small
- Rule nesting beyond 2 levels (REQUIREMENTS.md Out of Scope): Complexity explosion for users and developers

## Open Questions

1. **Should custom rules be profile-scoped or standalone?**
   - What we know: Requirements say "saved to validation profiles" (RULE-05). Profile-scoped makes sense since rules run alongside profile checks.
   - What's unclear: Can a rule belong to multiple profiles? Or is it one rule per profile?
   - Recommendation: One-to-many (profile has many rules). Keep it simple. If user wants same rule in multiple profiles, they copy it. Avoids complex many-to-many join table.

2. **How should test/preview work when dataset is not yet in the pipeline?**
   - What we know: RULE-04 says "test against the current dataset". In the pipeline flow, parsedData is available at the validate stage.
   - What's unclear: Should test work from the rule management page (outside pipeline) too?
   - Recommendation: For v1, test only works within the pipeline validate stage where parsedData is available. The test sends parsedData to a backend endpoint. This avoids needing to re-download datasets from storage.

3. **Rule execution order relative to built-in checks**
   - What we know: RULE-05 says "run alongside built-in validators"
   - Recommendation: Execute custom rules AFTER built-in checks. This is simpler (just append to issues list) and lets custom rules complement, not override, built-in checks.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (backend) + vitest (frontend) |
| Config file | backend/pytest.ini, vitest.config.ts |
| Quick run command | `cd backend && python -m pytest tests/test_custom_rules.py -x` |
| Full suite command | `cd backend && python -m pytest tests/ -x && cd .. && npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RULE-01 | Custom rule CRUD via API | unit | `cd backend && python -m pytest tests/test_custom_rules.py::test_create_rule -x` | No - Wave 0 |
| RULE-02 | Three rule types execute correctly | unit | `cd backend && python -m pytest tests/test_custom_rules.py::TestRuleTypes -x` | No - Wave 0 |
| RULE-03 | AND/OR grouping with nesting validation | unit | `cd backend && python -m pytest tests/test_custom_rules.py::TestConditionGroups -x` | No - Wave 0 |
| RULE-04 | Test endpoint returns matching rows | unit | `cd backend && python -m pytest tests/test_custom_rules.py::test_rule_test_endpoint -x` | No - Wave 0 |
| RULE-05 | Custom rules run in pipeline alongside built-ins | integration | `cd backend && python -m pytest tests/test_custom_rules.py::test_pipeline_integration -x` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && python -m pytest tests/test_custom_rules.py -x`
- **Per wave merge:** `cd backend && python -m pytest tests/ -x`
- **Phase gate:** Full backend + frontend suite green before verify

### Wave 0 Gaps
- [ ] `backend/tests/test_custom_rules.py` -- covers RULE-01 through RULE-05
- [ ] `tests/pipeline/custom-rule-builder.test.ts` -- frontend component tests for rule builder UI

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `backend/app/services/validation.py` -- existing pipeline structure
- Codebase inspection: `backend/app/models/schemas.py` -- ProfileConfig, EnabledChecks patterns
- Codebase inspection: `backend/app/services/templates.py` -- resolve_config pattern
- Codebase inspection: `backend/app/routers/validation.py` -- request flow from API to pipeline
- Codebase inspection: `supabase/migrations/00007_validation_profiles.sql` -- existing profile table schema
- Codebase inspection: `src/lib/actions/profiles.ts` -- server action CRUD pattern with org scoping
- Codebase inspection: `src/lib/types/validation.ts` -- TypeScript type definitions pattern
- `.planning/REQUIREMENTS.md` -- RULE-01 through RULE-05 definitions, Out of Scope constraints

### Secondary (MEDIUM confidence)
- pandas documentation: boolean indexing and vectorized operations for rule execution

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new libraries needed, all patterns established in codebase
- Architecture: HIGH - Follows existing ProfileConfig/validation pipeline patterns exactly
- Pitfalls: HIGH - Based on direct codebase analysis (dtype=str loading, column mapping patterns)
- Rule schema design: HIGH - Three simple rule types with bounded nesting, well-understood problem

**Research date:** 2026-04-15
**Valid until:** 2026-05-15 (stable domain, no external dependencies)
