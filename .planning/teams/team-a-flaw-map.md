# Team A Flaw Map: Audit and Analysis

**Generated**: 2026-02-13
**Auditor**: Architect Mode
**Scope**: hivemind-plugin v2.6.0

---

## Executive Summary

| Category | Flaws Found | P0-Critical | P1-High | P2-Medium |
|----------|-------------|-------------|---------|-----------|
| Toast Noise | 6 | 0 | 3 | 3 |
| Pseudo-Blocking Behavior | 3 | 1 | 2 | 0 |
| Empty Injection | 2 | 0 | 1 | 1 |
| One-Way Lifecycle Tools | 4 | 1 | 2 | 1 |
| Retrieval Gaps | 5 | 1 | 3 | 1 |
| **TOTAL** | **20** | **3** | **11** | **6** |

---

## Hard Constraints Violations Summary

| Constraint | Status | Violations |
|------------|--------|------------|
| HC1: No hard-block, no permission.ask | ❌ VIOLATED | 2 instances in tool-gate.ts |
| HC2: Do not shadow innate tools | ✅ COMPLIANT | None found |
| HC3: Max 10 tools/scripts | ❌ VIOLATED | 14 tools (4 over limit) |
| HC4: Symmetric read/write flows | ❌ VIOLATED | 3 missing read operations |
| HC5: Deterministic --json output | ❌ VIOLATED | No tools support --json |
| HC6: Skip low-confidence injection | ⚠️ PARTIAL | No confidence scoring |

---

## Category 1: Toast Noise

### FLAW-TOAST-001: Out-of-Order Toast Spam
- **File**: [`src/hooks/soft-governance.ts`](src/hooks/soft-governance.ts:295)
- **Lines**: 295-304
- **Current Behavior**: Emits toast on every governance violation in LOCKED session
- **Why Problematic**: 
  - Fires on every tool call before declare_intent
  - 30-second cooldown may not prevent noise during rapid tool calls
  - Violates signal-to-noise principle from GSD Phase 02-01
- **Proposed Fix**: 
  - Increase cooldown to 60 seconds
  - Add violation aggregation (show count, not individual toasts)
  - Only emit on escalation tier change
- **Priority**: P1-High

### FLAW-TOAST-002: Evidence Pressure Toast Loop
- **File**: [`src/hooks/soft-governance.ts`](src/hooks/soft-governance.ts:311)
- **Lines**: 311-333
- **Current Behavior**: Emits toast when keyword_flags or consecutive_failures detected
- **Why Problematic**:
  - Can fire repeatedly on same stuck pattern
  - No differentiation between first detection and escalation
  - Creates noise without actionable guidance
- **Proposed Fix**:
  - Only emit on tier escalation (INFO → WARN → CRITICAL)
  - Include specific keyword in toast message
  - Add "dismiss" option via TUI
- **Priority**: P1-High

### FLAW-TOAST-003: Compaction Info Toast
- **File**: [`src/hooks/compaction.ts`](src/hooks/compaction.ts:168)
- **Lines**: 168-172
- **Current Behavior**: Emits info toast on every compaction
- **Why Problematic**:
  - Compaction is automatic, toast provides no actionable info
  - "Continue from preserved hierarchy path" is obvious
  - Low value, pure noise
- **Proposed Fix**: Remove entirely - compaction is transparent operation
- **Priority**: P2-Medium

### FLAW-TOAST-004: Session Idle Drift Toast
- **File**: [`src/hooks/event-handler.ts`](src/hooks/event-handler.ts:61)
- **Lines**: 61-66
- **Current Behavior**: Emits toast on session.idle when drift_score < 50
- **Why Problematic**:
  - session.idle fires frequently during normal work
  - Drift score < 50 is common during active exploration
  - Creates false urgency
- **Proposed Fix**:
  - Only emit when drift_score < 30
  - Add turn_count threshold (only after 10+ turns)
- **Priority**: P2-Medium

### FLAW-TOAST-005: Session Idle Staleness Toast
- **File**: [`src/hooks/event-handler.ts`](src/hooks/event-handler.ts:83)
- **Lines**: 83-88
- **Current Behavior**: Emits toast when session is stale
- **Why Problematic**:
  - Staleness is expected for long-running sessions
  - Toast doesn't help - user knows their session is old
  - Should be opt-in notification, not push
- **Proposed Fix**: Remove - staleness is visible in scan_hierarchy output
- **Priority**: P2-Medium

### FLAW-TOAST-006: Session Compacted Toast
- **File**: [`src/hooks/event-handler.ts`](src/hooks/event-handler.ts:107)
- **Lines**: 107-112
- **Current Behavior**: Emits toast on session.compacted event
- **Why Problematic**:
  - Redundant with compaction.ts toast
  - Double notification for same event
  - Low value message
- **Proposed Fix**: Remove - duplicate of FLAW-TOAST-003
- **Priority**: P1-High (blocks consolidation)

---

## Category 2: Pseudo-Blocking Behavior

### FLAW-BLOCK-001: Hard-Block in Strict Mode (HC1 Violation)
- **File**: [`src/hooks/tool-gate.ts`](src/hooks/tool-gate.ts:156)
- **Lines**: 156-163, 179-186
- **Current Behavior**: Returns `{ allowed: false, error: "..." }` in strict mode
- **Why Problematic**:
  - **DIRECT VIOLATION OF HC1**: "No hard-block behavior and no permission.ask"
  - Blocks tool execution entirely
  - Creates hard-stop, not soft guidance
- **Proposed Fix**:
  - Change to `{ allowed: true, warning: "..." }` in all cases
  - Use prompt injection for governance, not execution blocking
  - Track violations in brain.json for post-hoc analysis
- **Priority**: P0-Critical

### FLAW-BLOCK-002: Simulated-Pause Pattern
- **File**: [`src/hooks/tool-gate.ts`](src/hooks/tool-gate.ts:75)
- **Lines**: 75-78, 143-149
- **Current Behavior**: Returns "SIMULATED PAUSE" message but still allows execution
- **Why Problematic**:
  - Confusing UX - says "pause" but doesn't pause
  - "rollback guidance" is unhelpful after the fact
  - Pseudo-blocking creates cognitive overhead
- **Proposed Fix**:
  - Remove simulated-pause entirely
  - Use simple warning message
  - Let prompt injection handle guidance
- **Priority**: P1-High

### FLAW-BLOCK-003: Limited-Mode Pattern
- **File**: [`src/hooks/tool-gate.ts`](src/hooks/tool-gate.ts:63)
- **Lines**: 63-73
- **Current Behavior**: Returns "LIMITED MODE" warning for framework conflicts
- **Why Problematic**:
  - Same pseudo-blocking pattern as simulated-pause
  - Creates confusion without actual behavioral change
  - Framework conflict should be resolved, not warned about repeatedly
- **Proposed Fix**:
  - Emit once per session, then silence
  - Add framework_selection to brain.json
  - Check selection before warning
- **Priority**: P1-High

---

## Category 3: Empty Injection

### FLAW-INJECT-001: Bootstrap Block Over-Injection
- **File**: [`src/hooks/session-lifecycle.ts`](src/hooks/session-lifecycle.ts:243)
- **Lines**: 243-280
- **Current Behavior**: Injects ~1100 char bootstrap block when governance_status === "LOCKED" AND turn_count <= 2
- **Why Problematic**:
  - Injects even if agent already knows protocol
  - No confidence check - assumes agent needs teaching
  - Burns context budget on every session start
- **Proposed Fix**:
  - Only inject if no prior HiveMind sessions detected
  - Check for .hivemind/sessions/*.md as signal of prior knowledge
  - Reduce to 500 chars with link to full docs
- **Priority**: P1-High

### FLAW-INJECT-002: Setup Guidance Block
- **File**: [`src/hooks/session-lifecycle.ts`](src/hooks/session-lifecycle.ts:289)
- **Lines**: 289-337
- **Current Behavior**: Injects setup guidance when config.json missing
- **Why Problematic**:
  - Injects on every turn until configured
  - No confidence scoring
  - Could be replaced by single toast
- **Proposed Fix**:
  - Emit once as toast, then silence
  - Add setup_suppressed flag to brain.json
  - Only re-emit on explicit request
- **Priority**: P2-Medium

---

## Category 4: One-Way Lifecycle Tools

### FLAW-ONWAY-001: save_anchor Missing Read Pair (HC4 Violation)
- **File**: [`src/tools/save-anchor.ts`](src/tools/save-anchor.ts:1)
- **Lines**: 1-43
- **Current Behavior**: Write-only tool - saves anchors but no dedicated read
- **Why Problematic**:
  - **VIOLATES HC4**: "Every write flow must have symmetric read/inspect flow"
  - scan_hierarchy shows only first 5 anchors, truncated
  - No way to read full anchor value
- **Proposed Fix**:
  - Add `list_anchors` tool OR
  - Add `--json` flag to scan_hierarchy for full output
  - Consider merging with recall_mems pattern
- **Priority**: P0-Critical

### FLAW-ONWAY-002: export_cycle Missing Read Pair
- **File**: [`src/tools/export-cycle.ts`](src/tools/export-cycle.ts:1)
- **Lines**: 1-136
- **Current Behavior**: Write-only tool - saves cycle results to mems
- **Why Problematic**:
  - No way to list cycle results specifically
  - recall_mems can search but not filter by cycle-intel shelf
  - Breaks lifecycle symmetry
- **Proposed Fix**:
  - Add shelf filter to recall_mems
  - Or add `list_cycles` tool
  - Export to dedicated cycles.json for inspection
- **Priority**: P1-High

### FLAW-ONWAY-003: self_rate Missing Read Pair
- **File**: [`src/tools/self-rate.ts`](src/tools/self-rate.ts:1)
- **Lines**: 1-86
- **Current Behavior**: Write-only tool - saves ratings but no read
- **Why Problematic**:
  - No way to view rating history
  - Ratings stored in brain.json but not accessible
  - Agent cannot learn from past self-assessments
- **Proposed Fix**:
  - Add rating history to think_back output
  - Or add `list_ratings` tool
  - Consider: is self_rate needed at all?
- **Priority**: P2-Medium

### FLAW-ONWAY-004: hierarchy_prune No Preview
- **File**: [`src/tools/hierarchy.ts`](src/tools/hierarchy.ts:33)
- **Lines**: 33-79
- **Current Behavior**: Executes prune immediately, no preview
- **Why Problematic**:
  - Destructive operation without confirmation
  - No way to see what would be pruned
  - Violates "safe to call multiple times" principle
- **Proposed Fix**:
  - Add `--dry-run` flag for preview
  - Show what will be pruned before execution
  - Add prune_preview to output
- **Priority**: P1-High

---

## Category 5: Retrieval Gaps

### FLAW-RETRIEVE-001: No Anchor Inspection Tool (HC4 Violation)
- **File**: N/A - Missing tool
- **Current Behavior**: No way to read individual anchor by key
- **Why Problematic**:
  - **VIOLATES HC4**: Missing read operation for save_anchor write
  - Anchors can be long (DB schemas, API specs)
  - Truncation in scan_hierarchy loses critical data
- **Proposed Fix**:
  - Add `get_anchor({ key: string })` tool
  - Or add `recall_mems --shelf anchors`
  - Minimum: add `--full` flag to scan_hierarchy
- **Priority**: P0-Critical

### FLAW-RETRIEVE-002: No Cycle History Tool
- **File**: N/A - Missing tool
- **Current Behavior**: No way to list past export_cycle results
- **Why Problematic**:
  - Cycle results stored in mems but not easily accessible
  - Agent cannot review past subagent outcomes
  - Breaks traceability chain
- **Proposed Fix**:
  - Add `list_cycles` tool
  - Or add `--shelf cycle-intel` filter to recall_mems
  - Show cycle count in scan_hierarchy
- **Priority**: P1-High

### FLAW-RETRIEVE-003: No Rating History Tool
- **File**: N/A - Missing tool
- **Current Behavior**: No way to view self_rating history
- **Why Problematic**:
  - Ratings stored but inaccessible
  - Cannot track self-awareness over time
  - Low utility tool without read pair
- **Proposed Fix**:
  - Add rating history to think_back
  - Or deprecate self_rate (low value)
  - Store in mems brain instead
- **Priority**: P1-High

### FLAW-RETRIEVE-004: No Session Archive Browser
- **File**: N/A - Missing tool
- **Current Behavior**: No way to list or search past sessions
- **Why Problematic**:
  - Sessions archived but not browsable
  - Cannot learn from past sessions
  - compact_session creates archive but no retrieval
- **Proposed Fix**:
  - Add `list_sessions` tool
  - Or add `recall_mems --shelf sessions`
  - Minimum: CLI command to list archives
- **Priority**: P1-High

### FLAW-RETRIEVE-005: No Config Inspection
- **File**: N/A - Missing tool
- **Current Behavior**: No way to read current HiveMind config
- **Why Problematic**:
  - Config set via CLI but not visible to agent
  - Agent cannot adapt behavior to config
  - governance_mode, language, automation_level hidden
- **Proposed Fix**:
  - Add `show_config` tool
  - Or include in scan_hierarchy output
  - Add to think_back context
- **Priority**: P2-Medium

---

## Replacement Matrix

### Tools to Merge (Reduces Count from 14 to 10)

| Current Tools | Merged Tool | Rationale |
|---------------|-------------|-----------|
| `scan_hierarchy` + `think_back` | `status` | Both are read-only state inspection |
| `save_anchor` + anchor read | `anchor` | Lifecycle pair in single tool |
| `list_shelves` + `recall_mems` | `recall` | Combine listing and searching |
| `hierarchy_prune` + `hierarchy_migrate` | `hierarchy` | Both are hierarchy maintenance |

### Tools to Remove

| Tool | Reason | Replacement |
|------|--------|-------------|
| `self_rate` | Low value, no read pair | Remove entirely |
| `list_shelves` | Redundant with recall_mems | Merge into recall |

### Tools to Add

| New Tool | Purpose | Priority |
|----------|---------|----------|
| `status` | Combined scan_hierarchy + think_back | P0 |
| `anchor` | Lifecycle pair: save + read anchors | P0 |
| `recall` | Combined list + search mems | P1 |
| `hierarchy` | Combined prune + migrate | P1 |

### Final Tool Surface (10 max)

| # | Tool | Type | Description |
|---|------|------|-------------|
| 1 | `declare_intent` | Core | Start session, set trajectory |
| 2 | `map_context` | Core | Update hierarchy level |
| 3 | `compact_session` | Core | Archive and reset |
| 4 | `status` | Read | Combined state inspection |
| 5 | `anchor` | Lifecycle | Save + read anchors |
| 6 | `recall` | Lifecycle | Search + list mems |
| 7 | `hierarchy` | Lifecycle | Prune + migrate tree |
| 8 | `export_cycle` | Write | Capture subagent results |
| 9 | `check_drift` | Read | Drift analysis |
| 10 | `think_back` | Read | Deep context refresh |

---

## Hard Constraint Compliance Plan

### HC1: No Hard-Block Behavior
- **Status**: ❌ VIOLATED
- **Fix**: Remove all `allowed: false` returns from tool-gate.ts
- **Files**: src/hooks/tool-gate.ts:156-163, 179-186

### HC2: Do Not Shadow Innate Tools
- **Status**: ✅ COMPLIANT
- **Action**: None required

### HC3: Maximum 10 Tools
- **Status**: ❌ VIOLATED (14 tools)
- **Fix**: Merge tools per Replacement Matrix
- **Target**: 10 tools after consolidation

### HC4: Symmetric Read/Write
- **Status**: ❌ VIOLATED
- **Fix**: Add read operations for save_anchor, export_cycle
- **Files**: New tools or merged lifecycle tools

### HC5: Deterministic --json Output
- **Status**: ❌ VIOLATED
- **Fix**: Add `--json` flag to all read tools
- **Files**: status, recall, check_drift, think_back

### HC6: Skip Low-Confidence Injection
- **Status**: ⚠️ PARTIAL
- **Fix**: Add confidence scoring to session-lifecycle.ts
- **Files**: src/hooks/session-lifecycle.ts

---

## Critical Issues Requiring Immediate Attention

### 1. Hard-Block in Strict Mode (P0)
The tool-gate.ts returns `allowed: false` which directly violates HC1. This must be changed to soft guidance via prompt injection.

### 2. Missing Anchor Read Operation (P0)
save_anchor has no symmetric read operation. Anchors are critical constraints that must be fully readable.

### 3. Tool Count Exceeds Limit (P0)
14 tools exceeds the maximum of 10. Consolidation is required before any new tools are added.

---

## Recommendations for Implementation Phase

1. **Phase 1: HC1 Compliance** - Remove all hard-block behavior
2. **Phase 2: Tool Consolidation** - Merge tools per Replacement Matrix
3. **Phase 3: HC4 Compliance** - Add missing read operations
4. **Phase 4: HC5 Compliance** - Add --json support to read tools
5. **Phase 5: Toast Cleanup** - Implement toast aggregation and cooldowns

---

## Appendix: File Reference

| File | Lines | Flaws |
|------|-------|-------|
| src/hooks/tool-gate.ts | 156-186 | BLOCK-001, BLOCK-002, BLOCK-003 |
| src/hooks/soft-governance.ts | 295-333 | TOAST-001, TOAST-002 |
| src/hooks/compaction.ts | 168-172 | TOAST-003 |
| src/hooks/event-handler.ts | 61-112 | TOAST-004, TOAST-005, TOAST-006 |
| src/hooks/session-lifecycle.ts | 243-337 | INJECT-001, INJECT-002 |
| src/tools/save-anchor.ts | 1-43 | ONWAY-001, RETRIEVE-001 |
| src/tools/export-cycle.ts | 1-136 | ONWAY-002, RETRIEVE-002 |
| src/tools/self-rate.ts | 1-86 | ONWAY-003, RETRIEVE-003 |
| src/tools/hierarchy.ts | 33-79 | ONWAY-004 |
