// Pre-computed demo dataset with crafted QC issues for guided onboarding
// 7 issues: 2 missing_data, 1 outlier, 1 duplicate, 1 range_violation, 1 monotonicity, 1 kp_gap

export const DEMO_DATASET = {
  fileName: "North_Sea_Pipeline_Survey.csv",
  parsedData: [
    ["KP", "Easting", "Northing", "Depth", "DOB", "Cover", "Coating_Condition", "CP_Reading"],
    // Row 1
    ["0.000", "432100.50", "6145200.30", "45.2", "1.20", "0.85", "Good", "-0.92"],
    // Row 2
    ["0.050", "432105.12", "6145205.80", "45.5", "1.18", "0.83", "Good", "-0.91"],
    // Row 3
    ["0.100", "432110.45", "6145210.60", "45.9", "1.15", "0.80", "Good", "-0.90"],
    // Row 4 -- missing_data: empty DOB
    ["0.150", "432115.78", "6145215.40", "46.2", "", "0.78", "Good", "-0.89"],
    // Row 5
    ["0.200", "432120.90", "6145220.10", "47.0", "1.05", "0.70", "Good", "-0.88"],
    // Row 6 -- kp_gap starts here (0.250 -> 0.550 is a big jump)
    ["0.250", "432126.33", "6145224.90", "47.3", "0.98", "0.63", "Fair", "-0.85"],
    // Row 7 -- kp_gap: jumps from 0.250 to 0.550
    ["0.550", "432131.55", "6145229.70", "47.8", "0.92", "0.57", "Fair", "-0.82"],
    // Row 8 -- missing_data: empty Cover
    ["0.600", "432136.88", "6145234.50", "48.2", "0.88", "", "Fair", "-0.80"],
    // Row 9
    ["0.650", "432142.20", "6145239.30", "48.6", "0.78", "0.43", "Good", "-0.78"],
    // Row 10 -- outlier: DOB = 18.50 (way above normal ~1.2m)
    ["0.700", "432147.53", "6145244.10", "49.1", "18.50", "0.37", "Good", "-0.76"],
    // Row 11
    ["0.750", "432152.85", "6145248.90", "49.5", "0.65", "0.30", "Poor", "-0.60"],
    // Row 12
    ["0.800", "432158.18", "6145253.70", "49.9", "0.58", "0.23", "Poor", "-0.55"],
    // Row 13
    ["0.850", "432163.50", "6145258.50", "50.3", "0.50", "0.15", "Fair", "-0.70"],
    // Row 14 -- duplicate: same as row 13
    ["0.850", "432163.50", "6145258.50", "50.3", "0.50", "0.15", "Fair", "-0.70"],
    // Row 15
    ["0.900", "432168.83", "6145263.30", "50.8", "0.45", "0.10", "Fair", "-0.72"],
    // Row 16
    ["0.950", "432174.15", "6145268.10", "51.2", "0.40", "0.05", "Good", "-0.88"],
    // Row 17 -- range_violation: Depth = 520.0 (exceeds 500m default max)
    ["1.000", "432179.48", "6145272.90", "520.0", "0.35", "0.02", "Good", "-0.90"],
    // Row 18
    ["1.050", "432184.80", "6145277.70", "52.0", "0.30", "0.00", "Good", "-0.92"],
    // Row 19 -- monotonicity: KP goes from 1.100 back to 1.050 (wait, row 18 is 1.050)
    // Actually let's make row 19 KP = 1.100, row 20 KP = 1.050 for monotonicity
    ["1.100", "432190.13", "6145282.50", "52.5", "0.28", "0.00", "Good", "-0.93"],
    // Row 20 -- monotonicity: KP drops from 1.100 to 1.050
    ["1.050", "432195.45", "6145287.30", "53.0", "0.25", "0.00", "Fair", "-0.75"],
    // Row 21
    ["1.150", "432200.78", "6145292.10", "53.4", "0.22", "0.00", "Fair", "-0.73"],
  ] as string[][],
  columnCount: 8,
  rowCount: 21,
}

export interface DemoValidationIssue {
  id: string
  type: string
  severity: "error" | "warning" | "info"
  row: number
  column: string
  message: string
  expected: string
  actual: string
}

export const DEMO_VALIDATION = {
  runId: "demo-validation-run",
  issueCount: 7,
  issues: [
    {
      id: "missing_data-4-DOB-0",
      type: "missing_data",
      severity: "warning" as const,
      row: 4,
      column: "DOB",
      message: "Missing value in DOB at row 4",
      expected: "Non-empty numeric value",
      actual: "(empty)",
    },
    {
      id: "missing_data-8-Cover-1",
      type: "missing_data",
      severity: "warning" as const,
      row: 8,
      column: "Cover",
      message: "Missing value in Cover at row 8",
      expected: "Non-empty numeric value",
      actual: "(empty)",
    },
    {
      id: "outlier-10-DOB-0",
      type: "outlier",
      severity: "error" as const,
      row: 10,
      column: "DOB",
      message: "Outlier detected: DOB value 18.50 is far outside expected range (0-10m)",
      expected: "0.00 - 10.00",
      actual: "18.50",
    },
    {
      id: "duplicate-14-KP-0",
      type: "duplicate",
      severity: "warning" as const,
      row: 14,
      column: "KP",
      message: "Duplicate row: row 14 is identical to row 13 (KP=0.850)",
      expected: "Unique rows",
      actual: "Duplicate of row 13",
    },
    {
      id: "range_violation-17-Depth-0",
      type: "range_violation",
      severity: "error" as const,
      row: 17,
      column: "Depth",
      message: "Value 520.0 exceeds maximum allowed depth of 500m",
      expected: "0.00 - 500.00",
      actual: "520.0",
    },
    {
      id: "monotonicity-20-KP-0",
      type: "monotonicity",
      severity: "error" as const,
      row: 20,
      column: "KP",
      message: "KP decreases from 1.100 to 1.050 at row 20 (non-monotonic)",
      expected: "Monotonically increasing",
      actual: "1.100 -> 1.050",
    },
    {
      id: "kp_gap-7-KP-0",
      type: "kp_gap",
      severity: "warning" as const,
      row: 7,
      column: "KP",
      message: "Large KP gap between rows 6-7: 0.250 to 0.550 (gap=0.300)",
      expected: "Consistent KP spacing (~0.050)",
      actual: "Gap of 0.300",
    },
  ] satisfies DemoValidationIssue[],
}

export const DEMO_TRIAGE: Record<
  string,
  { decision: "accept" | "reject" | "defer"; justification: string | null; timestamp: number }
> = {
  "missing_data-4-DOB-0": {
    decision: "reject",
    justification: "Missing DOB must be interpolated before submission",
    timestamp: 1713000000000,
  },
  "missing_data-8-Cover-1": {
    decision: "reject",
    justification: "Missing cover value needs field verification",
    timestamp: 1713000001000,
  },
  "outlier-10-DOB-0": {
    decision: "reject",
    justification: "DOB of 18.50m is clearly erroneous -- likely decimal point error",
    timestamp: 1713000002000,
  },
  "duplicate-14-KP-0": {
    decision: "accept",
    justification: "Confirmed duplicate measurement at same KP -- remove one",
    timestamp: 1713000003000,
  },
  "range_violation-17-Depth-0": {
    decision: "defer",
    justification: "Needs verification against bathymetric survey",
    timestamp: 1713000004000,
  },
  "monotonicity-20-KP-0": {
    decision: "defer",
    justification: "May be valid if surveyed in reverse direction at this section",
    timestamp: 1713000005000,
  },
  "kp_gap-7-KP-0": {
    decision: "accept",
    justification: "Known gap due to existing crossing -- no data expected here",
    timestamp: 1713000006000,
  },
}

// Cleaned version: interpolated missing values, smoothed outlier (3 fixes applied)
export const DEMO_CLEAN_RESULT: string[][] = DEMO_DATASET.parsedData.map(
  (row, i) => {
    const newRow = [...row]
    if (i === 4) {
      // Interpolate missing DOB: average of row 3 (1.15) and row 5 (1.05)
      newRow[4] = "1.10"
    }
    if (i === 8) {
      // Interpolate missing Cover: average of row 7 (0.57) and row 9 (0.43)
      newRow[5] = "0.50"
    }
    if (i === 10) {
      // Smooth outlier DOB: average of row 9 (0.78) and row 11 (0.65)
      newRow[4] = "0.72"
    }
    return newRow
  }
)
