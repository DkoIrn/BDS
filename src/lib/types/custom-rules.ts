/** Rule type discriminator */
export type RuleType = "threshold" | "comparison" | "null_check"

/** Single condition within a rule */
export interface Condition {
  id: string
  column: string
  ruleType: RuleType
  operator: string
  value?: number | string
  compareColumn?: string
}

/** Group of conditions with AND/OR logic */
export interface ConditionGroup {
  id: string
  logic: "AND" | "OR"
  conditions: Condition[]
  groups: ConditionGroup[]
}

/** Full rule definition (what gets saved) */
export interface CustomRuleDefinition {
  name: string
  description: string
  severity: "critical" | "warning" | "info"
  rootGroup: ConditionGroup
}

/** Database record (returned from API) */
export interface CustomRule {
  id: string
  profile_id: string
  user_id: string
  org_id: string
  name: string
  description: string
  severity: "critical" | "warning" | "info"
  rule_definition: ConditionGroup
  enabled: boolean
  created_at: string
  updated_at: string
}

/** Test result from backend */
export interface RuleTestResult {
  matching_rows: number
  total_rows: number
  sample_matches: Array<{ row_number: number; values: Record<string, unknown> }>
  truncated?: boolean
}

// ---------------------------------------------------------------------------
// Operator constants
// ---------------------------------------------------------------------------

export const THRESHOLD_OPERATORS = [
  { value: ">", label: "greater than" },
  { value: "<", label: "less than" },
  { value: ">=", label: "greater than or equal" },
  { value: "<=", label: "less than or equal" },
  { value: "==", label: "equals" },
  { value: "!=", label: "not equal to" },
] as const

export const COMPARISON_OPERATORS = THRESHOLD_OPERATORS

export const NULL_OPERATORS = [
  { value: "is_null", label: "is empty" },
  { value: "is_not_null", label: "is not empty" },
] as const

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/** Create an empty condition with a unique ID */
export function createEmptyCondition(): Condition {
  return {
    id: crypto.randomUUID(),
    column: "",
    ruleType: "threshold",
    operator: ">",
  }
}

/** Create an empty condition group with one empty condition */
export function createEmptyGroup(logic: "AND" | "OR" = "AND"): ConditionGroup {
  return {
    id: crypto.randomUUID(),
    logic,
    conditions: [createEmptyCondition()],
    groups: [],
  }
}

/** Return the appropriate operator array for a given rule type */
export function getOperatorsForType(ruleType: RuleType) {
  switch (ruleType) {
    case "threshold":
      return THRESHOLD_OPERATORS
    case "comparison":
      return COMPARISON_OPERATORS
    case "null_check":
      return NULL_OPERATORS
  }
}

/** Recursively compute the nesting depth of a condition group */
export function getNestingDepth(
  group: ConditionGroup,
  current: number = 0
): number {
  if (group.groups.length === 0) return current
  return Math.max(
    ...group.groups.map((g) => getNestingDepth(g, current + 1))
  )
}

/** Returns true if a nested group can be added (depth < 2) */
export function canAddNestedGroup(group: ConditionGroup): boolean {
  return getNestingDepth(group) < 2
}
