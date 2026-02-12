---
phase: 02-auto-hooks-governance-mesh
plan: 01
subsystem: governance
tags: [hooks, detection, lifecycle, severity, permissive-mode]

requires:
  - phase: 01-sdk-foundation-system-core
    provides: Hook wiring, state persistence, detection baseline
provides:
  - Locked governance severity mapping and seriousness scoring primitives
  - Governance counters with acknowledgment downgrade and prerequisite-gated full reset
  - Turn-window bootstrap/evidence/team guidance active from turn 0 in all governance modes
  - Permissive-mode navigation context with suppressed detection-pressure rendering
affects: [phase-02-plan-02, soft-governance, session-lifecycle, test-suite]

tech-stack:
  added: []
  patterns:
    - Shared severity and seriousness compilation in src/lib
    - Turn-window prompt injection independent of lock state
    - Localized guidance with English tool identifier preservation

key-files:
  created: []
  modified:
    - src/lib/detection.ts
    - src/schemas/brain-state.ts
    - src/hooks/session-lifecycle.ts
    - tests/detection.test.ts
    - tests/integration.test.ts

key-decisions:
  - "Lock severity mapping in pure detection primitives so later hooks reuse one source of truth"
  - "Use turn_count <= 2 as bootstrap gate in every governance mode, independent of lock status"
  - "Keep permissive mode informational/navigation-first by suppressing pressure alerts"

patterns-established:
  - "Severity mapping: out_of_order info->warning->error, drift warning->error, compaction info, evidence warning->error, ignored error"
  - "Acknowledgment downgrades escalation and full reset requires prerequisite completion"
  - "Language routing localizes guidance text while preserving canonical English tool names"

duration: 4 min
completed: 2026-02-12
---

# Phase 2 Plan 1: Governance Signal Model Summary

**Shared governance severity/seriousness primitives and turn-0 lifecycle guidance now run consistently across strict, assisted, and permissive modes.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-12T11:31:31Z
- **Completed:** 2026-02-12T11:36:29Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added locked severity mapping and seriousness scoring primitives in `src/lib/detection.ts` for out-of-order, drift, compaction, evidence-pressure, and ignored tiers.
- Extended brain metrics with `governance_counters` in `src/schemas/brain-state.ts` to support repetition escalation, acknowledgment downgrade, and prerequisite-gated resets.
- Refactored `src/hooks/session-lifecycle.ts` to inject bootstrap/evidence/team blocks from turn 0 in all modes and preserve permissive navigation without warning-pressure noise.
- Added regression coverage in `tests/detection.test.ts` and `tests/integration.test.ts` for severity math, reset semantics, permissive suppression, and localized tool-name routing.

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement locked severity mapping and seriousness scoring primitives** - `74016b9` (feat)
2. **Task 2: Rework turn-0 lifecycle injection and permissive navigation behavior** - `fc1241d` (feat)

**Plan metadata:** pending (created in final docs commit)

## Files Created/Modified

- `src/lib/detection.ts` - governance severity mapping, seriousness scoring, and reset/counter primitives.
- `src/schemas/brain-state.ts` - adds `governance_counters` to persisted metrics state.
- `src/hooks/session-lifecycle.ts` - turn-window bootstrap/evidence/team injection, localized routing, and permissive warning suppression.
- `tests/detection.test.ts` - adds assertions for locked severity decisions, seriousness scoring, and prerequisite-gated resets.
- `tests/integration.test.ts` - adds turn-0 all-mode behavior tests, permissive suppression checks, and localization/tool-name assertions.

## Decisions Made

- Locked severity and seriousness policy in `src/lib/detection.ts` so prompt, toast, and future governance adapters can reuse one deterministic compiler.
- Switched bootstrap gating from lock status to early turn window (`turn_count <= 2`) to satisfy GOV-01/GOV-02 in all governance modes.
- Treated permissive mode as silent-tracking for pressure alerts while preserving operational navigation context and informational compaction guidance.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Existing integration assertion assumed bootstrap disappears when session is OPEN; this was updated to align with GOV-01 turn-window behavior.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Shared severity/seriousness contracts are now centralized for reuse by Phase 02 follow-up plans.
- Turn-0 guidance and permissive boundaries are covered by integration tests and ready for toast/event routing expansion.

---
*Phase: 02-auto-hooks-governance-mesh*
*Completed: 2026-02-12*

## Self-Check: PASSED

- FOUND: `.planning/phases/02-auto-hooks-governance-mesh/02-01-SUMMARY.md`
- FOUND: `src/lib/detection.ts`
- FOUND: `src/hooks/session-lifecycle.ts`
- FOUND commit: `74016b9`
- FOUND commit: `fc1241d`
