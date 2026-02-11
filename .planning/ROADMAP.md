# Roadmap: HiveMind v3

**Created:** 2026-02-12
**Phases:** 6
**Requirements:** 40

## Progress

| # | Phase | Status | Plans | Progress |
|---|-------|--------|-------|----------|
| 1 | Governance Foundation Fix | ○ | 0/0 | 0% |
| 2 | Framework Detection & Integration | ○ | 0/0 | 0% |
| 3 | Fast Extraction Tools | ○ | 0/0 | 0% |
| 4 | Orchestration Control | ○ | 0/0 | 0% |
| 5 | Self-Validation & Drift Awareness | ○ | 0/0 | 0% |
| 6 | Stress Test Infrastructure | ○ | 0/0 | 0% |

---

## Phase 1: Governance Foundation Fix

**Goal:** All 13 stress test conditions pass — bootstrap fires in every mode, evidence/team teaching from turn 0
**Requirements:** GOV-01, GOV-02, GOV-03, GOV-04, GOV-05, GOV-06
**Status:** Not started

### Success Criteria

1. Agent in **assisted** mode receives evidence discipline and team behavior teaching in system prompt on turn 1 (not just strict mode)
2. Agent in **permissive** mode receives bootstrap context but zero detection warning signals in system prompt output
3. Default config teaches evidence principles unconditionally — removing `be_skeptical` flag does not disable teaching
4. All 13 stress test conditions from STRESS-TEST-1.MD evaluate to PASS (zero CONDITIONAL PASS, zero FAIL)

### Depends On

- Nothing (first phase)

---

## Phase 2: Framework Detection & Integration

**Goal:** HiveMind auto-detects GSD and Spec-kit projects, reads their state, and adapts governance accordingly
**Requirements:** FRM-01, FRM-02, FRM-03, FRM-04, FRM-05, FRM-06
**Status:** Not started

### Success Criteria

1. Running `hivemind status` in a project with `.planning/ROADMAP.md` + `config.json` shows `Framework: GSD` and current phase/plan
2. Running `hivemind status` in a project with `.spec-kit/` directory shows `Framework: Spec-kit`
3. Drift detection warns when agent work diverges from the GSD phase goal, not just the HiveMind hierarchy
4. Non-framework projects see zero behavioral change — framework integration is purely additive
5. Subagents spawned during framework orchestration receive governance context injection automatically

### Depends On

- Phase 1 (governance must be solid before adding framework awareness)

---

## Phase 3: Fast Extraction Tools

**Goal:** One-command codebase extraction for AI consumption — pack, search, read, with structured output
**Requirements:** EXT-01, EXT-02, EXT-03, EXT-04, EXT-05, EXT-06, EXT-07, EXT-08, EXT-09
**Status:** Not started

### Success Criteria

1. `hivemind extract` produces an XML file (Repomix-compatible) consumable by AI agents with accurate file contents
2. `hivemind extract --compress` produces signature-only output via Tree-sitter, reducing token count by 50%+
3. `hivemind grep "pattern"` and `hivemind glob "pattern"` return results in under 500ms for typical project sizes
4. All extraction commands (`extract`, `grep`, `glob`, `read`) support `--json` flag producing structured JSON output
5. `hivemind extract --token-count` reports estimated token count for the packed output

### Depends On

- Phase 2 (framework detection informs what extraction tools need to include/exclude)

---

## Phase 4: Orchestration Control

**Goal:** Agent can orchestrate multi-story work autonomously using Ralph loop pattern with persistence and quality gates
**Requirements:** ORC-01, ORC-02, ORC-03, ORC-04, ORC-05, ORC-06, ORC-07, ORC-08
**Status:** Not started

### Success Criteria

1. `hivemind loop init prd.json && hivemind loop next` loads stories and selects first actionable story respecting dependency order
2. Loop state survives `compact_session` — after compaction, `hivemind loop status` shows same progress and current story
3. `hivemind loop status` displays completion ratio, current story, blocked stories, and failed attempt counts
4. When all stories pass, agent receives `<promise>COMPLETE</promise>` signal and loop terminates cleanly
5. Quality gate checks acceptance criteria from prd.json against test/build output before marking story complete

### Depends On

- Phase 3 (extraction tools support orchestration — loop needs to read codebase for context)

---

## Phase 5: Self-Validation & Drift Awareness

**Goal:** System actively pushes back when governance is ignored — escalating, context-aware, with CLI self-diagnosis
**Requirements:** VAL-01, VAL-02, VAL-03, VAL-04, VAL-05, VAL-06
**Status:** Not started

### Success Criteria

1. After 5 consecutive ignored warnings, system prompt tone visibly escalates from suggestion to direct confrontation
2. `[IGNORED]` tier appears in system prompt after 10+ unacknowledged warnings, persisting across compactions
3. `hivemind self-check` outputs actionable health report with specific fix instructions for each issue found
4. Argument-back messages reference current hierarchy state and session metrics dynamically (not static strings)

### Depends On

- Phase 4 (orchestration patterns reveal what self-validation needs to detect — loop stalls, story failures, etc.)

---

## Phase 6: Stress Test Infrastructure

**Goal:** `npm run stress-test` validates all conditions — governance, framework detection, orchestration, compaction survival
**Requirements:** STR-01, STR-02, STR-03, STR-04, STR-05
**Status:** Not started

### Success Criteria

1. `npm run stress-test` executes full suite and reports pass/fail for every stress test condition in a single run
2. 10+ sequential compaction test verifies hierarchy, brain state, and loop state preservation across all compactions
3. Framework detection stress test covers greenfield, brownfield, GSD-only, Spec-kit-only, and multi-framework projects
4. Loop orchestration stress test validates concurrent stories, dependency chains, failure recovery, and completion signal

### Depends On

- Phase 5 (all features must exist before stress testing them)

---

## Phase Ordering Rationale

```
Phase 1 → Phase 2:  Governance must be solid before adding framework awareness
Phase 2 → Phase 3:  Framework detection informs what extraction tools need
Phase 3 → Phase 4:  Extraction tools support orchestration (loop needs to read codebase)
Phase 4 → Phase 5:  Orchestration patterns reveal what self-validation needs to detect
Phase 5 → Phase 6:  All features must exist before stress testing them
```

---
*Roadmap created: 2026-02-12*
*Last updated: 2026-02-12*
