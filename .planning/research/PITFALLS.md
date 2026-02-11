# Domain Pitfalls

**Domain:** AI Agent Context Governance Plugin
**Researched:** 2026-02-12

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: Bootstrap Only Fires in Strict Mode (ST12)
**What goes wrong:** Evidence discipline and team behavior are NOT taught from session start in assisted/permissive modes. The bootstrap block requires `governance_status === "LOCKED"` which only happens in strict mode. Assisted (the DEFAULT) starts `OPEN` → bootstrap never fires.
**Why it happens:** Original design assumed strict mode would be common. Reality: most users start with assisted.
**Consequences:** In 2 of 3 governance modes, agents receive zero teaching about evidence, verification, or team behavior. The core product promise ("governance from turn 0") fails silently.
**Prevention:** Change bootstrap condition from `governance_status === "LOCKED"` to `turn_count <= 2`. Make it mode-agnostic. Add evidence + team teaching unconditionally.
**Detection:** Run `hivemind init --mode assisted` then check what the agent sees in turn 1. If no bootstrap → broken.

### Pitfall 2: Permissive Mode Contradiction (ST11)
**What goes wrong:** Permissive mode is documented as "silent tracking only / no warnings" in 4 places (index.ts, tool-gate.ts, skill docs, AGENTS.md). But session-lifecycle.ts has ZERO checks for `governance_mode === "permissive"` — it pushes [WARN], [CRITICAL], [DEGRADED] signals to ALL modes unconditionally.
**Why it happens:** Tool-gate correctly suppresses warnings for permissive. Session-lifecycle was built later and didn't replicate the mode filtering.
**Consequences:** Agents in permissive mode are told the mode is "silent" but see warning signals in their system prompt. This is a contradictory signal that erodes trust.
**Prevention:** Add `if (config.governance_mode === "permissive") { suppress detection signals }` in session-lifecycle.ts. Or: define permissive as "tracking with minimal prompting" and update docs.
**Detection:** Init with permissive mode, generate 6+ turns of activity, check if `[WARN]` appears in system prompt.

### Pitfall 3: Framework Integration Breaking Standalone Mode
**What goes wrong:** Adding GSD/Spec-kit integration could make HiveMind dependent on those frameworks being present. If detection code throws when no framework found, or if the <hivemind> block assumes framework context exists, standalone users break.
**Why it happens:** Developer focuses on framework integration, forgets to test standalone path.
**Consequences:** Plugin crashes or produces nonsensical output for users without GSD/Spec-kit.
**Prevention:** `detectFramework()` returns `null` for standalone. All framework-dependent code gated by `if (framework)`. Test standalone path in every test suite.
**Detection:** Run test suite without any `.gsd/` or `.spec-kit/` directory present.

### Pitfall 4: Repomix Output Exceeding Context Window
**What goes wrong:** `repomix` on a large codebase produces 1-50MB output. Agents can't consume this. Token limits blow.
**Why it happens:** Default repomix packs EVERYTHING. No budget awareness.
**Consequences:** Tool returns unusable output, wastes tokens, agent confused.
**Prevention:** Always use `--compress` (signatures only). Use `--token-count-tree` first to estimate budget. Use `--split-output` for large codebases. Cap output at configurable token limit.
**Detection:** Run codebase_pack on a 100+ file project without limits. If output > 100KB, safeguards are missing.

## Moderate Pitfalls

### Pitfall 5: GSD STATE.md Format Changes
**What goes wrong:** GSD framework updates STATE.md format. HiveMind's parser breaks.
**Prevention:** Use loose regex parsing, not strict schema. Accept partial data. Log warnings for unparseable sections. Never crash on bad input.

### Pitfall 6: Ralph-Loop Infinite Iteration
**What goes wrong:** A user story acceptance criterion is impossible to satisfy. Agent loops forever trying to pass it.
**Prevention:** `failedAttempts` counter in loop-state.json. Max 3 attempts per story. After max: mark story as blocked, surface to user, move to next.

### Pitfall 7: Skill System Agent Non-Compliance
**What goes wrong:** Skills teach principles but agents ignore them. The 3-hop chain (AGENTS.md → hivemind-governance → evidence-discipline) breaks if agent doesn't load skills.
**Prevention:** Move critical teaching INTO the system prompt injection (P0 bootstrap block). Don't rely on voluntary skill loading for core governance.

### Pitfall 8: Git Hash Not Co-Persisted with Hierarchy Nodes
**What goes wrong:** Git hash is computed at render-time (dashboard, ecosystem-check) but not stamped into hierarchy.json. If you need to know which commit was active when a node was created, you must cross-reference timestamps with git log.
**Prevention:** Add `gitHash` field to HierarchyNode. Set it during `addChild()`. Minor storage cost for major traceability gain.

### Pitfall 9: Manifest File-on-Disk Cross-Check Missing
**What goes wrong:** manifest.json tracks session files, but ecosystem-check doesn't verify that files referenced in manifest actually exist on disk. A deleted session file creates a phantom reference.
**Prevention:** Add disk existence check for every `manifest.sessions[].file` in ecosystem-check semantic validation.

## Minor Pitfalls

### Pitfall 10: Duplicate getGitHash() Implementation
**What goes wrong:** `getGitHash()` exists in both `src/dashboard/server.ts` and `bin/hivemind-tools.cjs`. Changes to one aren't reflected in the other.
**Prevention:** Extract to shared utility. Import in both locations.

### Pitfall 11: Brain-to-Tree Consistency Not Cross-Validated
**What goes wrong:** ecosystem-check validates brain.json and hierarchy.json independently but doesn't verify that `brain.json.hierarchy` flat projections match the tree's cursor path.
**Prevention:** Add `toBrainProjection(tree) === brain.hierarchy` check in ecosystem-check semantic validation.

### Pitfall 12: No Explicit 10+ Compaction Test
**What goes wrong:** Architecture supports unbounded compaction cycles, but no test explicitly runs 10+ sequential compactions. Edge cases in counter overflow or report accumulation could lurk.
**Prevention:** Add `test_10_compactions_in_sequence()` to entry-chain tests.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| ST11/ST12 fixes | Breaking existing strict mode behavior | Test all 3 modes after changes |
| Framework detector | Circular dependency on framework config | Feature detection only, no imports |
| GSD bridge | STATE.md parsing fragility | Regex-based, accept partial, never crash |
| Fast extraction tools | External tool not installed | `which` check, fallback to Node.js native |
| Loop control | Infinite iteration on impossible criteria | Max 3 attempts per story, then block |
| Spec-kit bridge | Framework doesn't exist yet | Stub interface, implement later |
| npm publish | Token/auth issues | Test with `--dry-run` first |

## Sources

- Stress test verification: 6 sub-agent reports (ST1-ST12)
- GSD framework: /Users/apple/.config/opencode/get-shit-done/ (v1.18.0)
- Current codebase: /Users/apple/hivemind-plugin/src/
- AGENTS.md: /Users/apple/hivemind-plugin/AGENTS.md
