# Domain Pitfalls

**Domain:** AI Agent Context Governance Plugin (OpenCode ecosystem)
**Researched:** 2026-02-12
**Confidence:** HIGH (derived from 8 plugin codebases, SDK source, oh-my-opencode issues, stress test results)

## Critical Pitfalls

### Pitfall 1: Permission Blocking = Plugin Wars
**What goes wrong:** Using `permission.ask` → `deny` to block tools. When two plugins both set permission.ask, they fight. Plugin A denies what Plugin B allows. User experience becomes unpredictable.
**Why it happens:** Natural instinct — "strict mode should prevent writes." Seems correct in isolation.
**Consequences:** User disables HiveMind entirely. Other plugins break. Trust destroyed. OpenCode community reputation damage.
**Prevention:** **NEVER use permission.ask. NEVER deny. NEVER stop tools.** Soft governance only: toast warnings, system prompt escalation, evidence tracking, argue-back. Zero plugins in the ecosystem use permission.ask for a reason.
**Detection:** Any code that sets `output.status = "deny"` is a hard STOP. Code review gate.

### Pitfall 2: Client Deadlock During Init
**What goes wrong:** Calling `client.*` API methods inside the plugin's init function (the `async (input) => { ... }` that returns Hooks).
**Why it happens:** Server waits for plugin init to complete. Plugin init waits for server to respond. Circular dependency.
**Consequences:** OpenCode hangs on startup. User must kill process. HiveMind becomes "the plugin that crashes OpenCode."
**Prevention:** Store `client` reference during init. Only call client methods from within hooks and tool execute functions (where server is already running).
**Detection:** oh-my-opencode issue #1301 documented this. Their test: "This test ensures we don't regress on issue #1301 — Passing client to fetchAvailableModels during createBuiltinAgents (called from config handler) causes deadlock."

```typescript
// BAD — deadlock risk
const plugin: Plugin = async ({ client }) => {
  const sessions = await client.session.list(); // DEADLOCK!
  return { /* hooks */ };
};

// GOOD — safe
const plugin: Plugin = async ({ client }) => {
  let storedClient = client; // store reference
  return {
    "tool.execute.after": async (input, output) => {
      const sessions = await storedClient.session.list(); // safe here
    }
  };
};
```

### Pitfall 3: Bootstrap Only Fires in Strict Mode (ST12 — CURRENT FAIL)
**What goes wrong:** New agents in assisted/permissive mode get ZERO governance teaching. Bootstrap block requires `governance_status === "LOCKED"` but assisted/permissive start as `OPEN`.
**Why it happens:** Original design assumed strict mode = governance, permissive mode = no governance. But the stress test demands governance teaching in ALL modes.
**Consequences:** 80% of users (assisted = default) get no teaching. Governance is invisible. Agent cooperation = 0.
**Prevention:** Change bootstrap condition from `LOCKED` check to `turn_count <= 2` regardless of mode. Add evidence + team teaching to bootstrap block.
**Detection:** Stress test ST12 catches this. Currently FAIL.

### Pitfall 4: Permissive Mode Signal Contradiction (ST11 — CONDITIONAL PASS)
**What goes wrong:** Permissive mode is documented as "silent tracking only" but system prompt injection pushes `[WARN]`, `[CRITICAL]`, `[DEGRADED]` signals unconditionally.
**Why it happens:** `session-lifecycle.ts` has zero `governance_mode === "permissive"` checks for detection signal suppression.
**Consequences:** User chooses permissive expecting silence, gets warnings anyway. Conflicting signal. Trust erosion.
**Prevention:** Add mode-aware signal filtering in system prompt injection. Permissive = metrics only, no escalation signals in system prompt. Still track internally.
**Detection:** Stress test ST11 catches this.

### Pitfall 5: Ignoring SDK Capabilities (Feature Stagnation)
**What goes wrong:** HiveMind uses 2 of 6 PluginInput fields (`directory`, `worktree`). Ignores `client`, `$`, `project`, `serverUrl`. Result: filesystem hacks instead of SDK capabilities.
**Why it happens:** Plugin was built before SDK client was verified to work from plugins. Natural inertia.
**Consequences:** Fragile file-based session tracking instead of real `client.session.*`. No visual feedback (no toasts). No event-driven governance. No fast extraction tools.
**Prevention:** v3 must destructure ALL PluginInput fields. SDK client = primary interface for session, TUI, file, find, event operations.
**Detection:** Grep for `async ({ directory, worktree })` — should become `async ({ client, project, directory, worktree, serverUrl, $ })`.

## Moderate Pitfalls

### Pitfall 6: Turn Counting Instead of Event-Driven
**What goes wrong:** Counting tool calls in `brain.json` as proxy for "activity." Misses real events like session idle, file edits, compaction.
**Prevention:** Use SDK `event` hook to subscribe to real events. `session.idle`, `session.compacted`, `file.edited` give ground-truth signals.

### Pitfall 7: Static Argue-Back Strings
**What goes wrong:** 11 counter-excuses in `COUNTER_EXCUSES` map are static, pre-authored. Agent learns to ignore them.
**Prevention:** Dynamic argue-back using `client.session.messages()` to read what agent actually said/did and generate context-specific rebuttals.

### Pitfall 8: Filesystem-Only State
**What goes wrong:** All state in `.hivemind/brain.json` — single point of failure, corruption risk, concurrent access issues.
**Prevention:** Keep brain.json for persistence but use SDK session metadata as secondary source of truth. `client.session.get()` provides timestamps, status, title that can validate brain state.

### Pitfall 9: No Visual Feedback
**What goes wrong:** All governance feedback buried in system prompt `<hivemind>` block. User never SEES governance working. Thinks plugin does nothing.
**Prevention:** `client.tui.showToast()` for drift warnings, evidence reminders, session health. Make governance visible.

### Pitfall 10: Ignoring Framework State
**What goes wrong:** HiveMind hierarchy diverges from GSD's phase/plan structure. Agent gets conflicting guidance.
**Prevention:** Framework detection + state alignment checks. Read `.planning/STATE.md` to know what phase agent should be in.

## Minor Pitfalls

### Pitfall 11: Over-Injecting System Prompt
**What goes wrong:** Too much content in `<hivemind>` block wastes context tokens.
**Prevention:** Budget cap (existing 2000 char limit). Progressive disclosure: minimal by default, expand on drift.

### Pitfall 12: Raw FS When SDK Has It
**What goes wrong:** Using `fs.readFileSync(path)` when `client.file.read({ query: { path } })` exists.
**Prevention:** SDK for project files, raw fs only for `.hivemind/` internal state.

### Pitfall 13: Not Storing `$` BunShell
**What goes wrong:** Only using raw `child_process` or `execSync` when BunShell `$` is provided with streaming, JSON parsing, env injection.
**Prevention:** Use `$` for all subprocess needs: `$\`git status\``, `$\`npx repomix\``, `$\`rg pattern\``.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Governance Foundation Fix (Phase 1) | #3 Bootstrap condition too narrow | Change LOCKED check to turn_count check |
| Governance Foundation Fix (Phase 1) | #4 Permissive mode contradiction | Add mode-aware signal filtering |
| SDK Integration (Phase 2) | #2 Client deadlock during init | Store reference, call from hooks only |
| SDK Integration (Phase 2) | #5 Not destructuring all inputs | Use ALL 6 PluginInput fields |
| Fast Extraction (Phase 3) | #12 Raw FS instead of SDK | SDK first, raw fs for .hivemind/ only |
| Framework Integration (Phase 3) | #10 Ignoring framework state | Read STATE.md/ROADMAP.md for alignment |
| Orchestration (Phase 4) | #1 Permission blocking temptation | NEVER block. Toast + argue-back only. |
| Self-Validation (Phase 5) | #7 Static argue-back | Dynamic rebuttals from message history |
| Stress Testing (Phase 6) | Missing edge cases | 10+ compaction test, concurrent sessions |

## Ecosystem Lessons (from 8 Plugin Repos)

| Plugin | Pitfall They Hit | Lesson for HiveMind |
|--------|-----------------|---------------------|
| oh-my-opencode | Client deadlock during init (#1301) | Store client, never call during init |
| zellij-namer | Not a real plugin (no SDK, raw child_process) | Use proper SDK patterns, not hacks |
| dynamic-context-pruning | `client: any` typing | Type correctly via `Parameters<Plugin>[0]['client']` |
| subtask2 | Complex state management across sessions | Module-level state with `setClient()` pattern |
| opencode-pty | Permission management complexity | Keep permissions simple, lean on SDK |
| plannotator | Agent detection via message history | Use `client.session.messages()` for evidence |
| micode | Constraint review session lifecycle | Clean create → prompt → delete pattern |
| opencode-worktree | Event-driven operations | Use `event` hook, not polling |

## NON-NEGOTIABLE PRINCIPLE

**Stop/deny/block = the absolute worst pattern for a plugin.**

Permission blocking will eventually clash with other plugins. It breaks the user's toolchain. It destroys trust. It makes HiveMind the plugin everyone uninstalls first.

HiveMind's power is in **awareness, not enforcement**:
- **Toast**: User SEES the warning (visual)
- **System prompt**: Agent READS the warning (behavioral)
- **Argue-back**: System CHALLENGES claims without evidence (accountability)
- **Tracking**: Everything is recorded for traceability (audit)

Zero plugins in the entire OpenCode ecosystem use `permission.ask` for blocking. That's not an accident — it's learned wisdom.

## Sources

- oh-my-opencode issue #1301 (deadlock documentation)
- 8 plugin codebases analyzed via Repomix
- HiveMind stress test results (ST11 conditional pass, ST12 fail)
- idumb-v2 system concepts diagram
- OpenCode SDK v1.1.53 type definitions
