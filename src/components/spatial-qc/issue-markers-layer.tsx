"use client"

import { CircleMarker, Popup } from "react-leaflet"
import { getSeverityColor } from "./lib/severity-colors"
import type { SpatialIssue, ValidationSeverity } from "./lib/types"

interface IssueMarkersLayerProps {
  issues: SpatialIssue[]
  activeSeverity?: ValidationSeverity | "all"
}

export function IssueMarkersLayer({
  issues,
  activeSeverity = "all",
}: IssueMarkersLayerProps) {
  const filtered =
    activeSeverity === "all"
      ? issues
      : issues.filter((si) => si.issue.severity === activeSeverity)

  return (
    <>
      {filtered.map((si, idx) => {
        const { fill, stroke } = getSeverityColor(si.issue.severity)
        return (
          <CircleMarker
            key={`issue-${idx}-${si.lat}-${si.lng}`}
            center={[si.lat, si.lng]}
            radius={8}
            pathOptions={{
              color: stroke,
              fillColor: fill,
              fillOpacity: 0.7,
              weight: 2,
            }}
          >
            <Popup maxWidth={320}>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase text-white"
                    style={{ backgroundColor: fill }}
                  >
                    {si.issue.severity}
                  </span>
                  <span className="font-medium text-gray-700">
                    {si.issue.rule_type}
                  </span>
                </div>
                <p className="text-gray-600">{si.issue.message}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-500">
                  {si.issue.column_name && (
                    <span>
                      Column: <strong>{si.issue.column_name}</strong>
                    </span>
                  )}
                  {si.issue.row_number != null && (
                    <span>
                      Row: <strong>{si.issue.row_number}</strong>
                    </span>
                  )}
                  {si.issue.kp_value != null && (
                    <span>
                      KP: <strong>{si.issue.kp_value}</strong>
                    </span>
                  )}
                </div>
                {(si.issue.expected || si.issue.actual) && (
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-500">
                    {si.issue.expected && (
                      <span>
                        Expected: <strong>{si.issue.expected}</strong>
                      </span>
                    )}
                    {si.issue.actual && (
                      <span>
                        Actual: <strong>{si.issue.actual}</strong>
                      </span>
                    )}
                  </div>
                )}
              </div>
            </Popup>
          </CircleMarker>
        )
      })}
    </>
  )
}
