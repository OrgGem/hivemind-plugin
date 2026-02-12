---
phase: 02-auto-hooks-governance-mesh
plan: 03
subsystem: governance
tags: [framework-detection, gsd, spec-kit, prompt-injection, tool-gate]

requires:
  - phase: 02-01
    provides: governance signal pipeline and turn-window bootstrap baseline
provides:
  - Framework context detection for GSD/Spec-kit/dual/no-framework projects
  - Locked framework selection menu contract with required metadata keys
  - Hook-level conflict routing tiers (warn-only, limited-mode, simulated-pause)
  - GSD phase-goal pinning for framework-aware drift guidance
affects: [phase-02-governance, phase-03-session-management]

tech-stack:
  added: []
  patterns:
    - Pure framework context helpers in src/lib with no SDK imports
    - Policy routing in hooks based on governance mode and automation level

key-files:
  created:
    - src/lib/framework-context.ts
    - tests/framework-context.test.ts
  modified:
    - src/lib/index.ts
    - src/hooks/session-lifecycle.ts
    - src/hooks/tool-gate.ts
    - src/schemas/brain-state.ts

key-decisions:
  - "Persist framework selection metadata in brain state so hooks can enforce conflict gating deterministically"
  - "Map conflict response tiers to governance posture: permissive=warn-only, assisted/strict=limited mode, strict+full/retard=simulated pause"

patterns-established:
  - "Framework conflict routing: detect once, render prompt guidance + gate behavior from shared context"
  - "GSD goal pinning: inject active phase goal ahead of other drift hints when roadmap data exists"

duration: 10 min
completed: 2026-02-12
---

# Phase 2 Plan 03: Framework conflict selection gate + GSD phase-goal pinning Summary

**Framework-aware governance now detects GSD/Spec-kit conflicts, enforces locked selection metadata before implementation, and pins the active GSD phase goal into injected context.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-02-12T11:38:00Z
- **Completed:** 2026-02-12T11:47:57Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Added pure `framework-context` helpers for framework detection, phase-goal extraction, and locked selection-menu construction.
- Integrated framework conflict routing in `session-lifecycle` and `tool-gate` with settings-driven behavior tiers.
- Extended brain state with framework selection metadata to support deterministic validation of conflict resolution paths.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build pure framework conflict detector and locked selection menu contract** - `0ca5356` (feat)
2. **Task 2: Enforce settings-driven conflict handling and phase-goal-aware drift guidance** - `f9a0cc0` (feat)

**Plan metadata:** `TBD` (docs: complete plan)

## Files Created/Modified
- `src/lib/framework-context.ts` - Detects framework context, extracts active GSD phase goal from roadmap, and builds locked menu options.
- `src/lib/index.ts` - Exports framework context helpers through the lib barrel.
- `src/hooks/session-lifecycle.ts` - Injects GSD goal pinning and dual-framework conflict guidance with required metadata paths.
- `src/hooks/tool-gate.ts` - Applies warn-only, limited-mode, and simulated-pause conflict responses before implementation tools.
- `src/schemas/brain-state.ts` - Adds `framework_selection` metadata state used by conflict gating.
- `tests/framework-context.test.ts` - Covers framework combinations, menu metadata contract, and phase-goal extraction.

## Decisions Made
- Stored framework-selection metadata (`choice`, `active_phase`, `active_spec_path`, `acceptance_note`) in brain state for reproducible hook behavior.
- Required explicit framework metadata before allowing implementation tools in dual-framework mode, even if override note exists.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- GOV-06 and GOV-07 scaffolding is in place and verified (`tsc`, framework-context tests, integration tests).
- Ready for remaining Phase 2 plans that build on conflict routing and escalation behavior.

## Self-Check: PASSED
- FOUND: `src/lib/framework-context.ts`
- FOUND: `tests/framework-context.test.ts`
- FOUND: `.planning/phases/02-auto-hooks-governance-mesh/02-03-SUMMARY.md`
- FOUND commit: `0ca5356`
- FOUND commit: `f9a0cc0`
