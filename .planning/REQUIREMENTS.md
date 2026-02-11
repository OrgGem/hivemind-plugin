# Requirements: HiveMind v3 — Framework-Aware Context Governance

**Defined:** 2026-02-12
**Core Value:** Agents governed from turn 0 in every mode — evidence-based, framework-aware, self-validating

## v1 Requirements

Requirements for HiveMind v3 initial release. Each maps to roadmap phases.

### Governance Fixes (from Stress Test FAIL/CONDITIONAL PASS)

- [ ] **GOV-01**: Bootstrap block fires in ALL governance modes (strict, assisted, permissive), not just strict
- [ ] **GOV-02**: Evidence discipline teaching injected into system prompt from session start, regardless of mode or config
- [ ] **GOV-03**: Team behavior teaching injected into system prompt (verify subagent results, export_cycle after every Task return)
- [ ] **GOV-04**: Permissive mode suppresses detection signal warnings in system prompt to match "silent tracking" documentation
- [ ] **GOV-05**: Default config teaches evidence principles unconditionally (not gated by `be_skeptical` flag)
- [ ] **GOV-06**: Bootstrap condition uses `turn_count <= 2` regardless of governance_status (LOCKED/OPEN), enabling all modes

### Framework Integration

- [ ] **FRM-01**: Framework detector identifies GSD (`.planning/`, `config.json`, `ROADMAP.md`) and injects framework-specific governance context
- [ ] **FRM-02**: Framework detector identifies Spec-kit (`.spec-kit/`, `spec-kit.config.json`) and injects framework-specific governance context
- [ ] **FRM-03**: When GSD detected, HiveMind reads `STATE.md` and `ROADMAP.md` to align hierarchy with current phase/plan
- [ ] **FRM-04**: When framework orchestrator spawns subagents, HiveMind auto-injects governance context into each subagent's prompt
- [ ] **FRM-05**: Framework-aware drift detection: if GSD phase goal exists, drift measured against phase goal, not just hierarchy
- [ ] **FRM-06**: Framework integration is additive — zero breaking changes to non-framework HiveMind usage

### Fast Extraction Tools

- [ ] **EXT-01**: `hivemind extract` CLI command packs codebase into single AI-friendly file (XML format, Repomix-compatible)
- [ ] **EXT-02**: Extract supports `--compress` flag using Tree-sitter to extract signatures/interfaces without implementation bodies
- [ ] **EXT-03**: Extract supports `--include`/`--ignore` glob patterns for targeted extraction
- [ ] **EXT-04**: Extract supports `--split <size>` for chunking large codebases
- [ ] **EXT-05**: `hivemind grep <pattern>` fast content search with context lines and file filtering
- [ ] **EXT-06**: `hivemind glob <pattern>` fast file pattern matching sorted by modification time
- [ ] **EXT-07**: `hivemind read <file> [--offset N] [--limit N]` fast file reading with offset/limit support
- [ ] **EXT-08**: All extraction tools output structured JSON when `--json` flag is used
- [ ] **EXT-09**: Token count estimation for extracted content (`--token-count` flag)

### Orchestration Control (Ralph Loop Pattern)

- [ ] **ORC-01**: `hivemind loop init <prd.json>` loads user stories from prd.json and initializes loop state
- [ ] **ORC-02**: `hivemind loop next` selects highest-priority story with `passes: false` and no blocking dependencies
- [ ] **ORC-03**: `hivemind loop complete <story-id>` marks story as passed, records completion, selects next
- [ ] **ORC-04**: `hivemind loop fail <story-id> <reason>` records failure, increments failed_attempts counter
- [ ] **ORC-05**: `hivemind loop status` shows loop progress (completed/total, current story, blocked stories)
- [ ] **ORC-06**: Loop state persists in `.hivemind/loop-state.json` surviving compactions and session restarts
- [ ] **ORC-07**: Quality gate integration: acceptance criteria from prd.json are checked against test/build output
- [ ] **ORC-08**: Loop detects completion (all stories pass) and signals `<promise>COMPLETE</promise>`

### Self-Validation & Drift Awareness

- [ ] **VAL-01**: When user ignores warnings for 5+ consecutive turns, system prompt changes tone from suggestion to explicit "You are ignoring governance warnings — acknowledge or dismiss"
- [ ] **VAL-02**: Escalation levels have visible markers that persist across compactions: `[INFO]`, `[WARN]`, `[CRITICAL]`, `[DEGRADED]`, `[IGNORED]`
- [ ] **VAL-03**: New `[IGNORED]` tier added when agent has been warned 10+ times without acknowledgment
- [ ] **VAL-04**: `hivemind self-check` CLI command runs all validation checks and reports health with actionable fixes
- [ ] **VAL-05**: Detection engine tracks consecutive ignored warnings in brain.json metrics
- [ ] **VAL-06**: Argument-back system generates context-specific pushback (not just static strings) using hierarchy + metrics data

### Stress Test Infrastructure

- [ ] **STR-01**: Automated stress test suite that validates all 13 stress test conditions programmatically
- [ ] **STR-02**: Stress test for 10+ sequential compactions verifying state preservation
- [ ] **STR-03**: Stress test for framework detection across greenfield, brownfield, various project types
- [ ] **STR-04**: Stress test for loop orchestration (concurrent stories, dependency chains, failure recovery)
- [ ] **STR-05**: `npm run stress-test` command runs full stress test suite

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Advanced Extraction

- **EXT-10**: MCP server mode for extract tools (`hivemind --mcp`)
- **EXT-11**: Remote repository extraction (`hivemind extract --remote user/repo`)
- **EXT-12**: Git diff-aware extraction (only changed files since base branch)

### Advanced Orchestration

- **ORC-09**: Beads integration (`.beads/beads.jsonl` format alongside prd.json)
- **ORC-10**: Multi-loop coordination (multiple prd.json files running in parallel)
- **ORC-11**: Loop metrics dashboard in Ink TUI

### Framework Extensions

- **FRM-07**: BMAD framework detection and integration
- **FRM-08**: Open-spec framework detection and integration
- **FRM-09**: Framework-specific skill auto-loading (GSD skills, Spec-kit skills)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Replace GSD orchestration | HiveMind is governance layer, not orchestrator. GSD/Spec-kit run their own workflows |
| Full Repomix reimplementation | Wrap/integrate Repomix, don't rebuild it. Use `npx repomix` under the hood |
| Agent spawning/management | HiveMind tracks and governs agents, doesn't spawn them. Frameworks spawn their own agents |
| GUI/web dashboard | CLI + Ink TUI is sufficient for v3. Web dashboard is v4+ territory |
| OpenCode plugin blocking | OpenCode v1.1+ cannot block tool execution. Don't fight the platform limitation |
| Custom LLM model support | HiveMind is model-agnostic by design. No model-specific code |

## Traceability

**Roadmap:** [ROADMAP.md](./ROADMAP.md)
**State:** [STATE.md](./STATE.md)

| Requirement | Phase | Phase Name | Depends On | Status |
|-------------|-------|------------|------------|--------|
| GOV-01 | 1 | Governance Foundation Fix | — | Pending |
| GOV-02 | 1 | Governance Foundation Fix | — | Pending |
| GOV-03 | 1 | Governance Foundation Fix | — | Pending |
| GOV-04 | 1 | Governance Foundation Fix | — | Pending |
| GOV-05 | 1 | Governance Foundation Fix | — | Pending |
| GOV-06 | 1 | Governance Foundation Fix | — | Pending |
| FRM-01 | 2 | Framework Detection & Integration | Phase 1 | Pending |
| FRM-02 | 2 | Framework Detection & Integration | Phase 1 | Pending |
| FRM-03 | 2 | Framework Detection & Integration | Phase 1 | Pending |
| FRM-04 | 2 | Framework Detection & Integration | Phase 1 | Pending |
| FRM-05 | 2 | Framework Detection & Integration | Phase 1 | Pending |
| FRM-06 | 2 | Framework Detection & Integration | Phase 1 | Pending |
| EXT-01 | 3 | Fast Extraction Tools | Phase 2 | Pending |
| EXT-02 | 3 | Fast Extraction Tools | Phase 2 | Pending |
| EXT-03 | 3 | Fast Extraction Tools | Phase 2 | Pending |
| EXT-04 | 3 | Fast Extraction Tools | Phase 2 | Pending |
| EXT-05 | 3 | Fast Extraction Tools | Phase 2 | Pending |
| EXT-06 | 3 | Fast Extraction Tools | Phase 2 | Pending |
| EXT-07 | 3 | Fast Extraction Tools | Phase 2 | Pending |
| EXT-08 | 3 | Fast Extraction Tools | Phase 2 | Pending |
| EXT-09 | 3 | Fast Extraction Tools | Phase 2 | Pending |
| ORC-01 | 4 | Orchestration Control | Phase 3 | Pending |
| ORC-02 | 4 | Orchestration Control | Phase 3 | Pending |
| ORC-03 | 4 | Orchestration Control | Phase 3 | Pending |
| ORC-04 | 4 | Orchestration Control | Phase 3 | Pending |
| ORC-05 | 4 | Orchestration Control | Phase 3 | Pending |
| ORC-06 | 4 | Orchestration Control | Phase 3 | Pending |
| ORC-07 | 4 | Orchestration Control | Phase 3 | Pending |
| ORC-08 | 4 | Orchestration Control | Phase 3 | Pending |
| VAL-01 | 5 | Self-Validation & Drift Awareness | Phase 4 | Pending |
| VAL-02 | 5 | Self-Validation & Drift Awareness | Phase 4 | Pending |
| VAL-03 | 5 | Self-Validation & Drift Awareness | Phase 4 | Pending |
| VAL-04 | 5 | Self-Validation & Drift Awareness | Phase 4 | Pending |
| VAL-05 | 5 | Self-Validation & Drift Awareness | Phase 4 | Pending |
| VAL-06 | 5 | Self-Validation & Drift Awareness | Phase 4 | Pending |
| STR-01 | 6 | Stress Test Infrastructure | Phase 5 | Pending |
| STR-02 | 6 | Stress Test Infrastructure | Phase 5 | Pending |
| STR-03 | 6 | Stress Test Infrastructure | Phase 5 | Pending |
| STR-04 | 6 | Stress Test Infrastructure | Phase 5 | Pending |
| STR-05 | 6 | Stress Test Infrastructure | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 40 total
- Mapped to phases: 40
- Unmapped: 0 ✓

**Phase distribution:**
- Phase 1: 6 requirements (GOV)
- Phase 2: 6 requirements (FRM)
- Phase 3: 9 requirements (EXT)
- Phase 4: 8 requirements (ORC)
- Phase 5: 6 requirements (VAL)
- Phase 6: 5 requirements (STR)

---
*Requirements defined: 2026-02-12*
*Last updated: 2026-02-12 — traceability linked to ROADMAP.md*
