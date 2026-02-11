# Research Summary: HiveMind v3

**Domain:** AI Agent Context Governance Plugin (OpenCode ecosystem)
**Researched:** 2026-02-12
**Overall confidence:** HIGH

## Executive Summary

HiveMind v3 is a fundamental architectural upgrade driven by one discovery: **the OpenCode SDK client is fully usable from within plugins**. This was verified across 5 of 8 ecosystem plugins (micode, opencode-pty, oh-my-opencode, plannotator, subtask2), with production code showing `client.session.create()`, `client.session.prompt()`, `client.tui.showToast()`, and `client.session.messages()` all working from hook and tool contexts. The only caveat is a deadlock risk when calling the client during plugin init (oh-my-opencode issue #1301).

This changes everything. The current HiveMind v2.6.0 destructures only `{ directory, worktree }` from PluginInput — using 2 of 6 available fields. The SDK provides `client` (sessions, TUI, files, events, search), `$` (BunShell for subprocess spawning), `project` (metadata), and `serverUrl` (connectivity). The idumb-v2 system concepts diagram maps directly to these SDK capabilities: Session Management uses `client.session.*`, Visual Feedback uses `client.tui.showToast()`, Fast Extraction uses `client.find.*` + `client.file.*` + `$` BunShell for Repomix, and the Shared Brain uses `client.session.messages()` for cross-session evidence tracking.

The research also confirmed a non-negotiable architectural principle: **never block, never deny, never stop tools**. Zero plugins in the ecosystem use `permission.ask` for blocking. oh-my-opencode (the largest plugin at 1.5MB, 41 internal hooks) explicitly avoids it. Permission blocking creates plugin wars — multiple plugins fighting over deny/allow = chaos. HiveMind's power is in awareness (toasts, system prompt, argue-back, tracking), not enforcement.

Two frameworks are targeted for first-class support: GSD (Get Shit Done) with its `.planning/` directory, STATE.md-driven workflow, and 11 agent types; and Spec-kit with its `.spec-kit/` directory and governance markers. The research deeply analyzed GSD's entire architecture (30+ workflow files, wave-based execution, revision loops) and Spec-kit's framework detection patterns from idumb-v2. Ralph-tui's loop orchestration pattern (prd.json → story selection → completion tracking) provides the model for autonomous multi-story work management.

## Key Findings

**Stack:** SDK client IS the platform — `client.session.*` for real session management, `client.tui.showToast()` for visual feedback, `client.find.*` for fast extraction, `client.event.subscribe()` for event-driven governance, `$` BunShell for Repomix/git integration.

**Architecture:** 4-pillar design from idumb-v2 (Auto-Hooks, Session Management, Unique Agent Tools, Mems Brain) ALL powered by the SDK client layer. 14 hooks available, currently using 5 — adding `event`, `chat.message`, `command.execute.before`, `shell.env`.

**Critical pitfall:** Client deadlock during init (oh-my-opencode #1301). Store client reference, never call during plugin init function. And **NEVER use permission.ask to block tools** — this is the ecosystem's learned wisdom.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Phase 1: Governance Foundation Fix** — Fix ST12 (bootstrap in all modes) and ST11 (permissive mode signals)
   - Addresses: GOV-01→06 from REQUIREMENTS
   - Avoids: Pitfall #3 (bootstrap only in strict), Pitfall #4 (signal contradiction)
   - No SDK changes needed — pure governance logic fixes

2. **Phase 2: SDK Client Integration** — Destructure ALL PluginInput fields. Wire `client`, `$`, `project`, `serverUrl` into existing architecture.
   - Addresses: Session management, TUI toasts, event subscription, BunShell availability
   - Avoids: Pitfall #2 (init deadlock), Pitfall #5 (ignoring SDK)
   - This is the foundation for everything else

3. **Phase 3: Framework Detection & Fast Extraction** — Auto-detect GSD/Spec-kit, SDK-powered grep/glob/read/extract tools
   - Addresses: FRM-01→06, EXT-01→09
   - Avoids: Pitfall #10 (ignoring framework state), Pitfall #12 (raw FS when SDK has it)
   - Depends on Phase 2 (needs client for `find.text`, `find.files`, `file.read`)

4. **Phase 4: Orchestration Control** — Ralph loop pattern with loop state persistence
   - Addresses: ORC-01→08
   - Avoids: Pitfall #1 (never block orchestration tools)
   - Depends on Phase 3 (needs extraction tools for story verification)

5. **Phase 5: Self-Validation & Visual Governance** — IGNORED tier, dynamic argue-back, toast-based feedback
   - Addresses: VAL-01→06
   - Avoids: Pitfall #7 (static argue-back), Pitfall #9 (no visual feedback)
   - Depends on Phase 2 (needs toast, message history)

6. **Phase 6: Stress Test Infrastructure** — Automated stress suite, 10+ compaction test, framework detection test
   - Addresses: STR-01→05
   - Depends on all previous phases

**Phase ordering rationale:**
- Phase 1 first: governance must work before adding capabilities (stress test must pass)
- Phase 2 second: SDK client integration enables everything else (sessions, toasts, events, files)
- Phase 3 third: extraction + framework detection build on SDK client
- Phase 4 fourth: orchestration needs extraction tools for verification
- Phase 5 fifth: self-validation needs toast (from Phase 2) + message history (from Phase 2)
- Phase 6 last: stress testing validates all features

**Research flags for phases:**
- Phase 2: Likely needs deeper research on `event` hook SSE subscription patterns. How does event stream lifecycle work? Does it need cleanup?
- Phase 3: Standard patterns — `client.find.*` and `client.file.*` are well-documented
- Phase 4: Needs research on ralph-tui loop state schema and completion tracking across compactions
- Phase 5: Standard patterns — toast + detection engine enhancement

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | SDK client verified from 5 real plugins. API surface documented. |
| Features | HIGH | Derived from SDK capabilities + 8 plugin codebases + idumb-v2 concepts |
| Architecture | HIGH | 4-pillar model maps cleanly to SDK. Patterns verified in production plugins. |
| Pitfalls | HIGH | oh-my-opencode #1301 documented. Ecosystem-wide zero use of permission.ask confirmed. |

## Gaps to Address

- SSE event stream lifecycle management (subscribe/unsubscribe/cleanup)
- SDK client error handling patterns (what happens when server is unreachable?)
- Multi-project plugin behavior (does client scope to current project?)
- `experimental.*` hooks stability — "experimental" prefix suggests API may change
- Ralph-tui loop state schema evolution across compactions

## Reference Materials

All stored in `.planning/research/plugin-refs/`:

| File | Source | Size | Purpose |
|------|--------|------|---------|
| `opencode-sdk.xml` | sst/opencode (packages/plugin + packages/sdk) | ~53 files | SDK source code reference |
| `dynamic-context-pruning.xml` | Tarquinen/opencode-dynamic-context-pruning | 185KB | Context management patterns |
| `micode.xml` | vtemian/micode | 351KB | Session create/prompt/delete, constraint review |
| `oh-my-opencode.xml` | code-yeongyu/oh-my-opencode | 1.5MB | Largest plugin, 41 hooks, ralph-loop, toasts |
| `opencode-pty.xml` | shekohex/opencode-pty | 134KB | PTY tools, SDK client typing, showToast |
| `opencode-worktree.xml` | kdcokenny/opencode-worktree | 58KB | Event-driven (session.idle), worktree tools |
| `opencode-zellij-namer.xml` | 24601/opencode-zellij-namer | 26KB | Anti-pattern: NOT a real plugin |
| `plannotator.xml` | backnotprop/plannotator | 279KB | Silent injection, message history, agent detection |
| `subtask2.xml` | spoons-and-mirrors/subtask2 | 102KB | setClient() pattern, loop state, parallel execution |
