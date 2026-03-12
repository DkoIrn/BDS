---
phase: 2
slug: project-structure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (or build check via `npm run build`) |
| **Config file** | none — Wave 0 installs if needed |
| **Quick run command** | `npm run build 2>&1 \| tail -10` |
| **Full suite command** | `npm run build` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run build 2>&1 | tail -10`
- **After every plan wave:** Run `npm run build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | PROJ-01 | build | `npm run build` | N/A | ⬜ pending |
| 02-01-02 | 01 | 1 | PROJ-02 | build | `npm run build` | N/A | ⬜ pending |
| 02-02-01 | 02 | 2 | PROJ-03 | build | `npm run build` | N/A | ⬜ pending |
| 02-02-02 | 02 | 2 | PROJ-04 | build | `npm run build` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. Build check sufficient for CRUD pages.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Project list displays correctly | PROJ-03 | Visual layout | Navigate to /projects, verify table renders |
| Job creation within project | PROJ-02 | E2E flow | Create project, add job, verify job appears |
| Drill-down navigation | PROJ-04 | Navigation flow | Click project → verify jobs listed |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
