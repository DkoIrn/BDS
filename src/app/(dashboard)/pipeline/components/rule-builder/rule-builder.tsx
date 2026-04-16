"use client"

import { useState } from "react"
import { Wand2, Play, Save, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import type {
  CustomRuleDefinition,
  ConditionGroup,
  RuleTestResult,
} from "@/lib/types/custom-rules"
import { createEmptyGroup } from "@/lib/types/custom-rules"
import { ConditionGroupComponent } from "./condition-group"

const SEVERITY_OPTIONS = [
  { value: "critical" as const, label: "Critical", color: "bg-red-500" },
  { value: "warning" as const, label: "Warning", color: "bg-amber-500" },
  { value: "info" as const, label: "Info", color: "bg-blue-500" },
]

interface RuleBuilderProps {
  columns: Array<{ value: string; label: string }>
  initialRule?: CustomRuleDefinition
  onSave: (rule: CustomRuleDefinition) => void
  onTest?: (rule: CustomRuleDefinition) => void
  onCancel?: () => void
  testResult?: RuleTestResult | null
  isTesting?: boolean
}

function hasAtLeastOneCondition(group: ConditionGroup): boolean {
  if (group.conditions.length > 0) return true
  return group.groups.some(hasAtLeastOneCondition)
}

export function RuleBuilder({
  columns,
  initialRule,
  onSave,
  onTest,
  onCancel,
  testResult,
  isTesting = false,
}: RuleBuilderProps) {
  const [name, setName] = useState(initialRule?.name ?? "")
  const [description, setDescription] = useState(
    initialRule?.description ?? ""
  )
  const [severity, setSeverity] = useState<"critical" | "warning" | "info">(
    initialRule?.severity ?? "warning"
  )
  const [rootGroup, setRootGroup] = useState<ConditionGroup>(
    initialRule?.rootGroup ?? createEmptyGroup()
  )

  function buildDefinition(): CustomRuleDefinition {
    return { name: name.trim(), description: description.trim(), severity, rootGroup }
  }

  function handleSave() {
    if (!name.trim()) {
      toast.error("Rule name is required")
      return
    }
    if (!hasAtLeastOneCondition(rootGroup)) {
      toast.error("At least one condition is required")
      return
    }
    onSave(buildDefinition())
  }

  function handleTest() {
    if (!onTest) return
    if (!hasAtLeastOneCondition(rootGroup)) {
      toast.error("Add at least one condition to test")
      return
    }
    onTest(buildDefinition())
  }

  function handleSeverityChange(value: string | null) {
    if (value) setSeverity(value as "critical" | "warning" | "info")
  }

  const severityLabel =
    SEVERITY_OPTIONS.find((s) => s.value === severity)?.label ?? severity

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wand2 className="size-4 text-violet-500" />
          Custom Rule Builder
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Rule metadata */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Rule Name
            </label>
            <Input
              placeholder="e.g. DOB exceeds DOC"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Description (optional)
            </label>
            <Input
              placeholder="What this rule checks"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        {/* Severity */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Severity
          </label>
          <Select value={severity} onValueChange={handleSeverityChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SEVERITY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  <span className="flex items-center gap-2">
                    <span
                      className={`inline-block size-2 rounded-full ${opt.color}`}
                    />
                    {opt.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Conditions section */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-muted-foreground">
            Flag rows where...
          </p>
          <ConditionGroupComponent
            group={rootGroup}
            columns={columns}
            depth={0}
            onChange={setRootGroup}
          />
        </div>

        {/* Result label */}
        <p className="text-sm font-semibold text-muted-foreground">
          Mark matching rows as{" "}
          <span className="text-foreground">{severityLabel}</span>
        </p>

        {/* Test result */}
        {testResult && (
          <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
            <p className="font-medium">
              {testResult.matching_rows} of {testResult.total_rows} rows
              matched
            </p>
            {testResult.truncated && (
              <p className="text-xs text-muted-foreground">
                Results were truncated. Only a sample is shown.
              </p>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {onTest && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={isTesting}
            >
              <Play data-icon="inline-start" className="size-3.5" />
              {isTesting ? "Testing..." : "Test Rule"}
            </Button>
          )}
          <Button size="sm" onClick={handleSave}>
            <Save data-icon="inline-start" className="size-3.5" />
            Save Rule
          </Button>
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel}>
              <X data-icon="inline-start" className="size-3.5" />
              Cancel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
