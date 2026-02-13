# HiveMind Implementation Validation Criteria

**Date:** 2026-02-13  
**Plugin Version:** 2.6.0  
**Status:** VALIDATION CRITERIA DEFINED

---

This document provides actionable and testable validation criteria for the HiveMind Context Governance plugin implementation. Use these criteria to verify end results against the original design intent.

---

## Section 1: Automated Test Commands

Run these commands in sequence to validate the baseline implementation:

### Quick Validation Commands

```bash
# 1. All tests pass
npm test

# 2. TypeScript clean
npm run typecheck

# 3. SDK boundary check
npm run lint:boundary

# 4. Build succeeds
npm run build
```

### Expected Baseline Results

| Command | Expected Output |
|---------|----------------|
| `npm test` | All tests pass (43/43) |
| `npm run typecheck` | No errors |
| `npm run lint:boundary` | No violations |
| `npm run build` | `dist/` populated, CLI executable |

---

## Section 2: Entity Hierarchy Validation

### Level 0: Governance SOT

- [ ] Run: `ls -la .hivemind/codemap/` → directory exists
- [ ] Run: `ls -la .hivemind/codewiki/` → directory exists
- [ ] Run: `cat .hivemind/manifest.json | grep codemap` → entry exists
- [ ] Validate: CodemapManifest schema in [`src/lib/manifest.ts:88-93`](src/lib/manifest.ts:88)

**Status:** PLACEHOLDER - Directories exist, no actual code scanning implemented

### Level 1: Plans

- [ ] Run: `ls -la .planning/phases/` → phase directories exist
- [ ] Run: `cat .hivemind/manifest.json | grep linked_plans` → M:N linking
- [ ] Validate: [`linkSessionToPlan()`](src/lib/manifest.ts:354) creates bidirectional links

**Implementation:** [`src/lib/manifest.ts:79-81`](src/lib/manifest.ts:79) (PlanManifest type)

### Level 2: Sessions

- [ ] Run: `ls -la .hivemind/sessions/` → session files exist
- [ ] Run: `cat .hivemind/brain.json | grep current_session` → session ID set
- [ ] Validate: SessionManifest has all required fields

**Implementation:** [`src/lib/manifest.ts:65-68`](src/lib/manifest.ts:65) (SessionManifest type)

### Level 3: Tasks

- [ ] Run: `cat .hivemind/state/tasks.json` → file exists or is created on first write
- [ ] Validate: TaskManifest schema matches brainstorm spec
- [ ] Validate: Tasks linked to sessions via session_id

**Implementation:** [`src/lib/manifest.ts:135-139`](src/lib/manifest.ts:135) (TaskManifest type)

**GAP:** Schema defined but not actively written by tool execution hooks

### Level 4: Sub-Tasks

- [ ] Validate: SubTaskManifestEntry has timestamp fields (`started_at`, `completed_at`)
- [ ] Validate: `files_touched[]` array exists
- [ ] Validate: `tools_used[]` array exists
- [ ] Validate: `agent` field exists ("main" | "subagent")

**Implementation:** [`src/lib/manifest.ts:106-120`](src/lib/manifest.ts:106)

---

## Section 3: Sure-Hit Mechanisms Validation

### Mechanism 1: Tool Tracking

- [ ] Run a tool (e.g., declare_intent)
- [ ] Run: `cat .hivemind/brain.json | grep tool_calls`
- [ ] Verify: Tool call is recorded with timestamp
- [ ] **GAP:** Should write to tasks.json (currently brain.json.metrics)

**Implementation:** [`src/hooks/soft-governance.ts:139-428`](src/hooks/soft-governance.ts:139)

### Mechanism 2: Context Injection

- [ ] Start new session with declare_intent
- [ ] Check system prompt includes pending tasks
- [ ] Verify: system.transform hook fires every turn

**Implementation:** [`src/hooks/session-lifecycle.ts:394-768`](src/hooks/session-lifecycle.ts:394)

### Mechanism 3: Manifest Traversal

- [ ] Run: `cat .hivemind/manifest.json`
- [ ] Verify: All sessions have entries
- [ ] Verify: No duplicate entries (deduplication works)
- [ ] Run: [`registerSessionInManifest()`](src/lib/manifest.ts:200) → idempotent

**Implementation:** [`src/lib/manifest.ts:143-160`](src/lib/manifest.ts:143) (readManifest/writeManifest)

### Mechanism 4: Micro-State-Commits

- [ ] Make a state change
- [ ] Verify: State written immediately
- [ ] Verify: Backup created (.bak file)
- [ ] **GAP:** True atomic write (temp+rename) not implemented

**Implementation:** [`src/lib/persistence.ts:75-91`](src/lib/persistence.ts:75)

### Mechanism 5: Schema Validation

- [ ] Try to write invalid manifest
- [ ] Verify: Write rejected with error
- [ ] Run: [`deduplicateSessionManifest()`](src/lib/manifest.ts:268) → duplicates merged

**Implementation:** [`src/lib/manifest.ts:268-304`](src/lib/manifest.ts:268)

### Mechanism 6: Purification on Compact

- [ ] Run: compact_session tool
- [ ] Verify: tasks.json survives (if exists)
- [ ] Verify: Plan links updated
- [ ] Verify: Purification report generated

**Implementation:** [`src/hooks/compaction.ts:52-60`](src/hooks/compaction.ts:52)

---

## Section 4: Entry Points Validation

### Entry 1: New Session

- [ ] Run: `declare_intent({ mode: "plan_driven", focus: "test" })`
- [ ] Verify: brain.json.current_session set
- [ ] Verify: Session file created in .hivemind/sessions/
- [ ] Verify: Manifest entry created

**Implementation:** [`src/hooks/session-lifecycle.ts:287-335`](src/hooks/session-lifecycle.ts:287)

### Entry 2: Between Turns

- [ ] Run multiple tool calls
- [ ] Verify: brain.json.metrics updated each time
- [ ] Run: check_drift tool
- [ ] Verify: Drift score calculated
- [ ] **GAP:** Auto metadata commit not implemented

**Implementation:** [`src/hooks/soft-governance.ts:139`](src/hooks/soft-governance.ts:139)

### Entry 3: After First Compact

- [ ] Run: `compact_session({ summary: "test" })`
- [ ] Verify: Session archived
- [ ] Verify: Plan links preserved
- [ ] Verify: Tasks preserved

**Implementation:** [`src/hooks/compaction.ts:52`](src/hooks/compaction.ts:52)

### Entry 4: After 3+ Compacts

- [ ] Run compact_session 3+ times
- [ ] **GAP:** No threshold behavior change
- [ ] **GAP:** No manifest-only traversal mode
- [ ] **GAP:** No aggressive summarization

**Status:** MISSING - No threshold-based mode switching implemented

---

## Section 5: Sub-Task Atomic Validation

### Sub-Task Requirements

| Requirement | Validation Step |
|-------------|-----------------|
| Timestamp: created_at field | Exists as ISO 8601 or epoch ms |
| Timestamp: updated_at field | Exists via completed_at |
| Schema: parent_task field | Links to parent via linked_artifacts |
| Schema: session_id field | Links to session |
| Schema: plan_id field | Optional, links to plan |
| Files: files_touched[] array | Tracks changes with path + action |
| Agent: agent field | Records "main" or "subagent" |
| Tools: tools_used[] array | Tracks tool history |
| Commit: commit_hash field | Optional, for git linking |
| Metadata: metadata_commit_count field | Tracks commit count |

**Implementation:** [`src/lib/manifest.ts:106-120`](src/lib/manifest.ts:106)

---

## Section 6: Integration Test Scenarios

### Scenario 1: Fresh Session Flow

1. Start fresh session → declare_intent
2. Create plan → export_cycle
3. Execute tools → map_context, save_mem
4. Compact → compact_session
5. Verify: All artifacts linked correctly

**Test:** [`tests/integration.test.ts:66-154`](tests/integration.test.ts:66) (test_fullLifecycle)

### Scenario 2: Resume Session Flow

1. Start session matching existing session ID
2. Verify: Context pulled from previous session
3. Verify: TODOs injected into system prompt
4. Continue work
5. Compact

**Test:** [`tests/integration.test.ts:1044-1102`](tests/integration.test.ts:1044) (test_recallMemsSearchesAcrossSessions)

### Scenario 3: Delegation Flow

1. Main agent delegates to sub-agent
2. Sub-agent completes task
3. Sub-agent commits with metadata
4. Main agent receives summary
5. Main agent updates hierarchy

**Validation:** Agent field ("main" | "subagent") in SubTaskManifestEntry

### Scenario 4: Long Session Flow

1. Session with 5+ compaction cycles
2. Verify: Context remains manageable
3. Verify: Key decisions preserved
4. Verify: Tasks survive all compacts

**Test:** [`tests/integration.test.ts:915-988`](tests/integration.test.ts:915) (test_fullCognitiveMeshWorkflow)

---

## Section 7: Gap Priority Matrix

| Gap | Priority | Impact | Effort | Implementation Notes |
|-----|----------|--------|--------|---------------------|
| tasks.json writes | HIGH | Core mechanism - tool tracking goes to brain.json instead of tasks.json | Medium | Modify [`src/hooks/soft-governance.ts`](src/hooks/soft-governance.ts:139) to also write SubTaskManifestEntry |
| 3+ compact threshold | MEDIUM | Performance - no mode change after threshold | Low | Add threshold check in [`src/hooks/compaction.ts`](src/hooks/compaction.ts:52) |
| True atomic writes | MEDIUM | Data safety - backup exists but not atomic | Low | Use temp+rename strategy in [`src/lib/persistence.ts`](src/lib/persistence.ts:78) |
| Auto metadata commit | HIGH | Tracking - auto-commit not implemented | Medium | Implement shouldSuggestCommit logic in [`src/hooks/soft-governance.ts`](src/hooks/soft-governance.ts) |
| Level 0 SOT scanning | LOW | Future feature - placeholder only | High | Future phase, requires code analysis pipeline |

---

## Appendix: Reference Commands for Manual Validation

### File Existence Checks

```bash
# Check .hivemind directory structure
ls -la .hivemind/

# Check sessions directory
ls -la .hivemind/sessions/

# Check plans directory
ls -la .planning/phases/

# Check codemap/codewiki directories
ls -la .hivemind/codemap/
ls -la .hivemind/codewiki/
```

### State File Checks

```bash
# Check brain.json
cat .hivemind/brain.json | jq '.session'
cat .hivemind/brain.json | jq '.metrics'

# Check manifest.json
cat .hivemind/manifest.json | jq '.sessions'

# Check tasks.json (may not exist until first write)
cat .hivemind/state/tasks.json 2>/dev/null || echo "File does not exist yet"

# Check hierarchy.json
cat .hivemind/hierarchy.json | jq '.root'
```

### Tool Execution Tests

```bash
# Test declare_intent
npx tsx --test tests/integration.test.ts 2>&1 | grep "fullLifecycle"

# Test compact_session
npx tsx --test tests/integration.test.ts 2>&1 | grep "compact"

# Test memory persistence
npx tsx --test tests/integration.test.ts 2>&1 | grep "saveMem"
```

---

## Validation Workflow

1. **Run baseline commands** (Section 1)
2. **Verify entity hierarchy** (Section 2)
3. **Test sure-hit mechanisms** (Section 3)
4. **Validate entry points** (Section 4)
5. **Check sub-task atomicity** (Section 5)
6. **Run integration scenarios** (Section 6)
7. **Review gap priorities** (Section 7)

---

*This validation criteria document was created by analyzing the source code implementation against the user's brainstorming requirements. All file:line references point to the current codebase as of v2.6.0.*
