---
phase: 34
slug: collaboration-extended
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-14
---

# Phase 34 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (frontend) + manual (email delivery) |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run tests/collaboration --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/collaboration --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 34-01-01 | 01 | 1 | COLB-02 | unit | `npx vitest run tests/collaboration/email-notifications.test.ts` | ❌ W0 | ⬜ pending |
| 34-01-02 | 01 | 1 | COLB-02 | unit | `npx vitest run tests/collaboration/notification-preferences.test.ts` | ❌ W0 | ⬜ pending |
| 34-02-01 | 02 | 1 | COLB-05 | unit | `npx vitest run tests/collaboration/activity-feed.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/collaboration/email-notifications.test.ts` — stubs for COLB-02 email dispatch
- [ ] `tests/collaboration/notification-preferences.test.ts` — stubs for COLB-02 preference toggles
- [ ] `tests/collaboration/activity-feed.test.ts` — stubs for COLB-05 activity feed
- [ ] `npm install resend @react-email/components` — email dependencies

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Email actually delivered | COLB-02 | External service (Resend API) | 1. Trigger a validation. 2. Check email inbox for notification. 3. Verify branded template renders correctly. |
| Notification preferences persist | COLB-02 | UI + DB round-trip | 1. Go to /settings. 2. Toggle off an email category. 3. Trigger that event. 4. Verify no email sent. |
| Activity feed on project page | COLB-05 | Visual layout validation | 1. Navigate to a project page. 2. Verify timeline shows recent events with icons. 3. Test filter chips. 4. Test "Load more". |
| Email unsubscribe link works | COLB-02 | Browser navigation | 1. Open a notification email. 2. Click "Manage preferences". 3. Verify it navigates to /settings notifications section. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
