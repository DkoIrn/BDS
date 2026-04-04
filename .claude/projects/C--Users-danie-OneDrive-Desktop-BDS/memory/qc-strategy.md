---
name: qc-strategy
description: QC validation feature priorities — cross-column consistency first, then spikes/gradients, then coordinate sanity
type: project
---

# QC Validation Strategy

**Core insight:** Differentiation comes from "engineer-level" checks, not basic hygiene.

## Tier A — Basic hygiene (already built)
- Missing data, duplicates, outliers, KP monotonicity
- Expected by users, doesn't differentiate

## Tier B — Engineer-level validation (the differentiator)

### Priority 1: Cross-Column Consistency
- DOB ≤ Water Depth, DOC ≤ DOB
- Lat/Lon ↔ Easting/Northing consistency
- KP vs coordinates alignment
- Present as: "DOB exceeds water depth — physically inconsistent" (not just "error")

### Priority 2: Spike Detection + Gradient Checks
- Row-to-row deltas, not just statistical outliers
- Threshold based on KP distance + expected physical change
- Example: "Depth increases by 3.6m over 0.01 KP — exceeds expected gradient"

### Priority 3: Coordinate Sanity
- Points outside expected bounding box
- Impossible lat/lon values
- CRS mismatch detection

### Priority 4: Column Completeness Scoring (later, dashboard-level)

## Packaging
- Group as "Advanced QC Checks" or "Engineering-Grade QC"
- 5-10 checks engineers immediately respect > 20 mediocre checks
- Wording matters: explain *why* something is wrong physically, not just flag it

**Why:** Mimics what senior QC engineers think about. Not easily done in Excel. High signal, low noise.

**How to apply:** When building validation rules, prioritize physical plausibility and cross-field logic over adding more single-column checks. Every flag should explain the physical inconsistency.
