---
phase: 01-sdk-foundation-system-core
plan: 01
subsystem: foundation
tags: [sdk, opencode-plugin, singleton, typescript]
requires: []
provides:
  - "Module-level SDK context singleton"
  - "Safe client access via getClient()"
  - "Full PluginInput wiring in index.ts"
affects: [01-02-PLAN, 02-*, 03-*, 04-*, 05-*, 06-*]
tech-stack:
  added: []
  patterns: ["Module-level singleton for SDK context"]
key-files:
  created: [src/hooks/sdk-context.ts]
  modified: [src/index.ts, src/hooks/index.ts]
key-decisions:
  - "Used module-level singleton pattern for SDK context to avoid circular dependencies and deadlock risks"
  - "Extracted BunShell type from PluginInput['$'] to avoid importing from dist"
patterns-established:
  - "Hooks access client via getClient() at execution time, not import time"
  - "No client.* calls during plugin initialization"
duration: 3min
completed: 2026-02-12
---

# Phase 01 Plan 01: SDK Context Singleton Summary

**Module-level SDK singleton providing safe client access and full PluginInput wiring**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-12T00:39:40Z
- **Completed:** 2026-02-12T00:42:29Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created `src/hooks/sdk-context.ts` module singleton
- Wired full `PluginInput` (client, shell, serverUrl, project) in plugin entry
- Verified zero SDK imports in `src/lib/` (maintained architecture boundary)
- Added `withClient()` helper for safe SDK calls with graceful fallback

## Task Commits

1. **Task 1: Create SDK Context Module Singleton** - `5e50c77` (feat)
2. **Task 2: Wire Full PluginInput in Plugin Entry + Update Barrel Export** - `4ccb6a1` (feat)

## Files Created/Modified
- `src/hooks/sdk-context.ts` - Module-level singleton storing SDK refs
- `src/index.ts` - Updated plugin entry to initialize SDK context
- `src/hooks/index.ts` - Exports SDK context getters

## Decisions Made
- Used `Pick<PluginInput, ...>` for `initSdkContext` to minimize dependency surface area
- Extracted `BunShell` type from `PluginInput["$"]` to avoid importing from `dist` internals
- Skipped logging inside `initSdkContext` to avoid potential side effects, relying on `index.ts` for logging

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SDK context available for all hooks and tools
- Ready for Event Hook wiring (Plan 02)
