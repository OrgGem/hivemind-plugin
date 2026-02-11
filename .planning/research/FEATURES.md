# Feature Landscape

**Domain:** AI Agent Context Governance Plugin (OpenCode ecosystem)
**Researched:** 2026-02-12
**Confidence:** HIGH (derived from SDK capabilities, 8 plugin codebases, idumb-v2 concepts, GSD/Spec-kit analysis)

## Table Stakes (Must Have — Agents Are Ungoverned Without These)

### 1. Session-Aware Governance (via SDK `client.session.*`)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Real session lifecycle tracking | Session = on-going plan. Without this, governance is guessing. | Med | `client.session.get()`, `client.event.subscribe()` for `session.created/idle/compacted` |
| Silent context injection | Inject governance context without triggering AI response | Low | `client.session.prompt({ noReply: true })` — verified pattern from plannotator |
| Session message history access | Evidence tracking — what did the agent actually say/do? | Low | `client.session.messages()` returns full message + parts history |
| Session diff tracking | Know what files changed in a session | Low | `session.diff` event, `client.session.diff()` |
| Multi-session awareness | Agent spawns subagents — governance must track the tree | High | `client.session.children()`, `client.session.list()` |

### 2. Visual Feedback (via SDK `client.tui.*`)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Toast notifications for governance events | User must SEE governance working — not buried in system prompt | Low | `client.tui.showToast({ body: { message, variant: "info"|"success"|"warning" } })` |
| Drift warning toasts | Visible drift alerts (not just system prompt injection) | Low | Toast with `variant: "warning"` when drift detected |
| Session health toasts | Periodic health status | Low | Toast on session idle showing turn count, drift score |
| Prompt suggestions | Suggest next HiveMind action via prompt append | Low | `client.tui.appendPrompt({ body: { text: "declare_intent..." } })` |

### 3. Codebase Awareness (via SDK `client.file.*` + `client.find.*`)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Text search (ripgrep) | Fast content search without custom tooling | Low | `client.find.text({ query: { pattern: "..." } })` — already ripgrep-powered |
| File discovery | Find files by pattern | Low | `client.find.files({ query: { query: "*.ts", type: "file" } })` |
| Symbol search | LSP-powered symbol lookup | Low | `client.find.symbols({ query: { query: "className" } })` |
| File reading | Read file contents through SDK | Low | `client.file.read({ query: { path: "src/index.ts" } })` |
| Git status | Track modified/staged files | Low | `client.file.status()` |

### 4. Event-Driven Governance (via SDK `event` hook)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Session lifecycle events | Know when sessions start/end/compact/error | Med | `session.created`, `session.idle`, `session.compacted`, `session.error` |
| File edit tracking | Know what files agent modified in real-time | Low | `file.edited`, `file.watcher.updated` events |
| Todo tracking | React to agent's TodoWrite changes | Low | `todo.updated` event |
| Command tracking | Know what slash commands were used | Low | `command.executed` event |
| VCS branch tracking | Git branch context for traceability | Low | `vcs.branch.updated` event |

### 5. Framework Integration (GSD + Spec-kit)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Framework detection | Auto-detect GSD (`.planning/`), Spec-kit (`.spec-kit/`) | Med | File marker detection like idumb-v2's framework-detector.ts |
| Framework-aware drift | Drift detection that understands framework artifacts | High | Reading STATE.md/ROADMAP.md to know what phase agent should be in |
| Framework alignment warnings | Toast when agent drifts from framework's current phase/plan | Med | Compare hierarchy focus vs framework state |

### 6. Core Governance (Existing — Must Survive v3)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| 3-level hierarchy (trajectory/tactic/action) | Context structure for agent focus | Existing | Keep — works well |
| 14 tools (declare_intent, map_context, etc.) | Agent-callable governance actions | Existing | Keep — extend with SDK awareness |
| Evidence gate system (4-tier escalation) | Argue-back when agent ignores warnings | Existing | Enhance with dynamic argue-back |
| Mems brain (persistent memory) | Cross-session knowledge | Existing | Enhance with SDK session data |
| Skills system (5 behavioral skills) | Teach agents governance discipline | Existing | Fix bootstrap (ST12) |

## Differentiators (What Sets HiveMind Apart)

### 1. SDK-Powered Session Intelligence

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Session auto-archive via SDK | Use `client.session.summarize()` to auto-summarize before compact | Med | Real summarization, not just last message capture |
| Cross-session memory linking | When new session created, inject relevant mems from brain | High | `session.created` event → `recall_mems` → `session.prompt({ noReply: true })` |
| Session health dashboard via toasts | Periodic governance health in visual toasts, not hidden in prompt | Low | Combines `showToast` with detection engine signals |
| Session diff evidence | Use `session.diff` to prove what agent actually changed (not what it claimed) | Med | Evidence discipline with real git diffs |

### 2. Smart Extraction (via BunShell `$`)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Repomix integration | One-command codebase packing: `$\`npx repomix --compress\`` | Med | Wrap repomix via BunShell, output to tool result |
| Targeted extraction | Combine `client.find.text()` + `client.file.read()` for precise context assembly | Med | Agent asks "what's relevant?" — HiveMind assembles the answer |
| Token-aware extraction | Count tokens before returning to agent | Med | Repomix `--token-count-tree` or manual tokenization |

### 3. Orchestration Awareness (Ralph Loop + GSD Patterns)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Loop state tracking | Track prd.json → story progression → completion | High | Persist loop state across compactions |
| Quality gate enforcement | After each story, verify quality gates via `$` | Med | Run test commands, report results via toast |
| Multi-agent coordination | Track parent→child session relationships | High | `client.session.children()`, `session.created` events |

### 4. Self-Validation Intelligence

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| IGNORED escalation tier | When agent repeatedly ignores governance warnings | Med | Track consecutive ignores, escalate visually via toasts |
| Dynamic argue-back | Context-specific counter-arguments (not static strings) | High | Read what agent is doing, generate specific rebuttals |
| `hivemind self-check` CLI | One command to validate entire system state | Med | Ecosystem check + brain validation + hierarchy integrity |

## Anti-Features (Things to Deliberately NOT Build)

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Permission blocking / tool denial** | Clashes with other plugins. Breaks user trust. Multiple plugins fighting over deny/allow = chaos. | Soft governance: inform via toast + system prompt, track via metrics, argue back with evidence. **NEVER stop tools.** |
| **Custom LLM calls from plugin** | Expensive, unpredictable, adds latency to every turn | Use SDK's existing `client.session.prompt()` for agent-to-agent, not raw LLM calls |
| **Heavy init-time operations** | Deadlock risk (oh-my-opencode #1301) — server blocks on plugin init | Store references during init, do work in hooks/tools only |
| **Plugin-to-plugin communication** | No SDK mechanism, fragile via filesystem | Self-contained design — HiveMind owns its state |
| **Replacing OpenCode's built-in tools** | Conflicts, confuses agents | Complement existing tools, add governance-specific ones |
| **Full message history rewriting** | `messages.transform` is powerful but dangerous | Use surgically: inject context messages, don't delete/reorder existing ones |

## Feature Dependencies

```
SDK Client Integration → Session Intelligence → Cross-Session Memory
SDK Client Integration → Visual Feedback (toasts)
SDK Client Integration → Codebase Awareness (find/file)
Event Hook → Event-Driven Governance → Framework Detection
BunShell ($) → Smart Extraction (repomix)
Framework Detection → Framework-Aware Drift
Core Governance (existing) → Evidence Gate Enhancement
Bootstrap Fix (ST12) → Teaching from Turn 0 (all modes)
```

## MVP Recommendation (Phase 1-2 Priority)

Prioritize:
1. **Bootstrap fix** (ST12) — governance must work in all modes from turn 0
2. **SDK client integration** — `client`, `$`, `project`, `serverUrl` in plugin init
3. **Toast notifications** — user SEES governance working
4. **Event-driven tracking** — replace turn-counting with real events
5. **Framework detection** — auto-detect GSD/Spec-kit

Defer:
- Orchestration control (Phase 4) — needs framework integration first
- Self-validation IGNORED tier (Phase 5) — needs event tracking first
- Stress test infrastructure (Phase 6) — needs everything else first

## Sources

- OpenCode SDK documentation (official)
- `@opencode-ai/plugin@1.1.53` + `@opencode-ai/sdk@1.1.53` type definitions
- 8 plugin codebases analyzed (dynamic-context-pruning, micode, oh-my-opencode, opencode-pty, opencode-worktree, zellij-namer, plannotator, subtask2)
- idumb-v2 system concepts diagram
- GSD framework analysis (30+ workflow files, 11 agent types)
- Ralph-tui skill definitions (PRD→beads/json loop patterns)
