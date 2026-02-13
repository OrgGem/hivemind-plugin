# Team A Execution Plan — Removal, Refactor, and Tool Restructure

Date: 2026-02-13
Owner: Team A (execution)
Orchestration owner: Main integration agent via `MASTER-PLANNING.MD`

---

## Purpose

This document is Team A's execution spec.

Team A must remove intrusive, blocking-style, context-poisoning, and flow-disrupting behavior while restructuring tools into a useful, compact multi-entry system.

Do not change governance policy here. Deliver implementation that matches integration contracts defined in `MASTER-PLANNING.MD`.

---

## Required learning input before implementation

Team A must audit and map flaws first, using these sources:

1. GSD project phases already completed in this repo:
   - `.planning/phases/01-sdk-foundation-system-core/01-01-SUMMARY.md`
   - `.planning/phases/01-sdk-foundation-system-core/01-02-SUMMARY.md`
   - `.planning/phases/02-auto-hooks-governance-mesh/02-01-SUMMARY.md`
   - `.planning/phases/02-auto-hooks-governance-mesh/02-02-SUMMARY.md`
   - `.planning/phases/02-auto-hooks-governance-mesh/02-03-SUMMARY.md`
   - `.planning/phases/02-auto-hooks-governance-mesh/02-04-SUMMARY.md`
2. SDK and ecosystem references:
   - `.planning/research/plugin-refs/dynamic-context-pruning.xml`
   - `.planning/research/plugin-refs/micode.xml`
   - `.planning/research/plugin-refs/oh-my-opencode.xml`
   - `.planning/research/plugin-refs/opencode-pty.xml`
   - `.planning/research/plugin-refs/opencode-sdk.xml`
   - `.planning/research/plugin-refs/opencode-worktree.xml`
   - `.planning/research/plugin-refs/opencode-zellij-namer.xml`
   - `.planning/research/plugin-refs/plannotator.xml`
3. Current hook/tool implementations under `src/hooks/` and `src/tools/`.

Deliverable before coding: a flaw map grouped by category (toast noise, pseudo-blocking behavior, empty injection, one-way lifecycle tools, retrieval gaps).

---

## Hard constraints

1. No hard-block behavior and no `permission.ask`.
2. Do not shadow innate tools (`read`, `edit`, `write`, `grep`, `glob`, `bash`, `task`, etc.).
3. Maximum new surface: 10 total (custom tools + scripts combined).
4. Every write flow must have a symmetric read/inspect flow.
5. Outputs must be deterministic and machine-parseable (`--json` support where relevant).
6. Do not inject irrelevant context when confidence is low; skip instead of poisoning.

---

## Tool architecture target

Split execution into two independent groups with a clear integration point:

1. **Group A1: Context Control Hooks + SDK Injection**
2. **Group A2: Tool Lifecycle + Retrieval/Recall**

Integration point: `ContextPacket`, `TaskGraphState`, `ManifestIndex`, `SignalEnvelope`.

### Custom tool families (target 6)
1. `hivemind_session` — start/checkpoint/close/resume.
2. `hivemind_context` — collect/prune/inject/report.
3. `hivemind_tasks` — upsert/split/delegate/tick/reload.
4. `hivemind_memory` — save/recall/list/prune.
5. `hivemind_links` — bind session-plan-task-artifact relationships.
6. `hivemind_inspect` — manifest-hop snapshot and scoped evidence pull.

### Script utilities (target 3)
1. `bin/hm-scan` — `quick`, `focused`, `deep` scan profiles.
2. `bin/hm-hop` — relation-based hop read from manifests.
3. `bin/hm-state` — schema validate, summarize, export state bundles.

Total target surface: 9.

---

## Integration contracts (must match)

1. `ContextPacket` (from internal team)
   - Tool behavior must consume this packet without extra assumptions.

2. `TaskGraphState` (owned by tools team)
   - Must include main tasks, sub-tasks, status, links, and timestamps.

3. `ManifestIndex` (shared)
   - Must support fast first-turn and post-compact traversal.

4. `SignalEnvelope` (from internal team)
   - Tools respond with advisory behavior only (never deny execution).

5. SDK-assisted context manipulation
   - Use session APIs where appropriate: `session.get`, `session.messages`, `session.prompt({ noReply: true })`, `session.summarize`.
   - Must degrade cleanly when SDK client is unavailable.

---

## Execution phases

### T0: Audit and flaw mapping (mandatory)
- Map every intrusive toast and classify by value vs noise.
- Map all pseudo-blocking/disruptive pathways and remove/replace strategy.
- Map one-way tools lacking lifecycle pairing (`write` without `inspect`, etc.).
- Produce replacement matrix before implementation.

### T1: Group A1 implementation (hooks/injection)
- Refactor `system.transform` and compaction injection into concise signal packets.
- Remove low-signal repetitive blocks and pseudo-block wording.
- Add strict toast throttling and dedupe strategy.
- Wire SDK no-reply context support with fallback path.

### T2: Group A2 implementation (tools/lifecycle/retrieval)
- Define tool schemas and action verbs.
- Define JSON output contracts.
- Implement lifecycle pairs (`upsert` + `inspect`, `delegate` + `reload`, `save` + `recall`).
- Implement manifest-first traversal in tools and scripts.
- Add cross-session export/reload for task continuity.

### T3: Hardening and handoff
- Ensure `--json` output for script utilities.
- Add contract tests against `ContextPacket` and `SignalEnvelope`.
- Deliver a compatibility matrix to internal team before merge.

---

## Acceptance criteria

1. Tool/script count remains <=10.
2. No tool duplicates innate capability without added value.
3. Every write operation has a symmetric inspect/read operation.
4. Delegated sub-tasks survive compact + resume without data loss.
5. Manifest traversal succeeds for first-turn and post-compact entry points.
6. Contract tests pass for `ContextPacket`, `TaskGraphState`, `ManifestIndex`, `SignalEnvelope`.
7. `npm run typecheck`, `npm test`, and `npm run lint:boundary` pass after integration.
8. Intrusive toasts are reduced to high-signal events with cooldown enforcement.
9. No pseudo-block or execution-stop language remains in Team A-owned pathways.
10. Context injection quality passes: relevant, concise, non-empty, and non-poisoning.

---

## Out of scope for tools team

- Governance policy changes.
- Blocking or permission gating.
- Forcing git commits unconditionally.

---

## Handoff checklist

Before requesting integration, attach:
1. Tool catalog with final counts.
2. Contract JSON examples for each tool family.
3. Validation test output.
4. Known limitations and fallback behavior.
