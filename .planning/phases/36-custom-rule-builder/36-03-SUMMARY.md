---
phase: 36-custom-rule-builder
plan: 03
subsystem: api
tags: [nextjs, fastapi, custom-rules, pipeline-integration, server-actions]

requires:
  - phase: 36-custom-rule-builder
    provides: Backend CRUD/test endpoints (plan 01) and frontend rule builder components (plan 02)
provides:
  - Next.js API proxy routes for custom rule CRUD and testing
  - Server actions for custom rule management
  - RuleTestPreview component for test result display
  - Custom rules section integrated into pipeline validate stage
  - Custom rule execution during validation pipeline runs
affects: [pipeline-integration, validation]

tech-stack:
  added: []
  patterns: [server-action-to-proxy-to-fastapi pattern for custom rules, profile-scoped rule management]

key-files:
  created:
    - src/app/api/rules/route.ts
    - src/app/api/rules/[ruleId]/route.ts
    - src/app/api/rules/test/route.ts
    - src/lib/actions/custom-rules.ts
    - src/app/(dashboard)/pipeline/components/rule-builder/rule-test-preview.tsx
  modified:
    - src/app/(dashboard)/pipeline/components/stage-validate.tsx
    - backend/app/models/schemas.py
    - backend/app/routers/validation.py
    - src/app/api/validate/route.ts

key-decisions:
  - "Server actions call Next.js API proxies (not FastAPI directly) for consistent auth handling"
  - "Custom rules section uses profile selector to scope rules per validation profile"
  - "Custom rule IDs forwarded through validate route to backend for pipeline execution"

patterns-established:
  - "API proxy pattern: Next.js route -> auth check -> forward to FastAPI -> return response"
  - "Custom rules UI: profile-scoped with toggle, edit, delete per rule"

requirements-completed: [RULE-04, RULE-05]

duration: 17min
completed: 2026-04-17
---

# Phase 36 Plan 03: Pipeline Integration Summary

**End-to-end custom rule builder integration with API proxies, server actions, test preview, validate stage UI, and backend pipeline execution of custom rules**

## Performance

- **Duration:** 17 min
- **Started:** 2026-04-16T22:51:03Z
- **Completed:** 2026-04-17T23:08:00Z
- **Tasks:** 1 of 2 (checkpoint pending)
- **Files modified:** 9

## Accomplishments
- API proxy routes for rule CRUD (POST/GET at /api/rules, PUT/DELETE at /api/rules/[ruleId]) and test endpoint (/api/rules/test)
- Server actions with cookie forwarding for authenticated access to custom rule management
- RuleTestPreview component with match count, truncation warning, and collapsible sample data table
- Custom rules section in validate stage with profile picker, rule list with toggle/edit/delete, and inline RuleBuilder
- Backend integration: custom_rule_ids added to ValidateRequest and executed after built-in checks in validation pipeline

## Task Commits

Each task was committed atomically:

1. **Task 1: API proxies, server actions, test preview, and pipeline integration** - `6f6387a` (feat)

## Files Created/Modified
- `src/app/api/rules/route.ts` - POST (create) and GET (list by profile_id) proxy to FastAPI
- `src/app/api/rules/[ruleId]/route.ts` - PUT (update) and DELETE proxy to FastAPI
- `src/app/api/rules/test/route.ts` - POST test rule proxy to FastAPI
- `src/lib/actions/custom-rules.ts` - Server actions: getRulesForProfile, createRule, updateRule, deleteRule, testRule
- `src/app/(dashboard)/pipeline/components/rule-builder/rule-test-preview.tsx` - Test result display with sample matches table
- `src/app/(dashboard)/pipeline/components/stage-validate.tsx` - Added CustomRulesSection with profile picker, rule list, builder integration
- `backend/app/models/schemas.py` - Added custom_rule_ids field to ValidateRequest
- `backend/app/routers/validation.py` - Execute custom rules after built-in checks in _legacy_validation_background
- `src/app/api/validate/route.ts` - Forward customRuleIds to FastAPI backend

## Decisions Made
- Server actions call Next.js API proxies (not FastAPI directly) for consistent auth cookie forwarding
- Custom rules section uses a profile selector dropdown to scope rules per validation profile
- Custom rule IDs forwarded through validate route; backend queries custom_rules table and executes enabled rules
- Added custom_rule to mapBackendRuleType for pipeline issue type mapping

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Full custom rule builder flow ready for end-to-end verification (Task 2 checkpoint)
- All components wired: create, test, save, toggle, delete, and execute in validation pipeline

---
*Phase: 36-custom-rule-builder*
*Completed: 2026-04-17*
