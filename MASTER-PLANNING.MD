# HiveMind v3 — Comprehensive Master Plan

Transform the raw timeline brainstorm into a fully-capped, corporate-level phased plan with complete requirements, acceptance criteria, and architectural traceability across all 8 phases — from bug triage through cognitive mesh delivery.

---

## Executive Summary

**Product:** HiveMind Context Governance — an OpenCode plugin that creates a cognitive mesh for AI agents, preventing context drift, managing state across sessions, and boosting agent intelligence through 5 interconnected systems.

**Current State (as of 2026-02-13):**
- v2.6.0 on branch `dev/iteration-6-tui-cleanup`
- 705+ test assertions, 43 source files, 14 tools, 5 hooks, 5 skills
- Phase 01 (SDK Foundation): **COMPLETE** — sdk-context singleton, event handler, boundary enforcement
- Phase 02 (Auto-Hooks & Governance): **COMPLETE** — GOV-01..08 all satisfied, 13-condition stress suite
- Phase 03 (Structure Reorg): **PARTIAL** — paths.ts + manifest.ts done (2/9 tasks), remaining 7 tasks pending
- Phase 03-patch (Untie the Knot): **PLANNED** — first-turn context pull, manifest dedup, persistence observability
- **11 known bugs** across Tiers 1-5 from comprehensive audit
- **10 UAT tests** from Phase 02 pending live verification

**Vision:** 5-system cognitive mesh where removing any system degrades ALL others. SDK is materialization layer; concepts are platform-portable.

**Architecture Invariants:**
- `src/lib/` NEVER imports SDK — enforced by `npm run lint:boundary`
- NEVER block/deny tool execution — soft governance only
- Filesystem for persistence, SDK for intelligence
- Every feature touches 2+ systems (no single-system features)
- Client stored in hooks, never called during init (deadlock prevention)

---

## Phase Map (8 Phases)

| # | Phase | Focus | Depends On | Est. Complexity |
|---|-------|-------|------------|-----------------|
| **P3** | Stabilize & Structure | Bug triage + .hivemind reorg completion | P1, P2 | HIGH |
| **P4** | Session Lifecycle & Auto-Export | Sessions as first-class SDK objects | P3 | MEDIUM |
| **P5** | TODO/Task Governance | Atomic sub-task control + delegation | P3 | HIGH |
| **P6** | Agent Tools & Extraction | SDK-powered codebase intelligence | P4 | MEDIUM |
| **P7** | Mems Brain & Cross-Session Memory | Persistent intelligence + orchestration | P5, P6 | HIGH |
| **P8** | Packing Automation & Smart Governance | Commands + Skills + Hooks integration | P5, P6 | HIGH |
| **P9** | First-Run Experience & README | Install, init, onboarding, documentation | P3 | MEDIUM |
| **P10** | Stress Test & Integration Validation | Full mesh validation, CI, publish | ALL | HIGH |

**Completed (reference only):**

| # | Phase | Status |
|---|-------|--------|
| P1 | SDK Foundation + System Core | ✅ COMPLETE |
| P2 | Auto-Hooks & Governance Mesh | ✅ COMPLETE (UAT pending) |

---

## Phase 3: Stabilize & Structure

**Goal:** Fix all critical/high bugs, complete .hivemind reorganization, and deliver a traversable, manifest-driven, YAML-frontmatted data layer.

**Systems:** System Core + Session Management

**Rationale:** Nothing downstream (context pull, TODO control, hooks automation) can function until the data layer is organized, bugs are triaged, and the agent never starts a session blind.

### Requirements

#### P3-BUG — Critical & High Bug Triage

| ID | Requirement | Tier | Acceptance Criteria |
|----|-------------|------|---------------------|
| **P3-BUG-01** | `export_cycle` syncs `brain.hierarchy` after tree modification | T1-CRITICAL | AC: After `export_cycle` modifies hierarchy tree, `brain.json` and `hierarchy.json` are in sync. Regression test proves desync is impossible. |
| **P3-BUG-02** | `declare_intent` preserves per-session template format | T1-CRITICAL | AC: `appendToSessionLog()` receives correctly-formatted session template. No legacy format overwrites. Test round-trips declare→append→read. |
| **P3-BUG-03** | Auto-archive resets `hierarchy.json` on new session | T2-HIGH | AC: After stale auto-archive, `hierarchy.json` is reset to empty root. No orphaned tree persists into new session. |
| **P3-BUG-04** | `trackSectionUpdate()` is wired and called | T2-HIGH | AC: Section repetition detection is active (not dead code). Tool calls that update sections trigger tracking. Test verifies call count > 0. |
| **P3-BUG-05** | `write_without_read_count` in persistence migration | T3-MEDIUM | AC: Upgrading from v2.5→v2.6 brain.json includes `write_without_read_count` field. Migration test proves no crash on missing field. |
| **P3-BUG-06** | `next_compaction_report` cleared after consumption | T3-MEDIUM | AC: After compaction hook consumes report, field is set to `null`. Next turn does not see stale report. |
| **P3-BUG-07** | Drift score calculated AFTER turn increment | T3-MEDIUM | AC: Drift score reflects current turn, not previous turn. Unit test with sequential turns verifies monotonic accuracy. |
| **P3-BUG-08** | Drift score persisted after mutation | T3-MEDIUM | AC: In-memory drift score mutation is followed by `stateManager.save()`. No lost state between turns. |

#### P3-REORG — .hivemind Reorganization (Tasks 3-9 from 03-01-PLAN)

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| **P3-REORG-01** | All path references use `paths.ts` | AC: `grep -rn 'join.*\.hivemind' src/ | grep -v paths.ts` returns ZERO results. Every `.hivemind` path resolves through `getHivemindPaths()`. |
| **P3-REORG-02** | Auto-migration from legacy structure | AC: Old flat `.hivemind/brain.json` auto-migrates to `.hivemind/state/brain.json` on first plugin load. Rollback on failure. Migration test with old→new→verify. |
| **P3-REORG-03** | Migration wired into init + plugin boot | AC: `hivemind init` creates new hierarchical structure. Plugin boot calls `migrateIfNeeded()`. Guard: runs once per session. |
| **P3-REORG-04** | YAML frontmatter on all session files | AC: Every session `.md` has frontmatter with: id, stamp, type, mode, governance, trajectory, tactic, status, created, last_activity, turns, drift, linked_plans. `declare_intent`, `map_context`, `compact_session` all maintain frontmatter. |
| **P3-REORG-05** | INDEX.md as traversable entry point | AC: `.hivemind/INDEX.md` under 30 lines. Contains current state recap, quick navigation links, anchors inline. Regenerated on every `declare_intent` and `compact_session`. |
| **P3-REORG-06** | All test path references migrated | AC: All 58+ hardcoded paths in tests use `getHivemindPaths()`. `npm test` passes with 0 regressions. |
| **P3-REORG-07** | Git cleanup + atomic commit | AC: Self-reference dep removed from `package.json`. Noise files gitignored. `git status` clean after commit. |

#### P3-CTX — First-Turn Context Pull (from 03-patch plan)

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| **P3-CTX-01** | First turn ALWAYS pulls brain + hierarchy + anchors + mems | AC: Turn 0-1 in ALL governance modes includes: anchors summary (≤300 chars), mems count + last 2 summaries (≤200 chars), prior session trajectory (≤200 chars). Agent never starts blind. |
| **P3-CTX-02** | Manifest deduplication in `registerSession` | AC: Calling `registerSession` with duplicate stamp updates existing entry, never creates duplicate. `deduplicateManifest()` repairs corrupt manifests. |
| **P3-CTX-03** | `persistence.ts` logs errors by category | AC: JSON parse errors → logged + return null. ENOENT → silent null (expected). EPERM/EIO → logged + return null. No silent swallowing. |
| **P3-CTX-04** | Compaction + first-turn flows coordinated | AC: Post-compaction turn injects purification report + standard context (not duplicate). First-turn compiler defers to compaction hook when `compaction_count > 0 && turn_count <= 1`. |
| **P3-CTX-05** | Delegation flows remain transparent | AC: `export_cycle`, `task`, `todowrite`, `todoread` in tool-gate exempt list. `task`/`todowrite` classified as "query" in soft-governance. All delegation tools work unchanged. |

### Phase 3 Exit Criteria

- All 8 bugs fixed with regression tests
- `.hivemind/` in new hierarchical structure with manifests at every level
- `npm test` ≥ 800 assertions, 0 failures
- `npm run build && npm run typecheck && npm run lint:boundary` all pass
- First turn of any session shows prior context (never blank)
- Live `.hivemind/` auto-migrated from legacy structure

---

## Phase 4: Session Lifecycle & Auto-Export

**Goal:** Sessions become first-class SDK objects with real lifecycle, auto-export, and intelligent compaction.

**Systems:** Session Management + System Core + Auto-Hooks

**Rationale:** The timeline identifies sessions as "on-going plans" — not just text files. With SDK `client.session.*` wired in Phase 1, sessions can now have real IDs, messages, and lifecycle events.

### Requirements

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| **P4-SES-01** | Session lifecycle via `client.session.*` | AC: `declare_intent` creates session via `client.session.create()`. Session ID from SDK stored in brain state. `client.session.get()` returns real session data. Falls back to file-only mode if SDK unavailable. |
| **P4-SES-02** | Auto-export via `client.session.messages()` | AC: `compact_session` exports full message history to `.hivemind/sessions/archive/exports/`. JSON export includes all messages with roles, timestamps, tool calls. MD export includes human-readable summary. |
| **P4-SES-03** | Long session handling via `client.session.summarize()` | AC: Sessions exceeding configurable threshold (default: 50 turns) trigger intelligent summarization. Summary injected into compaction context. Falls back to raw truncation if SDK unavailable. |
| **P4-SES-04** | Session structure with real metadata | AC: Each session record includes: real SDK session ID, start time, duration, message count, tool call count, files touched count, drift score at close. All from SDK, not approximated. |
| **P4-SES-05** | `session.compacted` event triggers integrity check | AC: On `session.compacted` event, auto-verify: hierarchy.json valid, brain.json consistent, mems.json readable, active session file exists. Log any inconsistencies. |
| **P4-SES-06** | Silent context injection via `session.prompt({ noReply: true })` | AC: Governance context injected via `client.session.prompt()` without triggering AI response. Used for mid-session context updates. Falls back to system.transform if SDK unavailable. |
| **P4-SES-07** | Session-to-plan many-to-many linking | AC: A session can link to multiple plans. A plan can span multiple sessions. Links are bidirectional via manifests. `linkSessionToPlan()` creates both sides. |
| **P4-SES-08** | Post-3+ compaction aggressive mode | AC: After `compaction_count >= 3`, context injection switches to manifest-only traversal mode. Budget compressed to ≤1000 chars. Priority: current task, pending sub-tasks, plan links only. |
| **P4-SES-09** | Human-readable archive naming | AC: Archived sessions named `{YYYY-MM-DD}-{mode}-{trajectory-slug}.md`. No more opaque timestamp-only names. |
| **P4-SES-10** | Forced metadata commit on session transitions | AC: Every session close (compact, archive, abandon) triggers atomic git commit of `.hivemind/` state files. Commit message includes session stamp, duration, and summary. Uses BunShell `$`. |

### Phase 4 Exit Criteria

- All 10 requirements verified with automated tests
- Sessions work with AND without SDK client (graceful degradation)
- Auto-export produces valid JSON + MD for every session
- 3+ compaction test verifies aggressive mode activates
- `npm test` ≥ 850 assertions

---

## Phase 5: TODO/Task Governance

**Goal:** Atomic sub-task control with delegation enforcement, cross-session continuity, and node-level management. This is the "winning factor" — 100% hit rate on the smallest unit.

**Systems:** System Core + Session Management + Mems Brain

**Rationale:** The timeline identifies sub-tasks as "brain cells" — the smallest unit that must be managed with 100% precision. Tasks build from sub-tasks, connect to plans and sessions, and survive across compactions.

### Requirements

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| **P5-TSK-01** | `tasks.json` actively written by tool hooks | AC: Every tool execution writes a `SubTaskManifestEntry` to `tasks.json` with: id, stamp, status, description, agent, tools_used, files_touched, linked_artifacts, started_at, completed_at. |
| **P5-TSK-02** | Main + sub-task hierarchy | AC: Tasks split into main tasks (≤20 active) and sub-tasks (unlimited per main). Main tasks link to plans. Sub-tasks link to parent tasks. Status propagation: all sub-tasks complete → main task completable. |
| **P5-TSK-03** | Delegation enforcement for sub-tasks | AC: When a sub-task is delegated to a sub-agent, the sub-agent receives: task description, acceptance criteria, linked artifacts. On completion, sub-agent outputs structured last-message and forces atomic commit. |
| **P5-TSK-04** | Cross-session task continuity | AC: Tasks survive compaction. Tasks reload from `tasks.json` on session resume. Exported JSON captures task state for cross-session handoff. `hivemind loop status` shows consistent progress across sessions. |
| **P5-TSK-05** | Forced re-read chain on task tick | AC: When a sub-task is ticked complete, the system re-reads: related plan section, parent task state, sibling sub-task states, and updates the following tasks based on conditional changes. |
| **P5-TSK-06** | Task-to-anchor-to-declaration linking | AC: Each task must match with an anchor declaration. The last task in a chain matches the ultimate end goal. Schema connects: task → anchor → declaration → hierarchy node. |
| **P5-TSK-07** | Enforced batch completion | AC: A batch of sub-tasks forms a task. Batch cannot be marked complete until all sub-tasks report done. Enforcement via manifest validation, not AI trust. |
| **P5-TSK-08** | TODO injection into system prompt | AC: Active tasks (main + sub) injected into system prompt with: description, status, priority, linked plan. Budget: ≤500 chars for task summary. Compaction-safe. |
| **P5-TSK-09** | Complexity-driven task skeleton | AC: Simple tasks → main only. Medium → main + sub-tasks. Complex → main + sub + reload from exported JSON. Continual → load from prior session's exported state. |
| **P5-TSK-10** | Atomic commit on every file-changing sub-task | AC: Any sub-task that causes file changes (code or artifact) triggers forced git commit. Commit message: brief, hierarchical, timestamped. Uses BunShell `$`. |

### Phase 5 Exit Criteria

- `tasks.json` actively populated by tool hooks
- Main/sub-task hierarchy with delegation and batch enforcement
- Cross-session reload verified (export→new session→reload→consistent)
- Task injection in system prompt (all governance modes)
- `npm test` ≥ 900 assertions

---

## Phase 6: Agent Tools & Extraction

**Goal:** Fast, structured codebase access via SDK file/find APIs + BunShell subprocess tools. Cognitive prosthetics, not CLI wrappers.

**Systems:** Unique Agent Tools + System Core + Mems Brain

**Rationale:** The timeline demands tools that "make agents smarter, not just obedient." Every tool must touch 2+ systems — read hierarchy, use detection signals, persist to mems.

### Requirements

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| **P6-TUL-01** | Fast Read via `client.file.read()` + `client.file.status()` | AC: Structured file access with offset/limit. Git status awareness (modified, staged, untracked). Falls back to `fs` if SDK unavailable. |
| **P6-TUL-02** | Fast Search via `client.find.text()`, `client.find.files()`, `client.find.symbols()` | AC: ripgrep, fd, and LSP symbol search accessible to tools. Context lines support. JSON output mode. Falls back to BunShell `$` if SDK search unavailable. |
| **P6-TUL-03** | Codebase extraction via BunShell `$`: `npx repomix` | AC: `$\`npx repomix --output - --compress\`` wraps repomix with `--token-count` support. Token budget configurable. Output consumable by other tools. |
| **P6-TUL-04** | All extraction tools support `--json` flag | AC: Every tool command has `--json` mode producing structured output. Machine-parseable by scripts and other tools. |
| **P6-TUL-05** | Hierarchy reading enriched with session context | AC: `scan_hierarchy` includes: active session mode, current plan phase, recent tool calls from `client.session.get()`. Falls back to brain.json if SDK unavailable. |
| **P6-TUL-06** | Thinking frameworks injected by complexity level | AC: Low complexity → no framework. Medium → single reasoning model. High → chain-of-thought with hierarchy traversal. Complexity detected from intent declaration + codebase scope. |
| **P6-TUL-07** | Multi-system integration for all tools | AC: Every tool action updates hierarchy (System Core), optionally saves to mems (Mems Brain), and triggers detection signals (Auto-Hooks). No single-system tools. |

### Phase 6 Exit Criteria

- All 7 tool requirements with SDK + fallback modes verified
- `--json` output on all commands
- Multi-system chaining: tool→hierarchy→mems→detection verified
- `npm test` ≥ 950 assertions

---

## Phase 7: Mems Brain & Cross-Session Memory

**Goal:** Persistent cross-session intelligence with orchestration state (Ralph loop), semantic recall, and atomic git persistence.

**Systems:** Mems Brain + System Core + Session Management

**Rationale:** The timeline identifies mems as "long-term memory" — findings persist across sessions, compactions, and platform switches. The Ralph loop pattern adds orchestration intelligence.

### Requirements

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| **P7-MEM-01** | Shared brain via atomic git commits | AC: `save_mem` triggers atomic git commit of mems.json. Any session can read mems via git checkout. Commit message includes mem shelf, timestamp, session ID. |
| **P7-MEM-02** | Orchestration state (Ralph loop pattern) | AC: `hivemind loop init prd.json` loads stories. `hivemind loop next` selects first actionable story. Loop state persists in `.hivemind/loop-state.json`. Survives 5+ compactions. |
| **P7-MEM-03** | Just-in-time memory recall | AC: `recall_mems` uses `client.find.text()` for semantic relevance matching. Returns ranked results by relevance score. Falls back to keyword matching if SDK unavailable. |
| **P7-MEM-04** | Loop state cross-compaction persistence | AC: Loop state (current story, completed stories, pending stories) survives 5+ compaction cycles. `hivemind loop status` shows consistent progress after each compaction. |
| **P7-MEM-05** | Quality gate integration | AC: Acceptance criteria from prd.json checked against test/build output before marking story complete. `npm test` pass required. Build success required. |
| **P7-MEM-06** | Mem metadata tagging | AC: Every mem tagged with: timestamp, session ID (from SDK), hierarchy stamp, git hash, shelf name, relevance score. Queryable by any field. |
| **P7-MEM-07** | Shelf size limits + staleness pruning | AC: Configurable shelf size limit (default: 50 mems/shelf). Mems older than configurable threshold (default: 30 days) auto-pruned. Relevance scoring on recall prevents noise. |
| **P7-MEM-08** | In-session reasoning memory | AC: Complex bug/investigation chains stored as linked reasoning nodes. Each node: hypothesis, evidence, outcome, linked sub-tasks. Traversable by hierarchy. Supports trial-and-error chains. |

### Phase 7 Exit Criteria

- Mems persist across sessions via git commits
- Ralph loop: init→next→complete cycle verified across 5+ compactions
- Semantic recall returns relevant results
- Shelf pruning prevents unbounded growth
- `npm test` ≥ 1000 assertions

---

## Phase 8: Packing Automation & Smart Governance

**Goal:** Combine OpenCode's innate mechanisms (Commands, Skills, Agents, YAML headers) with hooks and tools to create automated, config-driven governance that injects, transforms, and controls context at every entry point.

**Systems:** ALL 5 systems — this is the mesh integration phase

**Rationale:** The timeline identifies this as "THE BIGGEST TURNING POINT" — when configuration values are parsed with prompts and commands, exported into hierarchical statuses, and injected into every turn, beginning of session, after compact, and with user prompt. The quality of workflows elevates.

### Requirements

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| **P8-PAK-01** | Slash commands for hierarchical scan levels | AC: `/hivemind-scan-quick` (surface), `/hivemind-scan-deep` (full codebase), `/hivemind-scan-focused <path>` (targeted). Each packed as code script (not exposed .md). Uses BunShell + repomix + tools. |
| **P8-PAK-02** | Skills as backend API architecture | AC: Behavioral skills packaged per the OpenCode skills spec. `find-skill` discovers HiveMind skills. `skill-creator` can generate new governance skills. Skills are granular, specific, hierarchical, non-overlapping. |
| **P8-PAK-03** | Agent profiles for specialized scan/investigation | AC: Hidden sub-agents configured for: code scan, architecture investigation, orchestration. Not user-facing — called only by tools. YAML header controls which agent profile activates. No clash with innate framework agents. |
| **P8-PAK-04** | Config-driven injection rules | AC: `.hivemind/config.json` defines: what fires when (session start, between turns, after compact, with user prompt). Rules parsed and applied automatically by hooks. No manual trigger needed. |
| **P8-PAK-05** | Prompt-as-workflow-step technique | AC: Prompts can be chained as workflow steps. Each step has: input context, expected output format, next step trigger. Skills serve as backend API for prompt workflows. |
| **P8-PAK-06** | Export rules → hierarchical status injection | AC: Export rules define what state gets parsed into hierarchical statuses. Statuses injected into every turn's system prompt, session beginning, and compact context. Always fresh, always relevant. |
| **P8-PAK-07** | Forced re-read hooks at checkpoints | AC: At configurable checkpoints (task complete, phase transition, compaction), hooks force re-read of: active plan, task state, hierarchy, relevant mems. Agent cannot skip these. |
| **P8-PAK-08** | Assistant message transformation on export | AC: Last AI message auto-transformed into structured outline: tools used, working plan, files modified, file tree. Forced commit with metadata + timestamp regardless of file changes. |

### Phase 8 Exit Criteria

- Commands, Skills, and Agent profiles deployed and non-conflicting
- Config-driven injection verified across all entry points
- Forced re-read at checkpoints verified (agent cannot skip)
- Export transformation produces structured outlines
- `npm test` ≥ 1050 assertions

---

## Phase 9: First-Run Experience & README

**Goal:** Interactive installation, immediate impact on first use, and comprehensive bilingual documentation.

**Systems:** CLI + Session Management + System Core

**Rationale:** The timeline explicitly identifies UX as "the user's biggest frustration" — silent bootstrap race condition, zero host project awareness, no immediate "wow" factor, and inferior README.

### Requirements

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| **P9-UX-01** | Interactive step-by-step installation | AC: `hivemind init` walks user through: governance mode selection, language preference, project type detection, framework detection (GSD/Spec-kit). Uses `@clack/prompts` for TUI wizard. No silent defaults. |
| **P9-UX-02** | Host project awareness | AC: On init, HiveMind reads: `package.json` (tech stack), directory structure (monorepo detection), existing frameworks (`.planning/`, `.spec-kit/`). Injects project context into first session. |
| **P9-UX-03** | Bootstrap race condition fix | AC: `session-lifecycle` hook does NOT auto-create `.hivemind/` with defaults before `hivemind init`. Init wizard runs first. If no `.hivemind/`, hook creates minimal bootstrap with clear "run hivemind init" guidance. |
| **P9-UX-04** | Immediate "wow" actions on first use | AC: After init, user sees: project summary, detected frameworks, suggested first action, governance mode explanation. TUI toast confirms initialization. Dashboard accessible. |
| **P9-UX-05** | README complete rewrite (English) | AC: Comprehensive English README with: what it is, why it matters, quick start (< 2 min), architecture overview, all 14 tools documented, all CLI commands, configuration reference, troubleshooting. |
| **P9-UX-06** | README Vietnamese section | AC: Vietnamese section MORE explanatory than English (not just translation). Explains concepts with Vietnamese developer context. Tone: professional but approachable. |
| **P9-UX-07** | `hivemind dashboard` accessible and useful | AC: TUI dashboard loads on `hivemind dashboard` command. Shows: session state, hierarchy tree, drift score, recent tool calls, mems count. Bilingual (EN/VI). 2s polling. |

### Phase 9 Exit Criteria

- Interactive init wizard works for greenfield and brownfield projects
- README passes user review (English + Vietnamese)
- First-run produces immediate visible value
- Dashboard functional and informative
- No silent bootstrap race condition

---

## Phase 10: Stress Test & Integration Validation

**Goal:** `npm run stress-test` validates ALL conditions. The cognitive mesh works as a whole. Ship to npm.

**Systems:** ALL — mesh validation

**Rationale:** "You can't stress test a mesh until all 5 systems exist and are wired together." This phase tests chaining, not features.

### Requirements

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| **P10-STR-01** | All 13 governance stress conditions pass | AC: `tests/governance-stress.test.ts` reports 13/13 PASS. GOV-01..08 verified. |
| **P10-STR-02** | 10+ sequential compaction test | AC: 10 compactions in sequence. After each: hierarchy valid, brain consistent, mems intact, tasks preserved, loop state correct. Zero data loss. |
| **P10-STR-03** | Framework detection stress test | AC: 5 scenarios pass: greenfield, brownfield, GSD-only, Spec-kit-only, dual-framework. Each produces correct governance behavior. |
| **P10-STR-04** | Cognitive mesh integration test | AC: Full chain: hook triggers → session updates → tool enriches → mem stores → core reflects. End-to-end in one test. |
| **P10-STR-05** | `npm run stress-test` single command | AC: One command runs full stress suite. CI-compatible. JSON report output. |
| **P10-STR-06** | Cross-session mems recall test | AC: Save mem in session A. Compact. Start session B. Recall mem. Verify accuracy. |
| **P10-STR-07** | Argue-back escalation verified | AC: Simulate 15 consecutive ignored warnings. IGNORED tier fires at 10. Tri-evidence block present. Dynamic context (not static strings). |
| **P10-STR-08** | Full automation cycle test | AC: Init → declare_intent → work (tools) → drift warning → map_context → compact → resume → recall mems → complete. Zero manual intervention needed. |
| **P10-STR-09** | UAT Phase 02 live verification | AC: All 10 pending UAT tests from `02-UAT.md` executed in live OpenCode. Toast rendering confirmed. |
| **P10-STR-10** | Ship: merge, push, publish | AC: `dev` merged to `master`. All tests green. `npm publish` succeeds. Version bumped to v3.0.0. |

### Phase 10 Exit Criteria

- `npm run stress-test` reports ALL PASS
- 10+ compaction cycle with zero data loss
- Full mesh chain verified end-to-end
- Live UAT complete (10/10)
- Published to npm as v3.0.0
- Total assertions ≥ 1100

---

## Requirements Traceability Matrix

| Req ID | Phase | System(s) | Timeline Source | Status |
|--------|-------|-----------|----------------|--------|
| P3-BUG-01..08 | 3 | Core | Wave 1 audit (Tier 1-3 bugs) | Pending |
| P3-REORG-01..07 | 3 | Core + Sessions | Wave 2 (.hivemind reorg) | Partial (2/9) |
| P3-CTX-01..05 | 3 | Core + Sessions | Wave 2 (first-turn context) | Pending |
| P4-SES-01..10 | 4 | Sessions + Core | Roadmap Phase 3 + timeline Entry 1-4 | Pending |
| P5-TSK-01..10 | 5 | Core + Sessions | Timeline (TODO/Task control section) | Pending |
| P6-TUL-01..07 | 6 | Tools + Core + Mems | Roadmap Phase 4 | Pending |
| P7-MEM-01..08 | 7 | Mems + Core + Sessions | Roadmap Phase 5 + timeline (in-session memory) | Pending |
| P8-PAK-01..08 | 8 | ALL | Timeline (Packing Automation section) | Pending |
| P9-UX-01..07 | 9 | CLI + Sessions | Wave 1 Tier 4-5 + timeline frustrations | Pending |
| P10-STR-01..10 | 10 | ALL | Roadmap Phase 6 + timeline validation | Pending |

**Total v3 Requirements: 72**
- Phase 3: 20 (8 bugs + 7 reorg + 5 context)
- Phase 4: 10
- Phase 5: 10
- Phase 6: 7
- Phase 7: 8
- Phase 8: 8
- Phase 9: 7
- Phase 10: 10
- Unmapped: 0 ✓

---

## Architecture Decision Records

| # | Decision | Rationale | Constraint |
|---|----------|-----------|------------|
| ADR-01 | NEVER block/deny tool execution | Plugin ecosystem coexistence. Zero plugins use `permission.ask`. | Immutable |
| ADR-02 | `src/lib/` NEVER imports SDK | Platform portability — concepts work on Claude Code, Cursor, any future platform. | Enforced by CI |
| ADR-03 | SDK client stored in hooks, never called during init | Deadlock prevention (oh-my-opencode #1301). | Enforced by lint |
| ADR-04 | Filesystem for persistence, SDK for intelligence | FS survives crashes/restarts/platform switches. SDK provides real-time enrichment. | Design principle |
| ADR-05 | Every feature touches 2+ systems | Single-system features miss the mesh multiplier. | Review gate |
| ADR-06 | Manifest-first traversal | Scripts read manifests, never scan directories. Deterministic. Fast. | Architecture rule |
| ADR-07 | Event-driven over turn-counting | SDK provides 32 real events. Turn-counting is a proxy that becomes noise. | Phase 1 complete |
| ADR-08 | Soft governance = inform, don't punish | Escalation: INFO→WARN→CRITICAL→DEGRADED→IGNORED. Never block. | Core philosophy |
| ADR-09 | Sub-task = atomic unit with forced commit | Every file-changing sub-task gets a git commit. No exceptions. | Phase 5 enforcement |
| ADR-10 | Sessions and plans are M:N | A session can span multiple plans. A plan can span multiple sessions. | Manifest schema |

---

## Out of Scope (v3)

| Feature | Reason |
|---------|--------|
| Blocking/denying tool execution | NEVER — ADR-01 |
| `permission.ask` hook | Zero ecosystem usage, collision guaranteed |
| Running GSD/Spec-kit commands | HiveMind governs, doesn't orchestrate |
| Full Repomix reimplementation | Wrap via BunShell, don't rebuild |
| Agent spawning/management | Frameworks spawn agents, HiveMind governs them |
| Custom LLM model support | Model-agnostic by design |
| GUI/web dashboard | CLI + Ink TUI + showToast sufficient for v3 |
| Vector embedding per session | Deferred to v4 (requires free model + storage design) |
| Claude Code port | Conceptually designed for; implementation deferred |
| Level 0 SOT (codemap/codewiki) scanning | Placeholder only in v3; requires code analysis pipeline |

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| SDK API breaking changes | HIGH | `withClient()` fallback wrapper. All SDK calls in hooks only. |
| Deadlock during init | HIGH | ADR-03 enforced. Store ref, use in hooks. |
| Context budget overflow | MEDIUM | Budget caps per section. Aggressive mode at 3+ compactions. |
| Manifest corruption | MEDIUM | Dedup on every write. Backup before write. Migration rollback. |
| Agent ignores governance | MEDIUM | Sure-hit mechanisms: forced injection, forced re-read, forced commit. Non-AI mechanisms. |
| Test regression | LOW | Never drop below 700 assertions. CI enforcement. |
| Cross-plugin conflicts | LOW | Zero blocking. Zero `permission.ask`. Soft governance only. |

---

## Execution Order & Dependencies

```
P3 (Stabilize & Structure)
├── P4 (Session Lifecycle) — needs organized data layer
├── P5 (TODO/Task) — needs organized data layer
│   └── P7 (Mems Brain) — needs task linkage
│   └── P8 (Packing Automation) — needs task checkpoints
├── P6 (Agent Tools) — needs session context from P4
│   └── P7 (Mems Brain) — needs extraction tools
│   └── P8 (Packing Automation) — needs extraction tools
├── P9 (First-Run UX) — can run parallel with P4-P6
└── P10 (Stress Test) — depends on ALL above
```

**Critical Path:** P3 → P4 → P6 → P7 → P10
**Parallel Track:** P3 → P5 → P8 (can run alongside P4→P6→P7)
**Independent:** P9 can start after P3, run parallel with everything

---

*Plan version: 1.0.0*
*Created: 2026-02-14*
*Total requirements: 72*
*Phases: 8 (P3-P10, with P1-P2 complete)*
*Architecture: 5-system cognitive mesh with SDK materialization layer*
