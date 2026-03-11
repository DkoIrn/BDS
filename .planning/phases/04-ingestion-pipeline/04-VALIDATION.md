---
phase: 4
slug: ingestion-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-11
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x with jsdom |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | FILE-02 | unit | `npx vitest run tests/parsing/column-detector.test.ts -t "name matching"` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | FILE-02 | unit | `npx vitest run tests/parsing/column-detector.test.ts -t "data sampling"` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 1 | FILE-02 | unit | `npx vitest run tests/parsing/column-detector.test.ts -t "survey type"` | ❌ W0 | ⬜ pending |
| 04-01-04 | 01 | 1 | PROC-03 | unit | `npx vitest run tests/parsing/csv-parser.test.ts -t "BOM"` | ❌ W0 | ⬜ pending |
| 04-01-05 | 01 | 1 | PROC-03 | unit | `npx vitest run tests/parsing/header-detector.test.ts` | ❌ W0 | ⬜ pending |
| 04-01-06 | 01 | 1 | PROC-03 | unit | `npx vitest run tests/parsing/excel-parser.test.ts` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 2 | FILE-03 | unit | `npx vitest run tests/actions/files.test.ts -t "save mappings"` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 2 | FILE-04 | unit | `npx vitest run tests/parsing/csv-parser.test.ts -t "preview"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/parsing/column-detector.test.ts` — stubs for FILE-02 (name matching, data sampling, survey type awareness)
- [ ] `tests/parsing/csv-parser.test.ts` — stubs for PROC-03, FILE-04 (BOM, encoding, preview rows)
- [ ] `tests/parsing/excel-parser.test.ts` — stubs for PROC-03 (Excel parsing, multi-sheet)
- [ ] `tests/parsing/header-detector.test.ts` — stubs for PROC-03 (metadata row skipping)
- [ ] `tests/fixtures/` — sample CSV/Excel files for testing (with BOM, metadata rows, various encodings)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Column mapping dropdown UI interactions | FILE-03 | Complex UI interactions with drag-and-drop and dropdowns | 1. Upload a CSV file 2. Verify dropdowns render per column 3. Change a mapping 4. Confirm mappings save |
| Preview table rendering with horizontal scroll | FILE-04 | Visual rendering and scroll behavior | 1. Upload file with 10+ columns 2. Verify horizontal scroll works 3. Check mapped columns appear first |
| Warning banner display and auto-fix | PROC-03 | Visual UI component behavior | 1. Upload file with BOM/encoding issues 2. Verify yellow warning banner appears 3. Check expandable details work |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
