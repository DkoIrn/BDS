// Onboarding step definitions for each pipeline stage tooltip
import type { PipelineStage } from "./pipeline-state"

export interface OnboardingStep {
  stage: PipelineStage
  selector: string
  title: string
  description: string
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    stage: "import",
    selector: '[data-onboarding="stage-import"]',
    title: "Import Your Data",
    description:
      "Upload your pipeline survey CSV or Excel file, or try the demo dataset to see TruQC in action.",
  },
  {
    stage: "inspect",
    selector: '[data-onboarding="data-preview"]',
    title: "Inspect Your Data",
    description:
      "Preview your data and see auto-detected column types. TruQC identifies KP, coordinates, depth, and other survey fields automatically.",
  },
  {
    stage: "validate",
    selector: '[data-onboarding="run-qc"]',
    title: "Run Quality Checks",
    description:
      "Run automated validation to find missing values, outliers, duplicates, range violations, and more. Issues are flagged with clear explanations.",
  },
  {
    stage: "review",
    selector: '[data-onboarding="issue-triage"]',
    title: "Review Issues",
    description:
      "Triage each flagged issue: accept it as valid, reject it for fixing, or defer for later review. Bulk actions speed up large datasets.",
  },
  {
    stage: "clean",
    selector: '[data-onboarding="fix-actions"]',
    title: "Fix Issues",
    description:
      "Apply one-click fixes to rejected issues: interpolate missing values, smooth outliers, and remove duplicates with full undo support.",
  },
  {
    stage: "export",
    selector: '[data-onboarding="export-panel"]',
    title: "Export Results",
    description:
      "Download your cleaned dataset as CSV or Excel, generate a professional QC report, and share results with your team.",
  },
]
