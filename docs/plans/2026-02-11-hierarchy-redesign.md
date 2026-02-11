# Hierarchy Architecture Redesign

**Date:** 2026-02-11
**Status:** Design approved, ready for implementation
**Pre-requisite for:** Phase 7.2b Stress Test

---

## Problem

The current hierarchy is 3 flat strings in `brain.json`:

```json
{ "trajectory": "...", "tactic": "...", "action": "..." }
```

When `map_context` is called, old values are silently overwritten. No parent-child relationships. No history. `active.md` is a flat append log with no structure. `max_active_md_lines` config is dead code — no housekeeping exists.

## Design Philosophy

All HiveMind capabilities follow the **Export → Store → Trigger → Read-back** cycle:

1. **Tools are one-shot.** They fire, run internal scripts to handle complexity, export worthy data to brain, and are done.
2. **Brain is the persistent store.** Hierarchy tree, turning points, anchors, mems — all survive turns, compactions, sessions.
3. **Hooks watch thresholds.** When counters hit configured limits, hooks inject alerts into the system prompt telling the agent to act.
4. **Read-back tools retrieve distilled data.** Not full history — only the turning points, the current tree position, the essential context for the agent to redirect thought.

Tools that involve long-haul sessions are NOT permanent utilities. They are one-timers that help worthy data get exported. The hooks then trigger read-back at the right moment.

Scripts live INSIDE tools as internal helpers. The agent discovers the tool, not the script. Multiple tool branches can pack into one file — the agent picks which branch. Results flow to brain.

## Non-Negotiable Constraints

1. **Markdown is a rendered view, not source of truth.** JSON backs the hierarchy. `active.md` is regenerated from the tree.
2. **Anti-schema-dependency.** Tools are one-shot. If it requires the agent to follow a multi-step protocol, it will fail. Scripts inside tools handle multi-step complexity.
3. **No free-floating libraries.** Scripts show their entry point — which tool owns them. Discoverable, not hidden.
4. **Gradual evolution.** Each new capability follows the cycle pattern. Build incrementally.

---

## Timestamp Architecture — Cross-Session Traceability

### The Problem: Nothing Persists Across Sessions

Two things we CANNOT do:
1. **Force agent reasoning.** A session 2 agent has zero memory of session 1's logic. Prompt injection helps, but can't guarantee reasoning continuity.
2. **Persist tools across sessions.** Tools fire once and die. No tool instance survives a session boundary.

**What DOES survive? Text on disk.** Grep-able, regex-searchable text patterns.

### Timestamp Format as Universal Linker

Format: `MiMiHrHrDDMMYY` — e.g., `30141102026` = 14:30 on Feb 11, 2026

The timestamp is NOT just an ID — it's the **connective tissue** that links every artifact across the system:

```
hierarchy.json   →  node.id: "t_30141102026"
active.md        →  ## 30141102026 — Build auth system [ACTIVE]
archive/         →  session_30141102026.md
anchors.json     →  anchor.session_stamp: "30141102026"
mems.json        →  mem.context: "30141102026"
git log          →  commit msg: "[30141102026] auth middleware complete"
```

**Any agent, any session, any tool** can `grep 30141102026` across all artifacts and get the FULL chain — hierarchy nodes, anchors, mems, archives, commits. All linked by one searchable string. No state machine. No tool persistence. Just text patterns.

### Staleness via Timestamp Gaps (Not Counters)

Chain breaking becomes **time-relational** — the gap between sibling/parent-child timestamps reveals drift:

```
Node: t_30141102026 (root, created 14:30)
  └── tc_45141102026 (tactic, created 14:45) — 15 min gap ← healthy
      ├── a_00151102026 (action, created 15:00) — 15 min gap ← healthy
      └── a_30181102026 (action, created 18:30) — 3.5 HOUR gap ← stale
```

A counter says "5 turns since last update." A timestamp says "3.5 hours of silence between siblings — context was likely lost." The timestamp encodes WHEN the drift happened and HOW LONG the gap was, which a counter never can.

### Cross-Session Tracing

Session 1 agent exports:
```markdown
## 30141102026 — Build auth system
├── 45141102026 — Set up JWT ✅
└── 00151102026 — Write middleware 🔨
```

Session 1 dies. Session 2 starts. New agent. Zero memory.

The hook (`session-lifecycle.ts`) reads `hierarchy.json`, sees the timestamps, and injects:
```
<hivemind>
Last trajectory: 30141102026 — Build auth system
Cursor: 00151102026 — Write middleware
Gap since last activity: 4 hours
Trace: grep 30141102026 for full context chain
</hivemind>
```

Session 2 agent can now grep that timestamp and reconstruct the full decision trail. Not by reasoning. By text search. The timestamp IS the cross-session persistence mechanism.

### Node ID Format

```
{level_prefix}_{MiMiHrHrDDMMYY}

Level prefixes:
  t_   = trajectory
  tc_  = tactic
  a_   = action

Examples:
  t_30141102026     trajectory created at 14:30 on Feb 11, 2026
  tc_45141102026    tactic created at 14:45 on Feb 11, 2026
  a_00151102026     action created at 15:00 on Feb 11, 2026
```

The `MiMiHrHrDDMMYY` format is:
- Sortable within a day (minute-hour prefix)
- Unique enough for practical use (minute resolution)
- Human-readable when you know the format
- Regex-searchable: `\d{10,11}` or exact match

---

## Data Model: `.hivemind/hierarchy.json`

```typescript
interface HierarchyNode {
  id: string                    // e.g., "t_30141102026" (MiMiHrHrDDMMYY)
  level: "trajectory" | "tactic" | "action"
  content: string
  status: "pending" | "active" | "complete" | "blocked"
  created: number               // epoch ms (for computation)
  stamp: string                 // MiMiHrHrDDMMYY (for tracing/grep)
  completed?: number            // epoch ms, set on completion
  summary?: string              // set by janitor when branch is pruned
  children: HierarchyNode[]
}

interface HierarchyTree {
  version: 1
  root: HierarchyNode | null
  cursor: string | null         // ID of current working node
}
```

**Key properties:**
- Tree, not flat — children nested under parents
- `cursor` — always points to current working node
- `stamp` (MiMiHrHrDDMMYY) — the grep-able cross-session linker
- `created` (epoch ms) — for staleness computation and gap detection
- `summary` — janitor replaces pruned branches with a summary string
- Staleness is derived from timestamp gaps between related nodes, not from counters

## Tool Changes

### Existing tools — same API, new internals

| Tool | Args Change | Internal Change |
|------|-------------|-----------------|
| `declare_intent` | None | Creates root node in tree, sets cursor, renders `active.md` from tree |
| `map_context` | None | Creates child node under correct parent, moves cursor, renders tree view |
| `compact_session` | None | Archives `hierarchy.json` alongside `active.md`, resets tree |
| `scan_hierarchy` | None | Renders ASCII tree with cursor marker instead of flat strings |
| `think_back` | None | Same tree view + chain analysis adapted for tree |
| `check_drift` | None | Reads metrics, no hierarchy dependency |

### New tool branches — `src/tools/hierarchy.ts`

Multiple tools packed in one file. Each is a one-shot that exports to brain.

| Branch | Agent Discovers As | When It Fires | What It Exports |
|--------|-------------------|---------------|-----------------|
| `hierarchy_prune` | "Clean completed branches" | Hook alerts: completed count > threshold | Cleaned tree → brain |
| `hierarchy_migrate` | "Convert flat to tree" | Hook alerts: no hierarchy.json found | Tree → brain |

### Unchanged tools

`self_rate`, `save_anchor`, `save_mem`, `list_shelves`, `recall_mems` — no hierarchy dependency.

## Programmatic Detection & Prompt Transformation

### The Mechanism

We CANNOT stop agent execution. What we CAN do: `experimental.chat.system.transform` fires every turn and lets us APPEND information to the system prompt. Anything we detect programmatically becomes appended context that reshapes the agent's next decision.

**Timestamps and counters are complementary layers:**
- **Timestamps** = cross-session persistence (grep-able text on disk, survives everything)
- **Counters** = intra-session programmatic triggers (hooks detect live patterns, append to prompt)

Both feed the same system: **detect → append to prompt → agent behavior shifts.**

### Detection Signals (Exploited Programmatically)

Everything that fires in `tool.execute.after` or reads from `brain.json` is a detection source:

| Signal | Detection Method | Prompt Transformation |
|--------|-----------------|----------------------|
| **Turn count per section** | Counter: incremented in `tool.execute.after`, reset on `map_context` | "⚠ 8 turns on auth middleware. Checkpoint your decisions?" |
| **Tool type frequency** | Counter: classify tool as read/write/query in `tool.execute.after` | "Pattern: 12 reads, 0 writes. Still exploring or stuck?" |
| **Failure accumulation** | Counter: track consecutive tool errors in `tool.execute.after` | "3 consecutive tool failures. Step back and reassess?" |
| **Keyword/synonym clustering** | Keyword match: scan tool args for stuck/confused/retry/loop patterns | "Detected repeated 'retry' signals. Use think_back to refocus?" |
| **Section repetition** | Counter: detect N updates to same tactic with ~same content | "Tactic updated 4x with similar content. Circling?" |
| **Tool-to-hierarchy mismatch** | Compare: write tools firing but no action declared in hierarchy | "Writing files but no action declared in hierarchy." |
| **Timestamp gap** | Gap computation: compare current time vs last hierarchy node stamp | "4hr gap since last node. Context may be lost. Use scan_hierarchy?" |
| **Completed branch pileup** | Counter: count completed leaf nodes in tree | "5 completed branches. Run hierarchy_prune to clean up." |
| **Missing tree** | File check: no hierarchy.json but brain.json has flat data | "Run hierarchy_migrate to upgrade to tree structure." |

### Where Detection Lives

**`soft-governance.ts` (tool.execute.after)** — the COUNTER engine:
- Fires after EVERY tool call
- Increments turn counters, tracks tool types, detects failures
- Writes detection state to `brain.json.metrics`
- Does NOT transform prompts directly — stores signals for next transform cycle

**`session-lifecycle.ts` (system.transform)** — the PROMPT engine:
- Fires EVERY turn before the LLM sees the prompt
- Reads all counters and detection state from `brain.json`
- Reads timestamp gaps from `hierarchy.json`
- Compiles detected signals into appended `<hivemind>` warnings
- Budget-capped — highest severity signals get priority

### Brain Metrics Schema (Extended)

```typescript
interface MetricsState {
  // Existing
  turn_count: number
  drift_score: number
  files_touched: string[]
  context_updates: number
  ratings: SelfRating[]
  auto_health_score: number
  total_tool_calls: number
  successful_tool_calls: number
  violation_count: number

  // NEW — Detection counters
  consecutive_failures: number           // reset on success
  consecutive_same_section: number       // reset on section change
  last_section_content: string           // detect repetition
  tool_type_counts: {                    // per-session tool usage pattern
    read: number
    write: number
    query: number
    governance: number
  }
  keyword_flags: string[]               // detected keywords this session
}
```

### Detection Flow

```
Agent calls tool
        │
        ▼
tool.execute.after fires
        │
        ├── increment turn_count
        ├── classify tool type (read/write/query/governance)
        ├── check: was tool successful? → reset or increment consecutive_failures
        ├── check: same hierarchy section? → increment or reset consecutive_same_section
        ├── scan tool args for keyword patterns (stuck, retry, confused, loop)
        ├── write updated counters to brain.json
        │
        ▼
(next turn)
        │
        ▼
system.transform fires
        │
        ├── read brain.json counters
        ├── read hierarchy.json timestamps (gap detection)
        ├── compile active signals into warnings
        ├── priority-sort by severity
        ├── budget-cap the <hivemind> block
        ├── APPEND to system prompt
        │
        ▼
Agent sees transformed prompt
        │
        ▼
Agent's next decision is informed by detection signals
```

## Hook Changes

### `session-lifecycle.ts` (system.transform)

Now serves as the **prompt compilation engine**. Reads all detection signals and timestamp gaps, compiles into budget-capped `<hivemind>` block:

- Hierarchy section: ASCII tree excerpt (from hierarchy.json)
- Warning section: compiled from counter thresholds + timestamp gaps
- Alert section: one-shot tool recommendations (prune, migrate, checkpoint)
- **Post-compaction detection**: compares `brain.json.last_compaction_time` vs `brain.json.session.last_activity`. If compaction happened since last tool call → inject purification alert into `<hivemind>` block. This is the BACKUP trigger — the compaction hook injects the alert into the compaction prompt, but if the agent misses it, the system.transform catches it next turn.

### `soft-governance.ts` (tool.execute.after)

Now serves as the **counter/detection engine**. Fires after every tool call:

- Classifies tool type (read/write/query/governance)
- Tracks consecutive failures, section repetition, keyword patterns
- Writes all counters to `brain.json.metrics`
- Detection only — no prompt transformation here

### `compaction.ts`

Now implements the **compaction-triggered purification loop**.

#### The Mechanism

We have two compaction hooks available (from OpenCode docs):
- `output.context.push(...)` — append context to compaction prompt
- `output.prompt = ...` — REPLACE the entire compaction prompt

We use BOTH at different stages:

#### Stage 1: Compaction fires

The `experimental.session.compacting` hook reads `brain.json` for a **next-compaction report** (if one was written by a previous purification cycle). If found:

```typescript
// Previous purification subagent wrote this report to brain.json
const report = brain.next_compaction_report
if (report) {
  output.prompt = report  // REPLACE compaction prompt with curated instructions
} else {
  // First compaction — use default, inject hierarchy context
  output.context.push(hierarchyContext)
  output.context.push("ALERT: Post-compaction — launch context purification task immediately.")
}
```

#### Stage 2: Post-compaction message

The LLM generates a continuation summary. The FIRST message the agent sees after compaction includes the alert (either from the custom prompt or from context injection). The agent reads:

```
ALERT: Context was compacted. You MUST:
1. Launch a Task subagent for context purification
2. The subagent must use hierarchy_read to scan the tree
3. The subagent must return:
   a. Clean context plan (distilled turning points + current position)
   b. Next-compaction report (what to preserve when THIS session compacts next)
```

#### Stage 3: Purification subagent

The agent spawns a Task subagent. The subagent:

1. **Fast-reads** the session file, hierarchy tree, and brain state
2. **Identifies turning points** — decisions that changed direction, not routine progress
3. **Updates PORTIONS** of the session file (append-only guard enforced)
4. **Returns two artifacts**:

**Artifact A — Clean Context Plan** (injected into agent's working context):
```
Current trajectory: Build auth system (t_30141102026)
Active tactic: Write middleware (tc_00151102026) — 3hr since last activity
Turning points:
  - Decided JWT over session tokens (turn 12)
  - Switched from passport to jose (turn 15)
  - Moved auth to middleware layer (turn 18)
Next action needed: Create auth route handler
```

**Artifact B — Next-Compaction Report** (written to `brain.json.next_compaction_report`):
```
When this session compacts next, preserve:
- Trajectory: Build auth system (t_30141102026)
- Critical decision: JWT + jose + middleware pattern
- Current state: auth route handler in progress
- Files: src/auth/middleware.ts, src/auth/jwt.ts
- DO NOT preserve: exploration of passport (abandoned turn 15)
```

#### Stage 4: Self-refining loop

Next compaction reads `brain.json.next_compaction_report` → uses it as `output.prompt` → the LLM generates a continuation summary focused on exactly what matters → the cycle repeats with better focus each time.

```
Compaction 1: generic context injection (broad, noisy)
    → purification subagent writes targeted report
Compaction 2: custom prompt from report (focused)
    → purification subagent refines further
Compaction 3: even more focused prompt
    → each cycle distills signal from noise
```

#### Brain Schema Addition

```typescript
interface BrainState {
  // ...existing fields
  next_compaction_report: string | null  // Written by purification subagent
  compaction_count: number               // How many compactions this session
  last_compaction_time: number           // Epoch ms — used for gap detection
}
```

### `tool-gate.ts`

No change — checks governance status, not hierarchy.

## Engine: `src/lib/hierarchy-tree.ts`

ONE module. Sectioned with JSDoc. Every function shows its consumer.

```
Section 1: Types (HierarchyNode, HierarchyTree, TreeStats, TimestampGap)
Section 2: Stamps (generateStamp, parseStamp, stampToEpoch)
Section 3: Tree CRUD (createNode, addChild, moveCursor, markComplete)
Section 4: Queries (findNode, getAncestors, getCursorNode, toBrainProjection)
Section 5: Staleness (detectGaps, computeSiblingGap, computeParentChildGap)
Section 6: Rendering (toAsciiTree, toActiveMdBody, getTreeStats)
Section 7: Janitor (pruneCompleted, summarizeBranch, countCompleted)
Section 8: I/O (loadTree, saveTree, treeExists)
Section 9: Migration (migrateFromFlat)
```

## Detection Engine: `src/lib/detection.ts`

ONE module. Pure functions for programmatic signal detection.

```
Section 1: Types (DetectionSignal, ToolClassification)
Section 2: Tool Classification (classifyTool → read/write/query/governance)
Section 3: Counter Logic (incrementSection, detectRepetition, trackFailure)
Section 4: Keyword Scanning (scanForKeywords — stuck, retry, confused, loop)
Section 5: Signal Compilation (compileSignals → sorted warnings for prompt injection)
```

Used by:
- `soft-governance.ts` → Sections 2-4 (detection, writes to brain)
- `session-lifecycle.ts` → Section 5 (compilation, reads from brain, appends to prompt)

### Staleness Detection (Section 5)

Replaces counter-based drift with timestamp gap analysis:

```typescript
// Detects time gaps between related nodes
// → Used by: think_back (chain breaks), session-lifecycle hook (drift alerts)

interface TimestampGap {
  from: string       // node stamp
  to: string         // sibling/child stamp
  gapMs: number      // gap in milliseconds
  relationship: "sibling" | "parent-child"
  severity: "healthy" | "warm" | "stale"  // <30min | <2hr | >2hr
}

function detectGaps(tree: HierarchyTree): TimestampGap[]
function computeSiblingGap(a: HierarchyNode, b: HierarchyNode): TimestampGap
function computeParentChildGap(parent: HierarchyNode, child: HierarchyNode): TimestampGap
```

## Session File Architecture — Per-Session, Not Singletons

### The Problem with Current Architecture

Today `index.md` and `active.md` are singletons:
- `index.md` — ONE file that grows forever via `updateIndexMd()` appending lines
- `active.md` — ONE file that gets fully overwritten by `declare_intent` every session

This is wrong for three reasons:
1. No session isolation — all sessions stomp on the same file
2. No traceability — can't diff session 1 vs session 2
3. No template regulation — each tool writes whatever format it wants

### New Architecture: Templates + Per-Session Instances

What we SHIP is a **template**. Each session INSTANTIATES from it.

```
.hivemind/
├── templates/
│   └── session.md              ← THE template (regulates structure)
├── sessions/
│   ├── 30141102026.md          ← session 1 (instantiated from template)
│   ├── 15201102026.md          ← session 2 (instantiated from template)
│   ├── manifest.json           ← registry: stamp → session file + status
│   └── archive/
│       └── 30141102026.md      ← archived when compacted
├── hierarchy.json              ← tree (JSON source of truth)
├── brain.json                  ← session state + metrics + counters
└── config.json                 ← governance settings
```

### Template: `templates/session.md`

Regulates: naming convention, ID format, YAML heading structure, section order.

```markdown
---
session_id: ""                    # MiMiHrHrDDMMYY stamp
stamp: ""                         # same, for grep tracing
mode: ""                          # plan_driven | quick_fix | exploration
governance_status: "LOCKED"
created: 0                        # epoch ms
last_updated: 0                   # epoch ms
---

# Session: {stamp}

## Hierarchy
<!-- Rendered from hierarchy.json — do not edit manually -->

## Log
<!-- Append-only within same session. Chronological. -->

## Notes
<!-- Scratchpad — anything goes -->
```

### Manifest: `sessions/manifest.json`

```json
{
  "sessions": [
    { "stamp": "30141102026", "file": "30141102026.md", "status": "archived" },
    { "stamp": "15201102026", "file": "15201102026.md", "status": "active" }
  ],
  "active_stamp": "15201102026"
}
```

Replaces `index.md` as the session registry. JSON, not markdown — queryable, not appendable-forever.

### Per-Session Rules

1. **`declare_intent`** → reads template → instantiates `{stamp}.md` → registers in manifest
2. **`map_context`** → finds active session file via manifest → appends to `## Log` section
3. **`compact_session`** → moves active file to archive/ → updates manifest status → new session starts from template

---

## Read-Before-Write Enforcement on Planning Files

### The Problem

Currently `writeActiveMd()` writes blindly — no check that content was read first. `map_context` does string surgery (split/replace on sections). Any tool can overwrite the entire session file. This is the same Edit-without-Read antipattern that OpenCode's innate tools prevent.

### The Rule

**You must read before you write. Period.**

Tracked in `brain.json`:

```typescript
interface FileGuard {
  last_read_stamp: string        // stamp of session file last read
  last_read_line_count: number   // line count at read time
  last_read_time: number         // epoch ms
}
```

### Enforcement Flow

```
Tool calls writeSessionFile()
    │
    ├── check: was readSessionFile() called since last write?
    │   NO → force re-read, compare line count
    │
    ├── check: line count matches last read?
    │   NO → file changed externally → reject write, force re-read
    │
    ├── check: same session_id in frontmatter?
    │   YES → APPEND only (below existing body)
    │   NO → full write allowed (new session instantiation)
    │
    └── write + update FileGuard in brain.json
```

### Same-Session = Append-Only

If the `session_id` in the file's YAML frontmatter matches the current session:
- Content can ONLY be appended below the existing `## Log` section
- No editing of previous entries
- No overwriting sections
- No string surgery (the current split/replace pattern in map_context is eliminated)

This chronological append order serves detection:
- Re-reading the session log reveals illogical sequences (e.g., action before tactic)
- Timestamps on each entry show gaps
- Pattern detection (keyword scan, repetition) works on the ordered log

### Cross-Session = Full Write

When `declare_intent` creates a new session file from template, it's a fresh instantiation — full write is allowed because it's a new file.

When `compact_session` archives, it moves the file — no editing needed.

---

## Backward Compatibility

`brain.json.hierarchy` stays as `{ trajectory, tactic, action }` — a flat projection of the cursor's ancestry in the tree. All existing hooks that read `brain.json` continue working without change.

`active.md` is REPLACED by per-session `{stamp}.md` files. The planning-fs module gets a new path resolver that finds the active session file via `manifest.json` instead of hardcoded `active.md`.

## File Impact Summary

| File | Change Type |
|------|-------------|
| `src/lib/hierarchy-tree.ts` | **NEW** — the tree engine module |
| `src/lib/detection.ts` | **NEW** — programmatic detection engine (counters, keywords, classification) |
| `src/lib/planning-fs.ts` | **REWRITE** — per-session files, template system, manifest, read-before-write guard |
| `src/tools/hierarchy.ts` | **NEW** — prune + migrate branches |
| `src/tools/declare-intent.ts` | MODIFY — instantiate from template, register in manifest |
| `src/tools/map-context.ts` | MODIFY — append-only within same session, chain tree engine |
| `src/tools/compact-session.ts` | MODIFY — archive session file + tree, update manifest |
| `src/tools/scan-hierarchy.ts` | MODIFY — render tree instead of flat |
| `src/tools/think-back.ts` | MODIFY — tree-based chain analysis + session log |
| `src/tools/index.ts` | MODIFY — add hierarchy exports |
| `src/index.ts` | MODIFY — register hierarchy_prune, hierarchy_migrate |
| `src/schemas/hierarchy.ts` | MODIFY — add tree types alongside flat types |
| `src/schemas/brain-state.ts` | MODIFY — extend MetricsState with detection counters + FileGuard |
| `src/lib/chain-analysis.ts` | MODIFY — tree-aware + timestamp gap detection |
| `src/hooks/session-lifecycle.ts` | MODIFY — becomes prompt compilation engine |
| `src/hooks/compaction.ts` | MODIFY — cursor ancestry injection |
| `src/hooks/soft-governance.ts` | MODIFY — becomes counter/detection engine |
| `src/schemas/config.ts` | MODIFY — wire `max_active_md_lines`, add prune/detection thresholds |
| `src/cli/init.ts` | MODIFY — create templates/ dir, generate session template |

## Implementation Order

1. `planning-fs.ts` — rewrite: template system, per-session files, manifest, read-before-write guard
2. `hierarchy-tree.ts` — engine module (types, stamps, CRUD, queries, rendering, I/O)
3. `detection.ts` — detection engine (tool classification, counters, keyword scan, signal compilation)
4. `brain-state.ts` — extend MetricsState with detection counters + FileGuard
5. `hierarchy.ts` tools — prune + migrate branches
6. `declare-intent.ts` — instantiate from template, register in manifest
7. `map-context.ts` — append-only enforcement, tree engine chain
8. `scan-hierarchy.ts` + `think-back.ts` — tree rendering + session log
9. `compact-session.ts` — archive session file + tree, update manifest
10. `soft-governance.ts` — wire detection engine (counter/detection after every tool)
11. `session-lifecycle.ts` — wire signal compilation (prompt transformation every turn)
12. `compaction.ts` — cursor ancestry injection
13. `chain-analysis.ts` — timestamp gap detection
14. `config.ts` — wire dead code, add detection thresholds
15. `cli/init.ts` — create templates/ dir structure
16. Tests — update all 386 assertions + new tree/detection/stamp/guard tests
17. Migration path — singleton active.md → per-session files
