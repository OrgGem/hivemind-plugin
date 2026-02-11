# Architecture Patterns

**Domain:** AI Agent Context Governance Plugin
**Researched:** 2026-02-12

## Current Architecture (v2.6.0)

```
┌─────────────────────────────────────────────────┐
│                   OpenCode Host                  │
│                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │ Agent 1  │  │ Agent 2  │  │ Agent N  │     │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘     │
│       │              │              │            │
│       ▼              ▼              ▼            │
│  ┌─────────────────────────────────────────┐    │
│  │         HiveMind Plugin Layer            │    │
│  │                                          │    │
│  │  HOOKS (4):                              │    │
│  │   • tool.execute.before (gate)           │    │
│  │   • tool.execute.after (track/detect)    │    │
│  │   • chat.system.transform (inject)       │    │
│  │   • session.compacting (preserve)        │    │
│  │                                          │    │
│  │  TOOLS (14):                             │    │
│  │   Core: declare_intent, map_context,     │    │
│  │         compact_session                  │    │
│  │   Cognitive: scan_hierarchy, save_anchor, │    │
│  │         think_back, check_drift          │    │
│  │   Mems: save_mem, list_shelves,          │    │
│  │         recall_mems                      │    │
│  │   Ops: hierarchy_prune, hierarchy_migrate │    │
│  │   Intel: self_rate, export_cycle         │    │
│  └──────────────┬──────────────────────────┘    │
│                 │                                │
│                 ▼                                │
│  ┌─────────────────────────────────────────┐    │
│  │          Persistence Layer               │    │
│  │                                          │    │
│  │  .hivemind/                              │    │
│  │   ├── brain.json (session state)         │    │
│  │   ├── config.json (governance settings)  │    │
│  │   ├── hierarchy.json (tree structure)    │    │
│  │   ├── sessions/ (per-session files)      │    │
│  │   │   ├── manifest.json                  │    │
│  │   │   ├── {stamp}.md                     │    │
│  │   │   └── archive/                       │    │
│  │   └── mems.json (cross-session memory)   │    │
│  └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `src/hooks/session-lifecycle.ts` | System prompt injection, bootstrap, evidence gate display | brain-state, detection, config, hierarchy-tree |
| `src/hooks/soft-governance.ts` | Post-tool tracking, drift detection, auto-capture, FileGuard | brain-state, detection, chain-analysis |
| `src/hooks/tool-gate.ts` | Pre-tool governance checks (strict/assisted/permissive) | brain-state, config |
| `src/hooks/compaction.ts` | Context preservation across LLM compaction | brain-state, hierarchy-tree |
| `src/lib/detection.ts` | Signal compilation, escalation tiers, counter-excuses, evidence | brain-state counters |
| `src/lib/hierarchy-tree.ts` | Tree CRUD, stamps, gap detection, rendering, janitor, I/O | hierarchy.json |
| `src/lib/planning-fs.ts` | Session files, manifest, templates, FileGuard, init | .hivemind/sessions/ |
| `src/lib/persistence.ts` | Load/save brain.json, config.json, backup-before-write | .hivemind/*.json |
| `src/schemas/brain-state.ts` | Schema, creation, locking, counters, cycle_log | N/A (pure data) |
| `src/schemas/config.ts` | Config schema, defaults, agent behavior prompt generation | N/A (pure data) |
| `src/tools/*` | 14 agent-facing tools (declare_intent, map_context, etc.) | All lib modules |
| `src/cli.ts` + `src/cli/init.ts` | CLI commands (init, status, compact, dashboard) | planning-fs, persistence |
| `bin/hivemind-tools.cjs` | Extended CLI (ecosystem-check, validate, inspect, session trace) | .hivemind/ files directly |
| `src/dashboard/server.ts` | Ink TUI dashboard rendering | brain-state, hierarchy-tree, git |
| `skills/` (5 files) | Behavioral governance via markdown instructions | Loaded by agent via skill system |

### Data Flow

```
Agent tool call
    │
    ▼
tool.execute.before (tool-gate.ts)
    │ Check governance status, log warnings
    │
    ▼
Tool executes (OpenCode native or HiveMind tool)
    │
    ▼
tool.execute.after (soft-governance.ts)
    │ 1. Increment turn count
    │ 2. Track file touches
    │ 3. Run detection engine (9 signals)
    │ 4. Auto-capture Task results
    │ 5. Update brain.json
    │
    ▼
chat.system.transform (session-lifecycle.ts)
    │ 1. Load brain.json + config.json
    │ 2. Check stale session auto-archive
    │ 3. Generate <hivemind> block:
    │    P0: Bootstrap (first 2 turns, strict only ← NEEDS FIX)
    │    P1: Status line
    │    P2: Hierarchy tree
    │    P3: Escalated signals + evidence + counter-excuses
    │    P4: Anchors
    │    P5: Metrics
    │    P6: Agent config
    │ 4. Inject into system prompt
    │
    ▼
Agent sees governance context in system prompt
```

## Proposed v3 Architecture (New Components)

```
┌─────────────────────────────────────────────────┐
│           HiveMind v3 — New Layers              │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │     Framework Integration Layer (NEW)    │    │
│  │                                          │    │
│  │  framework-detector.ts                   │    │
│  │   • Detect GSD (.gsd/, gsd.config.json)  │    │
│  │   • Detect Spec-kit (.spec-kit/)         │    │
│  │   • Detect none (standalone mode)        │    │
│  │                                          │    │
│  │  gsd-bridge.ts                           │    │
│  │   • Read STATE.md → current position     │    │
│  │   • Read ROADMAP.md → phase structure    │    │
│  │   • Align hierarchy with GSD phases      │    │
│  │   • Inject GSD context into <hivemind>   │    │
│  │                                          │    │
│  │  spec-kit-bridge.ts                      │    │
│  │   • Read spec files → spec structure     │    │
│  │   • Align hierarchy with spec tasks      │    │
│  │   • (Stub — implement when spec-kit      │    │
│  │     framework materializes)              │    │
│  └──────────────┬──────────────────────────┘    │
│                 │                                │
│  ┌─────────────────────────────────────────┐    │
│  │     Fast Extraction Layer (NEW)          │    │
│  │                                          │    │
│  │  extraction.ts                           │    │
│  │   • repomix-wrap: Pack codebase          │    │
│  │   • rg-search: Fast content search       │    │
│  │   • fd-find: Fast file search            │    │
│  │   • token-budget: Count tokens in tree   │    │
│  │                                          │    │
│  │  New tools exposed to agents:            │    │
│  │   • codebase_pack (repomix wrapper)      │    │
│  │   • fast_search (rg wrapper)             │    │
│  │   • fast_find (fd wrapper)               │    │
│  └──────────────┬──────────────────────────┘    │
│                 │                                │
│  ┌─────────────────────────────────────────┐    │
│  │     Orchestration Layer (NEW)            │    │
│  │                                          │    │
│  │  loop-control.ts                         │    │
│  │   • prd.json schema validation           │    │
│  │   • Story selection (priority + deps)    │    │
│  │   • Completion tracking (passes/fails)   │    │
│  │   • loop-state.json persistence          │    │
│  │   • Quality gate enforcement             │    │
│  │                                          │    │
│  │  New tools exposed to agents:            │    │
│  │   • story_status (track completion)      │    │
│  │   • next_story (get next actionable)     │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │     Fix Layer (ST11 + ST12)              │    │
│  │                                          │    │
│  │  session-lifecycle.ts changes:           │    │
│  │   • Bootstrap fires ALL modes            │    │
│  │   • Evidence discipline in bootstrap     │    │
│  │   • Team behavior in bootstrap           │    │
│  │   • Permissive mode signal suppression   │    │
│  │                                          │    │
│  │  brain-state.ts changes:                 │    │
│  │   • Bootstrap condition: turn_count <= 2 │    │
│  │     (NOT governance_status === LOCKED)    │    │
│  └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

## Patterns to Follow

### Pattern 1: Non-Breaking Extension
**What:** All new features are additive. Existing tools/hooks unchanged.
**When:** Always. Breaking changes require major version.
**Example:**
```typescript
// Framework detection is optional — falls back to standalone
const framework = detectFramework(projectDir);
// framework === "gsd" | "spec-kit" | null
if (framework === "gsd") {
  const gsdContext = await readGsdState(projectDir);
  // Inject into <hivemind> block
}
```

### Pattern 2: Shell-Out for Extraction
**What:** Don't reimplement repomix/rg/fd. Shell out with smart defaults.
**When:** Fast extraction tools.
**Example:**
```typescript
export async function packCodebase(dir: string, opts?: PackOptions): Promise<string> {
  const args = ["--style", "xml", "--compress"];
  if (opts?.include) args.push("--include", opts.include);
  const result = await exec(`npx repomix@latest ${args.join(" ")}`, { cwd: dir });
  return result.stdout;
}
```

### Pattern 3: P3 Safety (Never Break Host)
**What:** Every hook and tool wraps entire body in try/catch.
**When:** All code that runs inside OpenCode process.
**Example:**
```typescript
// P3: Never break [component]
try {
  // ... actual logic
} catch (error) {
  // Log but never throw
  console.error(`[hivemind] ${component} error:`, error);
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Framework Coupling
**What:** Making HiveMind depend on GSD/Spec-kit being present.
**Why bad:** Plugin must work standalone. Framework integration is optional enhancement.
**Instead:** Feature detection with graceful fallback. `detectFramework()` returns null → standalone mode.

### Anti-Pattern 2: Custom File Parsers
**What:** Building custom markdown/JSON parsers for STATE.md, ROADMAP.md.
**Why bad:** Fragile. GSD format may change.
**Instead:** Use regex for key sections. Accept partial parsing. Fail gracefully.

### Anti-Pattern 3: Blocking on External Tools
**What:** Requiring repomix/rg/fd to be installed.
**Why bad:** Breaks for users who don't have them.
**Instead:** Check with `which`, provide fallback to native Node.js equivalents (slower but works).

## Scalability Considerations

| Concern | Current (v2.6) | v3 Target | Notes |
|---------|----------------|-----------|-------|
| brain.json size | ~5KB | ~10KB with framework state | Add pruning if > 50KB |
| hierarchy.json size | ~2KB per session | Same | Auto-prune completed branches already works |
| Token budget per turn | ~500 tokens <hivemind> | ~800 with framework context | Budget cap already enforced |
| Repomix output | N/A | 1-50MB depending on codebase | Use --compress, --split-output for large codebases |
| Test count | 705 | 900+ | Each new tool/feature needs tests |

## Sources

- Current codebase: /Users/apple/hivemind-plugin/src/
- GSD framework: /Users/apple/.config/opencode/get-shit-done/ (v1.18.0)
- Repomix: https://github.com/yamadashy/repomix
- OpenCode Plugin SDK: @opencode-ai/plugin
