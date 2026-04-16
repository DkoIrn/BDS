"use client"

import { Plus, FolderPlus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Condition, ConditionGroup } from "@/lib/types/custom-rules"
import {
  createEmptyCondition,
  createEmptyGroup,
} from "@/lib/types/custom-rules"
import { ConditionRow } from "./condition-row"
import { cn } from "@/lib/utils"

interface ConditionGroupComponentProps {
  group: ConditionGroup
  columns: Array<{ value: string; label: string }>
  depth: number
  onChange: (updated: ConditionGroup) => void
  onRemove?: () => void
}

export function ConditionGroupComponent({
  group,
  columns,
  depth,
  onChange,
  onRemove,
}: ConditionGroupComponentProps) {
  const isAnd = group.logic === "AND"

  function toggleLogic() {
    onChange({ ...group, logic: isAnd ? "OR" : "AND" })
  }

  function addCondition() {
    onChange({
      ...group,
      conditions: [...group.conditions, createEmptyCondition()],
    })
  }

  function addNestedGroup() {
    onChange({
      ...group,
      groups: [...group.groups, createEmptyGroup()],
    })
  }

  function updateCondition(index: number, updated: Condition) {
    const next = [...group.conditions]
    next[index] = updated
    onChange({ ...group, conditions: next })
  }

  function removeCondition(index: number) {
    const next = group.conditions.filter((_, i) => i !== index)
    onChange({ ...group, conditions: next })
  }

  function updateNestedGroup(index: number, updated: ConditionGroup) {
    const next = [...group.groups]
    next[index] = updated
    onChange({ ...group, groups: next })
  }

  function removeNestedGroup(index: number) {
    const next = group.groups.filter((_, i) => i !== index)
    onChange({ ...group, groups: next })
  }

  const canNest = depth < 2

  return (
    <div
      className={cn(
        "rounded-xl border p-3 space-y-2",
        isAnd
          ? "border-l-4 border-l-blue-400 dark:border-l-blue-600"
          : "border-l-4 border-l-amber-400 dark:border-l-amber-600"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="xs" onClick={toggleLogic}>
          {group.logic}
        </Button>
        <Button variant="ghost" size="xs" onClick={addCondition}>
          <Plus data-icon="inline-start" />
          Condition
        </Button>
        <Button
          variant="ghost"
          size="xs"
          onClick={addNestedGroup}
          disabled={!canNest}
        >
          <FolderPlus data-icon="inline-start" />
          Group
        </Button>
        {onRemove && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onRemove}
            className="ml-auto text-muted-foreground hover:text-destructive"
          >
            <X className="size-3" />
          </Button>
        )}
      </div>

      {/* Conditions */}
      {group.conditions.map((cond, i) => (
        <div key={cond.id}>
          {i > 0 && (
            <span
              className={cn(
                "inline-block text-xs font-medium rounded px-1.5 py-0.5 mb-1",
                isAnd
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
              )}
            >
              {group.logic}
            </span>
          )}
          <ConditionRow
            condition={cond}
            columns={columns}
            onChange={(updated) => updateCondition(i, updated)}
            onRemove={() => removeCondition(i)}
          />
        </div>
      ))}

      {/* Nested groups */}
      {group.groups.map((nested, i) => (
        <div key={nested.id}>
          {(group.conditions.length > 0 || i > 0) && (
            <span
              className={cn(
                "inline-block text-xs font-medium rounded px-1.5 py-0.5 mb-1",
                isAnd
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
              )}
            >
              {group.logic}
            </span>
          )}
          <ConditionGroupComponent
            group={nested}
            columns={columns}
            depth={depth + 1}
            onChange={(updated) => updateNestedGroup(i, updated)}
            onRemove={() => removeNestedGroup(i)}
          />
        </div>
      ))}
    </div>
  )
}
