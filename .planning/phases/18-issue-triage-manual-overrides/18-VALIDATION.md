---
phase: 18
slug: issue-triage-manual-overrides
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-09
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | No test framework configured (manual browser testing) |
| **Config file** | none |
| **Quick run command** | Manual browser test: pipeline flow with triage |
| **Full suite command** | Full pipeline walkthrough: Import → Export with triage decisions |
| **Estimated runtime** | ~3 minutes (manual) |

---

## Sampling Rate

- **After every task commit:** Manual browser test of affected pipeline stage
- **After every plan wave:** Full pipeline walkthrough (Import → Export) with triage
- **Before `/gsd:verify-work`:** Full suite must pass
- **Max feedback latency:** 180 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 18-01-01 | 01 | 1 | Pipeline state extension | manual | Browser: verify Review stage appears in stepper | N/A | ⬜ pending |
| 18-01-02 | 01 | 1 | Stage rendering | manual | Browser: navigate to Review stage | N/A | ⬜ pending |
| 18-02-01 | 02 | 2 | Issue triage actions | manual | Browser: accept/reject/defer individual issues | N/A | ⬜ pending |
| 18-02-02 | 02 | 2 | Bulk operations | manual | Browser: select multiple, bulk accept/reject/defer | N/A | ⬜ pending |
| 18-02-03 | 02 | 2 | Progress tracking | manual | Browser: verify progress bar updates | N/A | ⬜ pending |
| 18-02-04 | 02 | 2 | Clean stage filtering | manual | Browser: verify only accepted issues in Clean | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No test framework needed — all prior phases used manual browser verification.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Review stage appears in stepper | Stage placement | UI visual verification | Run pipeline through Validate, verify 6-stage stepper with Review between Validate and Clean |
| Triage actions work | Accept/Reject/Defer | Interactive UI | Click each action button, verify status badge + row styling changes |
| Reject requires justification | Justification gating | Form validation | Click Reject without comment — should be blocked. Add comment — should proceed |
| Bulk actions with toolbar | Bulk operations | Multi-select interaction | Select 3+ issues, verify floating toolbar appears, bulk accept, verify all update |
| Auto-skip on 0 issues | Conditional stage skip | Requires clean validation run | Upload a clean dataset, validate, verify Review is auto-skipped with toast |
| Accepted issues feed Clean | Stage integration | Cross-stage data flow | Accept some issues, reject others, proceed to Clean, verify only accepted shown |
| Progress bar accuracy | Progress tracking | Count verification | Triage 5 of 10 issues, verify "50%" progress display |
| Re-editable from Clean | Stage navigation | Navigation flow | Go to Clean, navigate back to Review, change a decision, verify Clean updates |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have manual verify instructions
- [ ] Sampling continuity: manual test per task commit
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 180s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
