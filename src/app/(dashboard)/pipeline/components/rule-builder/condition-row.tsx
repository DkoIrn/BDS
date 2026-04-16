"use client"

import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Condition, RuleType } from "@/lib/types/custom-rules"
import { getOperatorsForType } from "@/lib/types/custom-rules"

const RULE_TYPE_LABELS: Record<RuleType, string> = {
  threshold: "has a value",
  comparison: "compared to column",
  null_check: "is empty or filled",
}

interface ConditionRowProps {
  condition: Condition
  columns: Array<{ value: string; label: string }>
  onChange: (updated: Condition) => void
  onRemove: () => void
}

export function ConditionRow({
  condition,
  columns,
  onChange,
  onRemove,
}: ConditionRowProps) {
  const operators = getOperatorsForType(condition.ruleType)

  function handleColumnChange(value: string | null) {
    if (value) onChange({ ...condition, column: value })
  }

  function handleRuleTypeChange(value: string | null) {
    if (!value) return
    const ruleType = value as RuleType
    const newOperators = getOperatorsForType(ruleType)
    onChange({
      ...condition,
      ruleType,
      operator: newOperators[0].value,
      value: ruleType === "null_check" ? undefined : condition.value,
      compareColumn:
        ruleType === "comparison" ? condition.compareColumn : undefined,
    })
  }

  function handleOperatorChange(value: string | null) {
    if (value) onChange({ ...condition, operator: value })
  }

  function handleValueChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    onChange({ ...condition, value: raw === "" ? undefined : Number(raw) })
  }

  function handleCompareColumnChange(value: string | null) {
    if (value) onChange({ ...condition, compareColumn: value })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Column select */}
      <Select value={condition.column || undefined} onValueChange={handleColumnChange}>
        <SelectTrigger size="sm" className="min-w-[120px]">
          <SelectValue placeholder="Column" />
        </SelectTrigger>
        <SelectContent>
          {columns.map((col) => (
            <SelectItem key={col.value} value={col.value}>
              {col.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Rule type select */}
      <Select value={condition.ruleType} onValueChange={handleRuleTypeChange}>
        <SelectTrigger size="sm" className="min-w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(RULE_TYPE_LABELS) as RuleType[]).map((rt) => (
            <SelectItem key={rt} value={rt}>
              {RULE_TYPE_LABELS[rt]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Operator select */}
      <Select value={condition.operator} onValueChange={handleOperatorChange}>
        <SelectTrigger size="sm" className="min-w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {operators.map((op) => (
            <SelectItem key={op.value} value={op.value}>
              {op.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Value input -- depends on rule type */}
      {condition.ruleType === "threshold" && (
        <Input
          type="number"
          placeholder="Value"
          value={condition.value ?? ""}
          onChange={handleValueChange}
          className="w-[100px]"
        />
      )}

      {condition.ruleType === "comparison" && (
        <Select
          value={condition.compareColumn || undefined}
          onValueChange={handleCompareColumnChange}
        >
          <SelectTrigger size="sm" className="min-w-[120px]">
            <SelectValue placeholder="Compare to" />
          </SelectTrigger>
          <SelectContent>
            {columns.map((col) => (
              <SelectItem key={col.value} value={col.value}>
                {col.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* null_check needs no value input */}

      {/* Remove button */}
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onRemove}
        className="text-destructive"
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  )
}
