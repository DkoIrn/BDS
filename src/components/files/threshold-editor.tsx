"use client"

import { useCallback } from "react"
import { RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { ProfileConfig } from "@/lib/types/validation"

interface ThresholdEditorProps {
  config: ProfileConfig
  onChange: (config: ProfileConfig) => void
  mappedColumnTypes: string[]
  onReset: () => void
  errors: Record<string, string>
}

/** Pretty labels for column types */
const COLUMN_LABELS: Record<string, string> = {
  dob: "Depth of Burial (m)",
  doc: "Depth of Cover (m)",
  top: "Top of Pipe (m)",
  depth: "Water Depth (m)",
  easting: "Easting (m)",
  northing: "Northing (m)",
  elevation: "Elevation (m)",
  latitude: "Latitude (°)",
  longitude: "Longitude (°)",
}

/** Labels for enabled check types */
const CHECK_LABELS: Record<string, string> = {
  range_check: "Range Check",
  missing_data: "Missing Data Detection",
  duplicate_rows: "Duplicate Row Detection",
  near_duplicate_kp: "Near-Duplicate KP Detection",
  outliers_zscore: "Outlier Detection (Z-Score)",
  outliers_iqr: "Outlier Detection (IQR)",
  kp_gaps: "KP Gap Detection",
  monotonicity: "KP Monotonicity Check",
}

export function ThresholdEditor({
  config,
  onChange,
  mappedColumnTypes,
  onReset,
  errors,
}: ThresholdEditorProps) {
  const updateRange = useCallback(
    (colType: string, field: "min" | "max", value: string) => {
      const num = value === "" || value === "-" ? 0 : Number(value)
      if (value !== "" && value !== "-" && isNaN(num)) return
      onChange({
        ...config,
        ranges: {
          ...config.ranges,
          [colType]: {
            ...config.ranges[colType],
            [field]: value === "" || value === "-" ? value : num,
          },
        },
      })
    },
    [config, onChange]
  )

  const updateStatField = useCallback(
    (field: keyof ProfileConfig, value: string) => {
      const num = value === "" ? 0 : Number(value)
      if (value !== "" && isNaN(num)) return
      onChange({ ...config, [field]: value === "" ? "" : num })
    },
    [config, onChange]
  )

  const toggleCheck = useCallback(
    (check: string) => {
      onChange({
        ...config,
        enabled_checks: {
          ...config.enabled_checks,
          [check]: !config.enabled_checks[check as keyof typeof config.enabled_checks],
        },
      })
    },
    [config, onChange]
  )

  const relevantRanges = Object.keys(config.ranges).filter((col) =>
    mappedColumnTypes.includes(col)
  )

  return (
    <div className="space-y-5 rounded-lg border border-border bg-muted/30 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Threshold Configuration</h3>
        <Button type="button" variant="ghost" size="sm" onClick={onReset}>
          <RotateCcw className="mr-1.5 size-3.5" />
          Reset to Defaults
        </Button>
      </div>

      {/* Range Thresholds */}
      {relevantRanges.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Range Thresholds
          </h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {relevantRanges.map((colType) => {
              const range = config.ranges[colType]
              const label = COLUMN_LABELS[colType] ?? colType
              const errKey = `range_${colType}`
              return (
                <div key={colType} className="space-y-1.5">
                  <Label className="text-xs">{label}</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={range.min}
                      onChange={(e) =>
                        updateRange(colType, "min", e.target.value)
                      }
                      className="h-8 text-xs"
                      placeholder="Min"
                    />
                    <span className="text-xs text-muted-foreground">to</span>
                    <Input
                      type="number"
                      value={range.max}
                      onChange={(e) =>
                        updateRange(colType, "max", e.target.value)
                      }
                      className="h-8 text-xs"
                      placeholder="Max"
                    />
                  </div>
                  {errors[errKey] && (
                    <p className="text-xs text-red-500">{errors[errKey]}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Statistical Checks */}
      <div className="space-y-3">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Statistical Settings
        </h4>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Z-Score Threshold</Label>
            <Input
              type="number"
              step="0.1"
              value={config.zscore_threshold}
              onChange={(e) =>
                updateStatField("zscore_threshold", e.target.value)
              }
              className="h-8 text-xs"
            />
            {errors.zscore_threshold && (
              <p className="text-xs text-red-500">{errors.zscore_threshold}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">IQR Multiplier</Label>
            <Input
              type="number"
              step="0.1"
              value={config.iqr_multiplier}
              onChange={(e) =>
                updateStatField("iqr_multiplier", e.target.value)
              }
              className="h-8 text-xs"
            />
            {errors.iqr_multiplier && (
              <p className="text-xs text-red-500">{errors.iqr_multiplier}</p>
            )}
          </div>
        </div>
      </div>

      {/* KP Settings */}
      <div className="space-y-3">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          KP Settings
        </h4>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Max KP Gap</Label>
            <Input
              type="number"
              step="0.01"
              value={config.kp_gap_max ?? ""}
              onChange={(e) => {
                const val = e.target.value
                onChange({
                  ...config,
                  kp_gap_max: val === "" ? null : Number(val),
                })
              }}
              className="h-8 text-xs"
              placeholder="Auto"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Duplicate KP Tolerance</Label>
            <Input
              type="number"
              step="0.001"
              value={config.duplicate_kp_tolerance}
              onChange={(e) =>
                updateStatField("duplicate_kp_tolerance", e.target.value)
              }
              className="h-8 text-xs"
            />
            {errors.duplicate_kp_tolerance && (
              <p className="text-xs text-red-500">
                {errors.duplicate_kp_tolerance}
              </p>
            )}
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={config.monotonicity_check}
                onChange={() =>
                  onChange({
                    ...config,
                    monotonicity_check: !config.monotonicity_check,
                  })
                }
                className="size-3.5 rounded border-input accent-primary"
              />
              Monotonicity Check
            </label>
          </div>
        </div>
      </div>

      {/* Enabled Checks */}
      <div className="space-y-3">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Enabled Checks
        </h4>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {Object.entries(CHECK_LABELS).map(([key, label]) => (
            <label
              key={key}
              className="flex items-center gap-2 text-xs cursor-pointer"
            >
              <input
                type="checkbox"
                checked={
                  config.enabled_checks[
                    key as keyof typeof config.enabled_checks
                  ]
                }
                onChange={() => toggleCheck(key)}
                className="size-3.5 rounded border-input accent-primary"
              />
              {label}
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}
