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
  { value: ">", label: "is greater than" },
  { value: "<", label: "is less than" },
  { value: ">=", label: "is at least" },
  { value: "<=", label: "is at most" },
  { value: "==", label: "is exactly" },
  { value: "!=", label: "is not" },
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

// ---------------------------------------------------------------------------
// Client-side rule execution (works on parsedData string[][])
// ---------------------------------------------------------------------------

import type { ValidationIssue } from "@/app/(dashboard)/pipeline/lib/client-validate"

function evaluateCondition(cond: Condition, headers: string[], row: string[]): boolean {
  const colIdx = headers.findIndex((h) => h.toLowerCase() === cond.column.toLowerCase())
  if (colIdx === -1) return false

  const cellValue = row[colIdx]?.trim() ?? ""

  if (cond.ruleType === "null_check") {
    const isEmpty = cellValue === "" || cellValue.toLowerCase() === "null"
    return cond.operator === "is_null" ? isEmpty : !isEmpty
  }

  if (cond.ruleType === "threshold") {
    const numVal = parseFloat(cellValue)
    const threshold = typeof cond.value === "number" ? cond.value : parseFloat(String(cond.value ?? ""))
    if (isNaN(numVal) || isNaN(threshold)) return false

    switch (cond.operator) {
      case ">": return numVal > threshold
      case "<": return numVal < threshold
      case ">=": return numVal >= threshold
      case "<=": return numVal <= threshold
      case "==": return numVal === threshold
      case "!=": return numVal !== threshold
      default: return false
    }
  }

  if (cond.ruleType === "comparison") {
    const compareIdx = headers.findIndex((h) => h.toLowerCase() === (cond.compareColumn ?? "").toLowerCase())
    if (compareIdx === -1) return false
    const numA = parseFloat(cellValue)
    const numB = parseFloat(row[compareIdx]?.trim() ?? "")
    if (isNaN(numA) || isNaN(numB)) return false

    switch (cond.operator) {
      case ">": return numA > numB
      case "<": return numA < numB
      case ">=": return numA >= numB
      case "<=": return numA <= numB
      case "==": return numA === numB
      case "!=": return numA !== numB
      default: return false
    }
  }

  return false
}

function evaluateGroup(group: ConditionGroup, headers: string[], row: string[]): boolean {
  const condResults = group.conditions.map((c) => evaluateCondition(c, headers, row))
  const groupResults = group.groups.map((g) => evaluateGroup(g, headers, row))
  const all = [...condResults, ...groupResults]

  if (all.length === 0) return false
  return group.logic === "AND" ? all.every(Boolean) : all.some(Boolean)
}

/** Execute a custom rule definition against parsedData and return validation issues */
export function executeCustomRuleClientSide(
  rule: CustomRuleDefinition,
  parsedData: string[][]
): ValidationIssue[] {
  if (parsedData.length < 2) return []

  const headers = parsedData[0]
  const issues: ValidationIssue[] = []

  for (let i = 1; i < parsedData.length; i++) {
    const row = parsedData[i]
    if (evaluateGroup(rule.rootGroup, headers, row)) {
      // Find the primary column from the first condition
      const primaryCol = rule.rootGroup.conditions[0]?.column || "unknown"
      issues.push({
        type: "custom_rule" as ValidationIssue["type"],
        severity: rule.severity,
        row: i + 1, // 1-indexed
        column: primaryCol,
        message: `${rule.name}: ${rule.description || "condition matched"}`,
        detail: `Row ${i + 1} matched custom rule`,
      })
    }
  }

  return issues
}
