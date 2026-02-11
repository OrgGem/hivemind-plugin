# HiveMind Context Governance

## What This Is

A lightweight context governance layer for OpenCode that prevents drift and manages session state across AI agent workflows. HiveMind uses a 3-level hierarchy (Trajectory → Tactic → Action) with 14 tools, 4 hooks, 5 skills, and a CLI to enforce governance, track session health, and ensure agents stay on task. It is a plugin for OpenCode and serves as the "session brain" for any AI-assisted development workflow.

## Core Value

Every agent session must be traceable, governed, and self-aware — preventing context drift, enforcing evidence-based claims, and surviving any operational chaos (compactions, mind changes, bombardment) without human intervention.

## Requirements

### Validated

- ✓ 3-level hierarchy (trajectory/tactic/action) with tree engine — existing
- ✓ 14 tools (declare_intent, map_context, compact_session, self_rate, scan_hierarchy, save_anchor, think_back, check_drift, save_mem, list_shelves, recall_mems, hierarchy_prune, hierarchy_migrate, export_cycle) — existing
- ✓ 4 hooks (tool-gate, soft-governance, session-lifecycle, compaction) — existing
- ✓ 5 skills (hivemind-governance, session-lifecycle, evidence-discipline, context-integrity, delegation-intelligence) — existing
- ✓ CLI with 23+ commands (init, status, compact, dashboard, ecosystem-check, validate, inspect, session trace) — existing
- ✓ Evidence Gate System with 4-tier escalation (INFO→WARN→CRITICAL→DEGRADED) — existing
- ✓ 11 counter-excuses for argue-back system — existing
- ✓ MiMiHrHrDDMMYYYY timestamp traceability stamps on all hierarchy nodes — existing
- ✓ Mems brain for persistent cross-session memory — existing
- ✓ FileGuard (write-without-read tracking) — existing
- ✓ Compaction purification with budget-capped relay chain — existing
- ✓ Git hash tracking in dashboard and CLI — existing
- ✓ 9-step ecosystem-check validation command — existing
- ✓ Ink TUI dashboard — existing
- ✓ 705 test assertions passing — existing

### Active

- [ ] Fix ST12: Bootstrap fires in ALL governance modes, not just strict
- [ ] Fix ST12: Evidence discipline taught in system prompt from turn 0
- [ ] Fix ST12: Team behavior taught in system prompt from turn 0
- [ ] Fix ST11: Permissive mode suppresses detection signals as documented
- [ ] GSD framework awareness: detect `.planning/` and adapt governance
- [ ] Spec-kit framework awareness: detect `.spec-kit/` and adapt governance
- [ ] Fast extraction tools: Repomix-style codebase consumption scripts
- [ ] Orchestration patterns: Ralph loop-style bead/node completion tracking
- [ ] Proper comprehensive stress test suite covering green/brownfield, all modes, all complexity levels
- [ ] npm publish readiness (package.json, README, LICENSE verified)

### Out of Scope

- Running GSD/Spec-kit commands directly — HiveMind governs, doesn't orchestrate
- Custom AI model support — HiveMind is model-agnostic by design
- Real-time collaboration features — single-user governance focus
- GUI/web dashboard — CLI + Ink TUI is sufficient for v3

## Context

**Technical Environment:**
- OpenCode v1.1+ plugin ecosystem
- TypeScript + Node.js (ESM)
- 4 hooks architecture: `tool.execute.before`, `tool.execute.after`, `experimental.chat.system.transform`, `experimental.session.compacting`
- Plugin SDK: `@opencode-ai/plugin` v0.0.5

**Prior Work:**
- 6 completed iterations (v1.0 → v2.6.0)
- 12 archived design/implementation documents in `docs/archive/`
- Comprehensive hierarchy redesign completed (tree engine, detection engine, planning-fs rewrite)
- Evidence Gate System with escalating pressure and counter-excuses
- Ink TUI dashboard with trace panel

**Known Issues:**
- ST12 FAIL: Bootstrap block only fires in strict mode — assisted/permissive agents get no teaching
- ST11 CONDITIONAL PASS: Permissive mode receives warnings despite "silent tracking" documentation
- Git hash computed at render-time, not co-persisted with hierarchy nodes
- No manifest file-on-disk cross-check in ecosystem-check
- No brain-to-tree consistency validation in ecosystem-check
- getGitHash() duplicated between dashboard/server.ts and bin/hivemind-tools.cjs

## Constraints

- **Platform**: OpenCode plugin API — hooks cannot block tool execution (v1.1+ limitation), only track and warn
- **Plugin SDK**: `@opencode-ai/plugin` v0.0.5 — API surface is small, must work within it
- **Backward Compatibility**: brain.json, config.json, hierarchy.json schemas must migrate cleanly from v2.x
- **Test Coverage**: Never drop below 700 assertions — every change must maintain or increase test count
- **Zero Agent Cooperation**: System works even when agents completely ignore governance

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Soft governance over hard blocking | OpenCode v1.1+ cannot block tools; lean into escalating pressure | ✓ Good |
| 3-level hierarchy (trajectory/tactic/action) | Simple enough for agents to maintain, rich enough for drift detection | ✓ Good |
| MiMiHrHrDDMMYYYY stamp format | Grep-able across all artifacts, human-readable, sortable | ✓ Good |
| Skills as behavioral governance | Teach agents HOW to use tools, not just WHAT tools exist | ⚠️ Revisit — bootstrap doesn't fire in assisted/permissive |
| Evidence Gate with argue-back | System challenges agent claims instead of just agreeing | ✓ Good |
| Govern frameworks, don't run them | HiveMind detects GSD/Spec-kit but doesn't execute their commands | — Pending |

---
*Last updated: 2026-02-12 after /gsd-new-project initialization*
