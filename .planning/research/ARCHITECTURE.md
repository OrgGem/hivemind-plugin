# Architecture Patterns

**Domain:** AI Agent Context Governance Plugin (OpenCode ecosystem)
**Researched:** 2026-02-12
**Confidence:** HIGH (verified from SDK source, 8 plugin codebases, idumb-v2 concepts)

## Core Architecture: SDK-Powered Governance

The idumb-v2 diagram defines 4 pillars. The SDK client (`client.session`, `client.tui`, `client.file`, `client.find`, `client.event`) is the enabler for ALL of them.

```
┌─────────────────────────────────────────────────────────────────┐
│                    HiveMind Plugin (v3)                         │
│                                                                 │
│  PluginInput: { client, project, directory, worktree, $, url } │
│               ↓ store ref     ↓ store ref      ↓ store ref     │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Auto-Hooks & │  │   Session    │  │   Unique     │          │
│  │  Governance  │  │  Management  │  │ Agent Tools  │          │
│  │  (Triggers)  │  │ (Lifecycle)  │  │  (Utilities) │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                  │                  │
│         ▼                 ▼                  ▼                  │
│  ┌────────────────────────────────────────────────────┐         │
│  │              The 'Mems' Brain                      │         │
│  │         (Shared Knowledge Repository)              │         │
│  │    Shelves → Metadata → Just-in-Time Memory        │         │
│  └────────────────────────────────────────────────────┘         │
│                                                                 │
│  ┌────────────────────────────────────────────────────┐         │
│  │              SDK Client Layer                       │         │
│  │  client.session  client.tui  client.file           │         │
│  │  client.find     client.event  client.vcs          │         │
│  │  $ (BunShell)    client.app                        │         │
│  └────────────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

## Pillar 1: Auto-Hooks & Governance (Triggers & Rules)

**Maps to idumb-v2 concepts:** Time-to-Stale, Hierarchy Chain Breaking, Git Atomic Commits, Activate Agent Tools

### Component: Hook Router

| Hook | What It Does | SDK Feature Used |
|------|-------------|------------------|
| `tool.execute.before` | Track what agent is about to do. Warn if governance missing. **NEVER block.** | None (existing) |
| `tool.execute.after` | Track what agent did. Detect patterns. Auto-capture subagent results. | `client.tui.showToast()` for visual warnings |
| `experimental.chat.system.transform` | Inject `<hivemind>` block with hierarchy, signals, bootstrap | None (existing, enhanced) |
| `experimental.session.compacting` | Preserve hierarchy + inject purification context | `client.session.messages()` for pre-compaction message scan |
| `event` **NEW** | React to 32 event types: `session.idle`, `file.edited`, `session.diff`, `session.compacted` | `client.event.subscribe()` SSE stream |
| `chat.message` **NEW** | Inject context parts into user messages, tag with governance metadata | None (modifies `output.parts`) |
| `command.execute.before` **NEW** | Intercept `/compact`, `/clear` — preserve governance context | None (modifies `output.parts`) |
| `shell.env` **NEW** | Inject `HIVEMIND_SESSION_ID`, `HIVEMIND_MODE` into shell environment | None (modifies `output.env`) |

### Pattern: Time-to-Stale (via SDK Events)

```typescript
// CURRENT: Turn counting in brain.json (fragile, inaccurate)
// UPGRADED: Real event-driven staleness

event: async ({ event }) => {
  if (event.type === "session.idle") {
    // Agent stopped working — check how long since last map_context
    const staleness = detectStaleness(brain.hierarchy);
    if (staleness.level === "stale") {
      await client.tui.showToast({
        body: { message: `Session idle. Context stale (${staleness.age}).`, variant: "warning" }
      });
    }
  }
  if (event.type === "session.compacted") {
    // Context was compressed — hierarchy MUST survive
    await ensureHierarchyIntegrity(brain);
  }
  if (event.type === "file.edited") {
    // Track what files agent is touching
    brain.metrics.files_touched.push(event.file);
  }
}
```

### Pattern: Git Atomic Commits (via BunShell `$`)

```typescript
// Verify git state for traceability
const branch = await $`git rev-parse --abbrev-ref HEAD`.text();
const hash = await $`git rev-parse --short HEAD`.text();
brain.session.git_context = { branch: branch.trim(), hash: hash.trim() };
```

## Pillar 2: Session Management & Auto-Export (Lifecycle)

**Maps to idumb-v2 concepts:** Session = On-going Plan, Auto-Export of Whole Session, Long Session Handling, Session Structure

### Component: Session Intelligence (via SDK `client.session.*`)

```
Session Lifecycle:
  session.created → Initialize governance (inject context silently)
  session.idle → Check staleness, suggest actions
  session.compacted → Preserve hierarchy, verify integrity
  session.error → Log error, set blocked status
  session.deleted → Archive session data
```

**Key SDK capabilities used:**

| Method | Purpose in HiveMind |
|--------|---------------------|
| `client.session.get({ path: { id } })` | Get session metadata (title, timestamps, status) |
| `client.session.messages({ path: { id } })` | Read full message history — evidence for claims |
| `client.session.prompt({ path: { id }, body: { noReply: true, parts } })` | **Silent context injection** — inject governance context without triggering AI response |
| `client.session.children({ path: { id } })` | Track subagent sessions for delegation intelligence |
| `client.session.diff({ path: { id } })` | Get actual file diffs — evidence for what agent changed |
| `client.session.summarize({ path: { id }, body })` | Auto-summarize session before archiving |
| `client.session.list()` | Multi-session awareness |

### Pattern: Auto-Export via SDK

```typescript
// On compact_session tool call:
async function autoExport(sessionId: string) {
  // 1. Get real messages from SDK (not from system prompt memory)
  const messages = await client.session.messages({ path: { id: sessionId } });
  
  // 2. Get actual file diffs
  const diffs = await client.session.diff({ path: { id: sessionId } });
  
  // 3. Auto-summarize via SDK
  await client.session.summarize({ path: { id: sessionId }, body: {} });
  
  // 4. Archive to .hivemind/sessions/archive/ with real data
  // 5. Save key findings to mems brain
}
```

### Pattern: Long Session Handling (Compaction Survival)

```typescript
// experimental.session.compacting hook:
async ({ sessionID }, output) => {
  // Read current hierarchy from brain
  const hierarchy = readHierarchy(directory);
  
  // Read last N messages to understand what agent was doing
  const messages = await client.session.messages({ path: { id: sessionID } });
  const recentMessages = messages.slice(-5);
  
  // Inject rich context (not just flat strings)
  output.context.push(formatHierarchyForCompaction(hierarchy));
  output.context.push(formatRecentWorkSummary(recentMessages));
  
  // Optional: customize compaction prompt itself
  // output.prompt = customCompactionPrompt; // replaces default
}
```

## Pillar 3: Unique Agent Tools (Hook-Activated Utilities)

**Maps to idumb-v2 concepts:** Hierarchy Reading Tools, Fast Read/Extract, Precision Extraction, Thinking Frameworks

### Component: SDK-Enhanced Tools

| Tool | Current | Enhanced with SDK |
|------|---------|-------------------|
| `declare_intent` | Sets focus in brain.json | + `client.tui.showToast()` confirmation |
| `map_context` | Updates hierarchy | + `client.tui.showToast()` with current tree |
| `compact_session` | Archives to files | + `client.session.summarize()` + `client.session.messages()` for real export |
| `scan_hierarchy` | Reads brain.json | + `client.session.get()` for session metadata |
| `check_drift` | Reads detection engine | + `client.session.diff()` for evidence-based drift assessment |
| `self_rate` | Agent self-assessment | + `client.tui.showToast()` with rating feedback |
| `export_cycle` | Captures subagent results | + `client.session.children()` for real child session data |

### Component: Fast Extraction Tools (NEW — via BunShell + SDK)

| Tool | Implementation | Notes |
|------|----------------|-------|
| `hivemind_grep` | `client.find.text({ query: { pattern } })` | SDK-native ripgrep, structured output |
| `hivemind_glob` | `client.find.files({ query: { query: pattern } })` | SDK-native file search |
| `hivemind_read` | `client.file.read({ query: { path } })` | SDK-native file read, patch-aware |
| `hivemind_extract` | `$\`npx repomix --compress --include ${pattern}\`.text()` | Repomix via BunShell for codebase packing |
| `hivemind_symbols` | `client.find.symbols({ query: { query } })` | LSP-powered symbol lookup |
| `hivemind_status` | `client.file.status()` | Git file status |

## Pillar 4: The 'Mems' Brain (Shared Knowledge Repository)

**Maps to idumb-v2 concepts:** Shared Brain (Mems share one) → Atomic Git, Main Shelves, Meta Data & IDs, Just-in-Time Memory

### Component: SDK-Enhanced Memory

| Concept | Current | Enhanced with SDK |
|---------|---------|-------------------|
| Shared Brain | `.hivemind/mems/` files | + Cross-session: on `session.created` event, auto-inject relevant mems via `prompt({ noReply: true })` |
| Just-in-Time Memory | `recall_mems` tool | + `client.session.messages()` to search past sessions for relevant context |
| Meta Data & IDs | Timestamps + brain.json | + `client.vcs.get()` for git branch, `client.project.current()` for project metadata |

## Framework Integration Architecture

### Pattern: Framework Detection

```typescript
// Detect which governance framework is active
async function detectFramework(directory: string): Promise<Framework> {
  const files = await client.find.files({ query: { query: ".planning", type: "directory" } });
  if (files.length > 0) return { type: "gsd", stateFile: ".planning/STATE.md" };
  
  const specKit = await client.find.files({ query: { query: ".spec-kit", type: "directory" } });
  if (specKit.length > 0) return { type: "spec-kit", stateFile: ".spec-kit/state.json" };
  
  return { type: "none" };
}
```

### Pattern: Framework-Aware Drift Detection

```typescript
// Compare HiveMind hierarchy with GSD state
async function checkFrameworkAlignment(framework: Framework) {
  if (framework.type === "gsd") {
    const stateContent = await client.file.read({ query: { path: ".planning/STATE.md" } });
    const currentPhase = parseGSDPhase(stateContent);
    const hivemindFocus = brain.hierarchy.trajectory;
    
    if (!focusMatchesPhase(hivemindFocus, currentPhase)) {
      await client.tui.showToast({
        body: { 
          message: `⚠ HiveMind focus "${hivemindFocus}" doesn't match GSD Phase ${currentPhase.number}`, 
          variant: "warning" 
        }
      });
    }
  }
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Permission Blocking
**What:** Using `permission.ask` hook to set `output.status = "deny"`
**Why bad:** Multiple plugins fighting over deny/allow = chaos. Other plugins WILL clash. User loses trust.
**Instead:** Toast warnings, system prompt escalation, evidence-based argue-back. **NEVER stop tools.**

### Anti-Pattern 2: Heavy Init
**What:** Calling `client.*` during plugin init function
**Why bad:** Deadlock — server blocks on plugin init before handling API requests (oh-my-opencode #1301)
**Instead:** Store `client` reference during init, call from hooks/tools only

### Anti-Pattern 3: Raw LLM Calls
**What:** Making direct API calls to LLM providers from plugin
**Why bad:** Expensive, unpredictable latency, token costs on every turn
**Instead:** Use `client.session.prompt()` for agent-to-agent communication

### Anti-Pattern 4: Filesystem Hacks for SDK Features
**What:** Using `fs.readFileSync` when `client.file.read()` exists, or spawning `grep` when `client.find.text()` exists
**Why bad:** Bypasses SDK's project boundaries, sandbox awareness, structured output
**Instead:** SDK first, raw fs only for `.hivemind/` internal state

### Anti-Pattern 5: Full Message History Rewriting
**What:** Using `messages.transform` to delete or reorder entire conversation history
**Why bad:** Unpredictable agent behavior, breaks other plugins' context, confuses user
**Instead:** Use `messages.transform` surgically — inject context messages only

## Data Flow

```
User → Agent → Tool Call
                  ↓
            tool.execute.before (track intent)
                  ↓
            [Tool executes]
                  ↓
            tool.execute.after (track result, detect patterns)
                  ↓
            Detection Engine → Signals
                  ↓
     ┌────────────┴────────────┐
     ↓                         ↓
System Prompt                 Toast
(next turn)             (immediate visual)
     ↓                         ↓
Agent sees <hivemind>    User sees warning
block with signals       in TUI
```

## Plugin Ecosystem Patterns (Learned from 8 Repos)

| Plugin | Key Pattern Learned | Apply to HiveMind |
|--------|--------------------|--------------------|
| oh-my-opencode | Internal hook system (41 hooks) + SDK client for toasts + serverUrl health checks | Modular internal hook architecture. Toast notifications for governance events. |
| subtask2 | `setClient(ctx.client)` stored in module state. Comment: "Use v1 client — has internal fetch configured properly" | Store client reference safely. Trust SDK's HTTP client. |
| opencode-pty | `PluginClient = Parameters<Plugin>[0]['client']` type pattern. `showToast()` for notifications. | Clean type derivation. Toast for session events. |
| plannotator | `client.session.messages()` to detect agent context. `prompt({ noReply: true })` for silent injection. | Evidence tracking via message history. Silent governance context injection. |
| dynamic-context-pruning | Prune/distill/compress tools + system prompt handler + message transform | Context management patterns. System prompt injection structure. |
| micode | `client.session.create()` + `prompt()` + `delete()` for constraint review | Spawn review sessions programmatically for self-validation. |
| opencode-worktree | `Event` type from SDK for session.idle. Event-driven operations. | Event-driven architecture pattern. |
| zellij-namer | External process via child_process (NOT using BunShell) | Lesson: use `$` BunShell instead of raw child_process for better integration. |

## Sources

- idumb-v2 system concepts diagram (provided by user)
- OpenCode SDK v1.1.53 documentation (official)
- 8 plugin codebases analyzed via Repomix (stored in `.planning/research/plugin-refs/`)
- GSD framework analysis (30+ workflows)
- oh-my-opencode deadlock issue #1301
