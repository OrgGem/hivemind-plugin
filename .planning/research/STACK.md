# Technology Stack

**Project:** HiveMind v3 — Context Governance Plugin for OpenCode
**Researched:** 2026-02-12
**Confidence:** HIGH (verified from SDK source, 8 real plugin codebases, official docs)

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| OpenCode Plugin SDK | 1.1.53 | Plugin interface, hooks, tool registration | THE platform — plugins receive `client`, `$`, `project`, `serverUrl`. All capabilities flow from here. |
| OpenCode SDK Client | 1.1.53 | Sessions, TUI, Files, Find, Events | **VERIFIED USABLE from plugins.** 5 of 8 ecosystem plugins use it. Enables real session management, toast notifications, file reads, text search — the foundations of governance. |
| BunShell (`$`) | Built-in | Subprocess spawning (repomix, rg, git) | Provided as `input.$`. Tagged template syntax: `` $`repomix --output -`.text() ``. Streaming, JSON parsing, env injection. |
| TypeScript | 5.x | Type-safe implementation | Already in use. Zod v4 for tool schemas. |
| Node.js TAP | 21.x | Test framework | Already in use (705 assertions). Keep for consistency. |

### SDK Client API Surface (What We Can Use)

| Client | Key Methods | HiveMind Use Case |
|--------|-------------|-------------------|
| `client.session` | `list`, `create`, `get`, `messages`, `prompt({ noReply: true })`, `abort`, `diff`, `summarize` | **Session = On-going Plan.** Real session lifecycle, not file-based simulation. Inject context silently via `noReply: true`. Read message history for evidence tracking. |
| `client.tui` | `showToast`, `appendPrompt`, `executeCommand` | **Visual governance feedback.** Toast for drift warnings, argue-back, evidence reminders. Prompt append for suggested next actions. |
| `client.file` | `read`, `status` | **Structured file access.** Read files through SDK (not raw fs). Git status for change tracking. |
| `client.find` | `text`, `files`, `symbols` | **Fast extraction.** Ripgrep-powered text search, file discovery, LSP symbols — no need to build our own grep/glob. |
| `client.event` | `subscribe` (SSE) | **Event-driven governance.** Subscribe to 32 event types: `session.created`, `session.idle`, `file.edited`, `session.diff`, `session.compacted` — replace turn-counting with real events. |
| `client.app` | `log`, `agents` | **Observability.** Write structured logs, list available agents for team-awareness. |
| `client.vcs` | `get` | **Git context.** Branch info for traceability (git hash + timestamp). |
| `client.project` | `current` | **Project context.** Project metadata for multi-project awareness. |

### Hooks We Should Use (14 available, currently using 5)

| Hook | Priority | Purpose | Currently Used? |
|------|----------|---------|-----------------|
| `tool.execute.before` | Core | Track what agent is about to do | YES |
| `tool.execute.after` | Core | Track what agent did, detect patterns | YES |
| `experimental.chat.system.transform` | Core | Inject governance context into system prompt | YES |
| `experimental.session.compacting` | Core | Preserve hierarchy across compaction | YES |
| `event` | **NEW — HIGH** | React to 32 event types — session lifecycle, file edits, idle detection, diffs | NO |
| `chat.message` | **NEW — HIGH** | Inject context parts into user messages, tag with metadata | NO |
| `experimental.chat.messages.transform` | **NEW — MEDIUM** | Custom context management, inject synthetic messages | NO |
| `command.execute.before` | **NEW — MEDIUM** | Intercept slash commands, add hivemind-aware behavior | NO |
| `shell.env` | **NEW — LOW** | Inject `HIVEMIND_SESSION_ID`, `HIVEMIND_MODE` into shell env | NO |
| `chat.params` | Future | Adjust LLM temperature by governance mode | NO |
| `config` | Future | React to config changes in real-time | NO |
| `permission.ask` | **NEVER** | Block tool execution | NO — **ANTI-PATTERN: never block, never deny, never clash with other plugins** |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Repomix | latest | Codebase packing (via `$` BunShell) | Fast extraction: `$\`npx repomix --compress --output -\`.text()` |
| Ink | 5.x | TUI dashboard (already built) | CLI `hivemind dashboard` — keep as-is |
| Zod | 4.x | Tool schema validation | Built into plugin SDK for tool definitions |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not Alternative |
|----------|-------------|-------------|---------------------|
| File search | `client.find.text()` (SDK) | Custom rg wrapper | SDK already wraps ripgrep with structured output. Don't reinvent. |
| File read | `client.file.read()` (SDK) | Raw `fs.readFileSync` | SDK provides patch-aware reads, respects project boundaries. Raw fs still needed for .hivemind/ internal state. |
| User feedback | `client.tui.showToast()` | Console.log / system prompt only | Toast is VISUAL — user sees it in TUI immediately. System prompt is invisible to user. Both needed. |
| Session tracking | `client.session.*` + `client.event` | Turn counting in brain.json | Real events > counting. `session.idle` tells you agent stopped. `session.diff` gives you what changed. `session.compacted` tells you context was compressed. |
| Process spawning | `$` BunShell | `child_process.exec` | BunShell is provided by plugin SDK, has streaming, JSON parsing, env injection built-in. |
| Permission blocking | **NEVER** | `permission.ask` → `deny` | **Clashes with other plugins. Breaks user trust. Soft governance only.** |

## Plugin Input Destructuring (Current vs Target)

```typescript
// CURRENT (v2.6.0) — only uses 2 of 6 inputs
export const HiveMindPlugin: Plugin = async ({ directory, worktree }) => { ... }

// TARGET (v3) — use ALL inputs
export const HiveMindPlugin: Plugin = async ({ 
  client,       // SDK client — sessions, TUI, files, events
  project,      // Project metadata
  directory,    // Project directory
  worktree,     // Git worktree root
  serverUrl,    // OpenCode server URL
  $,            // BunShell for subprocesses
}) => { ... }
```

**CAVEAT:** Do NOT call `client.*` during plugin init (deadlock risk — oh-my-opencode issue #1301). Store reference, use from hooks/tools only.

## SDK Reference (Downloaded)

Reference material stored at `.planning/research/plugin-refs/`:
- `opencode-sdk.xml` — Official OpenCode SDK + Plugin source (compressed, 53 files)
- 8 plugin repos for pattern reference (see ARCHITECTURE.md for analysis)

## Sources

- `@opencode-ai/plugin@1.1.53` type definitions (HIGH confidence)
- `@opencode-ai/sdk@1.1.53` type definitions (HIGH confidence)
- 8 real plugin codebases via Repomix (HIGH confidence)
- OpenCode SDK documentation (HIGH confidence)
- oh-my-opencode deadlock issue #1301 (HIGH confidence — verified in test code)
