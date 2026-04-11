---
phase: 28-guided-onboarding-flow
plan: 02
subsystem: ui, pipeline
tags: [onboarding, guided-tour, tooltips, celebration, dashboard, settings]

requires:
  - phase: 28-guided-onboarding-flow
    plan: 01
    provides: Demo dataset, onboarding server actions, step definitions
provides:
  - GuidedOnboarding orchestrator wrapping pipeline workflow with step-by-step tour
  - OnboardingTooltip spotlight overlay with contextual guidance
  - OnboardingWelcome screen with Start Tour / Skip options
  - OnboardingCelebration completion screen with demo stats
  - DashboardWelcome overlay for first-time users on dashboard
  - Replay Tour button in settings page
  - Replay Tour menu item in profile dropdown
affects: []

tech-stack:
  added: []
  modified: []
---

## What Was Done

Built the complete guided onboarding UI for first-time users:

### Onboarding Components
- **GuidedOnboarding** (`pipeline/components/guided-onboarding.tsx`): Main orchestrator that wraps the pipeline workflow, manages tour state through all 6 pipeline stages, loads demo data without API calls
- **OnboardingTooltip** (`pipeline/components/onboarding-tooltip.tsx`): Spotlight overlay highlighting UI elements with contextual tooltip explaining each feature
- **OnboardingWelcome** (`pipeline/components/onboarding-welcome.tsx`): Welcome screen with Start Tour and Skip options shown to new users
- **OnboardingCelebration** (`pipeline/components/onboarding-celebration.tsx`): Completion screen showing stats about issues found and fixed during the demo

### Integration Points
- **Dashboard** (`dashboard/page.tsx`): Queries `onboarding_completed` from profile, shows `DashboardWelcome` overlay for first-time users
- **DashboardWelcome** (`dashboard/dashboard-welcome.tsx`): Client component with localStorage fast-check, routes to pipeline demo on start, marks complete on skip
- **Settings** (`settings/page.tsx`): Added "Guided Tour" card with Replay Tour button
- **Top Navbar** (`top-navbar.tsx`): Added Replay Tour option in profile dropdown menu

### Tour Flow
1. New user lands on dashboard → sees welcome overlay
2. Start Tour → redirected to `/pipeline?demo=true` with pre-loaded demo data
3. Tour walks through Import → Inspect → Validate → Triage → Clean → Export
4. Each stage shows contextual tooltip explaining the feature
5. Completion → celebration screen with stats
6. `onboarding_completed` set to true in profile, stored in localStorage for fast checks
7. User can replay anytime from settings or profile dropdown

## Deviations
- Crash recovery: original execution was interrupted by VS Code crash. Integration changes to dashboard, settings, and navbar were completed in a follow-up commit (991d187).
