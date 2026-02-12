# Phase 02: Auto-Hooks & Governance Mesh - Research

**Researched:** 2026-02-12
**Domain:** OpenCode plugin hooks, governance signal orchestration, framework-aware prompt routing
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
## Implementation Decisions

### Toast Notification Personality
- Use dual-channel feedback: toast explains issues to the human, injected context/error messaging tells the agent what to do next.
- Use escalating toast frequency and severity based on violation seriousness.
- Severity mapping is locked:
  - Out-of-order tool use: `info` first, then `warning`, then `error` when repeated.
  - Drift detection: `warning`, then `error` when repeated/ignored.
  - Compaction notices: `info` only.
  - Evidence-gate pressure: `warning`, then `error`.
  - IGNORED tier (10+ unacknowledged cycles): `error`.
- Toast language is hybrid: tool names remain English (`declare_intent`, `map_context`, etc.), surrounding guidance text follows configured language (Vietnamese/English).

### Permissive Mode Boundaries and Enforcement
- Governance must provide navigation context (what was declared, current hierarchy position, expected next step) so agents can self-govern instead of only logging actions.
- Pressure level escalates based on seriousness of violation; seriousness depends on how far action order deviates and impact scope.
- Rare block-mode behavior is allowed only when both conditions are true:
  1) prerequisite failure exists (missing plan, unresolved required tasks, or role mismatch), and
  2) impact is medium/high.
- Because SDK cannot hard-deny tool execution, enforcement in rare block-mode must use simulated block messaging plus post-action rollback guidance.
- Violation seriousness uses all available signals: declared intent mismatch, hierarchy mismatch, and explicit role metadata mismatch.

### Framework-Aware Drift Messaging
- If both GSD and Spec-kit are detected, agent must ask user to choose one framework before starting work. Dual-framework operating mode is not allowed.
- Agent should request framework consolidation/purification first when both frameworks are present.
- If user chooses to continue without cleanup, record explicit user acceptance and still require framework selection before implementation.
- Conflict response is settings-driven:
  - default governance: warn only,
  - higher governance: limited mode (read/search/planning only),
  - highest governance: simulated pause until framework is chosen.
- In GSD context, current phase goal is pinned at the top of injected context.
- Framework selection menu is locked:
  - `Use GSD` (requires metadata: `active_phase`)
  - `Use Spec-kit` (requires metadata: `active_spec_path`)
  - `Proceed with override this session` (requires metadata: `acceptance_note`)
  - `Cancel current task` (no metadata)

### IGNORED Escalation Tone and Evidence
- IGNORED-tier tone is adaptive by governance settings and selected expertise level.
- When behavior contradicts configured expertise/governance posture, tone may become sharply confrontational (including sarcastic style) to force attention.
- IGNORED argue-back must always include all three evidence categories in one compact block:
  - sequence evidence (declared vs actual action order),
  - plan evidence (missing prerequisites / undone tasks),
  - hierarchy evidence (trajectory/tactic/action mismatch).
- Counter reset policy is hybrid, settings-aware, and seriousness-aware:
  - acknowledgment can downgrade severity,
  - full reset requires missing prerequisites to be completed,
  - thresholds depend on missed-step count and hierarchy impact.
- Human-facing IGNORED toast format is locked to compact triage: reason + current phase/action + suggested fix command.

### Claude's Discretion
- Exact wording templates for toasts and injected corrective messages.
- Exact scoring thresholds for low/medium/high impact, as long as hybrid gating rules are preserved.
- Suggested fix command formatting and ordering.

### Deferred Ideas (OUT OF SCOPE)
## Deferred Ideas

- True hard-block tool denial at platform level is deferred until/if OpenCode exposes block-capable plugin hooks; current phase uses simulated block + rollback only.
</user_constraints>

## Summary

Phase 02 is primarily an orchestration phase, not a platform-rewrite phase. The current codebase already has the needed hook surfaces in place (`event`, `tool.execute.before`, `tool.execute.after`, `experimental.chat.system.transform`, and `experimental.session.compacting`), plus existing signal compilation and drift counters. Planning should focus on changing trigger semantics and adding structured routing rather than replacing core architecture.

The biggest required changes for GOV-01..GOV-08 are: (1) make turn-0 guidance unconditional across governance modes, (2) route stale/compaction/drift user feedback through toasts with locked severity mapping, (3) make framework conflict handling explicit and stateful (GSD vs Spec-kit selection), and (4) add IGNORED-tier evidence blocks that combine sequence/plan/hierarchy proof in one compact message. Existing modules (`src/hooks/session-lifecycle.ts`, `src/hooks/soft-governance.ts`, `src/lib/detection.ts`, `src/hooks/event-handler.ts`) are the correct extension points.

The planning risk is not missing APIs; it is inconsistency between channels and counters. If planner tasks keep a single signal model shared by prompt-injection, toast emission, and escalation counters, Phase 02 can be delivered without destabilizing the other phases.

**Primary recommendation:** Plan Phase 02 as a policy-routing implementation: one shared governance signal pipeline, three output adapters (agent prompt, human toast, state counters), and framework-selection gating wired into that same pipeline.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@opencode-ai/plugin` | `^1.1.53` (repo) | Hook interfaces and plugin runtime integration | Official plugin extension surface; required for all governance hooks |
| OpenCode SDK client (`client` from `PluginInput`) | Docs updated 2026-02-12 | TUI toasts and session/event APIs from hooks | First-party, typed API for user-visible governance feedback |
| TypeScript | `^5.3.0` | Governance logic with strict types | Existing strict-mode codebase; safer refactors for escalation logic |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `tsx` | `^4.7.0` | Hook/integration test execution | Behavioral regression tests for GOV-01..GOV-08 |
| `src/lib/detection.ts` (in-repo) | current | Signal tiering, evidence text, counter-excuse generation | Reuse and extend for IGNORED and severity mapping |
| `src/lib/staleness.ts` (in-repo) | current | Staleness checks | Event-driven stale handling on `session.idle` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Event-driven stale checks (`session.idle`) | Turn-only stale heuristics | Lower fidelity and more false positives |
| Single-channel prompt correction | Prompt + `client.tui.showToast` dual-channel | Prompt-only hides issues from human operator |
| Shared policy router | Per-hook ad-hoc warning logic | Fast initially, but drifts and conflicts across channels |

**Installation:**
```bash
npm install
```

## Architecture Patterns

### Recommended Project Structure
```text
src/
├── hooks/                  # SDK-facing adapters (event, tool, system, compaction)
│   ├── event-handler.ts
│   ├── soft-governance.ts
│   ├── session-lifecycle.ts
│   ├── tool-gate.ts
│   └── sdk-context.ts
├── lib/                    # Pure policy/analysis logic (no SDK imports)
│   ├── detection.ts
│   ├── staleness.ts
│   ├── chain-analysis.ts
│   └── framework-context.ts    # add in Phase 02
└── schemas/                # state/config typing and transitions
```

### Pattern 1: Turn-Window Bootstrap Across All Modes
**What:** Gate bootstrap by early turn window, not lock status.
**When to use:** `experimental.chat.system.transform` for GOV-01 and GOV-02.
**Example:**
```typescript
// Source: .planning/REQUIREMENTS.md (GOV-01, GOV-02)
const isBootstrapWindow = state.metrics.turn_count <= 2
if (isBootstrapWindow) {
  warningLines.push(generateBootstrapBlock(config.governance_mode))
  warningLines.push(generateEvidenceDisciplineBlock())
  warningLines.push(generateTeamBehaviorBlock())
}
```

### Pattern 2: Dual-Channel Governance Outputs
**What:** One signal computed once, rendered into two channels: prompt correction + toast.
**When to use:** Violations, drift, evidence-pressure, compaction notices.
**Example:**
```typescript
// Source: https://opencode.ai/docs/sdk/#tui
await client.tui.showToast({
  body: { message: localizedHumanMessage, variant: "warning" },
})
// same signal also rendered into injected context for agent next-step correction
```

### Pattern 3: Event-Driven Stale Detection
**What:** Trigger stale checks from `session.idle` events.
**When to use:** GOV-05 path in `event` hook.
**Example:**
```typescript
// Source: https://opencode.ai/docs/plugins/#events
if (event.type === "session.idle") {
  const stale = isSessionStale(state, config.stale_session_days)
  if (stale) emitGovernanceSignal("stale_session")
}
```

### Pattern 4: Framework Conflict Gate Before Implementation
**What:** Detect `.planning/` and `.spec-kit/`, require explicit framework choice metadata.
**When to use:** Any pre-implementation prompt turn under dual-framework detection.
**Example:**
```typescript
// Source: locked phase context (Framework-Aware Drift Messaging)
if (frameworks.gsd && frameworks.specKit) {
  renderSelectionMenu([
    "Use GSD", "Use Spec-kit", "Proceed with override this session", "Cancel current task",
  ])
  // Require metadata by selected path before allowing implementation guidance
}
```

### Anti-Patterns to Avoid
- **Hook-local escalation math:** Causes mismatch between toast severity and prompt severity.
- **LOCKED-only bootstrap:** Violates GOV-01/GOV-02 in assisted/permissive.
- **Prompt-only correction:** Hides governance state from user; violates toast personality decision.
- **Turn-count stale inference only:** Misses real idle signal provided by platform events.
- **Framework detection without persisted choice metadata:** Forces repeated conflict prompts and breaks flow.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UI warning transport | Custom TUI widget/panel for phase scope | `client.tui.showToast()` | Official supported surface; fast and consistent |
| Event transport layer | Internal event bus duplicating OpenCode events | Plugin `event` hook stream | Already provided by platform |
| Escalation formatter in every hook | N ad-hoc string builders | Shared compiler in `src/lib/detection.ts` + adapters | Prevents policy drift across channels |
| Framework conflict state in prompt text only | Free-form parse of previous text | Structured metadata (`active_phase`, `active_spec_path`, `acceptance_note`) | Deterministic gating and tests |

**Key insight:** Hand-rolled parallel governance channels create contradictory behavior; shared signal compilation plus thin adapters is the only scalable model for GOV-01..GOV-08.

## Common Pitfalls

### Pitfall 1: Bootstrap still tied to `governance_status === "LOCKED"`
**What goes wrong:** Assisted/permissive miss turn-0 guidance.
**Why it happens:** Legacy gating in `src/hooks/session-lifecycle.ts` checks lock state.
**How to avoid:** Gate with `turn_count <= 2` only.
**Warning signs:** Strict tests pass while permissive/assisted turn-0 tests fail.

### Pitfall 2: Severity mapping diverges between prompt and toast
**What goes wrong:** Human sees one severity, agent receives another.
**Why it happens:** Severity calculated independently in each hook.
**How to avoid:** Compute once, render many.
**Warning signs:** Same violation emits `warning` toast but `error` prompt tier.

### Pitfall 3: Toast spam
**What goes wrong:** Repeated identical toasts every turn.
**Why it happens:** No dedupe/fingerprint/cooldown.
**How to avoid:** Keep per-signal hash + last emission timestamp in state.
**Warning signs:** 3+ identical toasts within short turn window.

### Pitfall 4: Framework conflict never resolves
**What goes wrong:** Agent keeps asking user repeatedly even after explicit choice.
**Why it happens:** Choice not persisted as metadata.
**How to avoid:** Persist required metadata and branch routing off that state.
**Warning signs:** User picks `Use GSD` but next turn still shows full conflict menu.

### Pitfall 5: IGNORED tier lacks all three evidence categories
**What goes wrong:** Escalation becomes tone-only and easy to dismiss.
**Why it happens:** Evidence builder emits partial proof.
**How to avoid:** Hard requirement in formatter: sequence + plan + hierarchy in same block.
**Warning signs:** IGNORED message missing one evidence class.

## Code Examples

Verified patterns from official sources:

### Plugin event hook
```typescript
// Source: https://raw.githubusercontent.com/sst/opencode/dev/packages/plugin/src/index.ts
event?: (input: { event: Event }) => Promise<void>
```

### Tool hooks
```typescript
// Source: https://raw.githubusercontent.com/sst/opencode/dev/packages/plugin/src/index.ts
"tool.execute.before"?: (
  input: { tool: string; sessionID: string; callID: string },
  output: { args: any },
) => Promise<void>

"tool.execute.after"?: (
  input: { tool: string; sessionID: string; callID: string },
  output: { title: string; output: string; metadata: any },
) => Promise<void>
```

### TUI toast API
```typescript
// Source: https://opencode.ai/docs/sdk/#tui
await client.tui.showToast({
  body: { message: "Task completed", variant: "success" },
})
```

### Session event taxonomy including idle
```text
// Source: https://opencode.ai/docs/plugins/#events
session.created, session.compacted, session.deleted,
session.diff, session.error, session.idle, session.status, session.updated
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Lock-coupled bootstrap | Turn-window bootstrap in all modes | Required by GOV-01/GOV-02 (2026-02 roadmap) | Guidance starts from turn 0 everywhere |
| Prompt-only governance | Prompt + `showToast` dual-channel | Enabled by SDK client in plugin input | Human sees issues immediately |
| Turn count as stale proxy | `session.idle` event + stale helper | Required by GOV-05 | Lower stale false alarms |
| Generic escalation tiers | IGNORED-tier with compact triage and evidence bundle | Required by GOV-08 + locked context | Stronger correction when warnings ignored |

**Deprecated/outdated:**
- LOCKED-only bootstrap gating in `src/hooks/session-lifecycle.ts`.
- Stub-only event handling in `src/hooks/event-handler.ts` for `session.idle`.
- Escalation format without required sequence/plan/hierarchy IGNORED evidence bundle.

## Open Questions

1. **Can `tool.execute.before` hard-deny reliably in target runtime, or should Phase 02 treat deny as out-of-scope regardless?**
   - What we know: locked user decision requires simulated block + rollback guidance.
   - What's unclear: docs include examples that throw in `tool.execute.before`, while current project policy says no hard denial.
   - Recommendation: preserve locked policy for Phase 02 and add one explicit verification test/doc note so planner avoids relying on hard-block behavior.

2. **Which toast dedupe window best balances signal visibility vs spam?**
   - What we know: severity escalation is locked; exact thresholds are discretion.
   - What's unclear: optimal per-tier cooldown values under real workloads.
   - Recommendation: plan with configurable cooldown defaults and verify via integration tests.

3. **What minimum metadata contract is required to persist framework choice cleanly?**
   - What we know: required keys are locked by context.
   - What's unclear: where to persist and how long override should remain valid.
   - Recommendation: define metadata lifetime explicitly in plan (session-scoped by default), plus tests for re-prompt behavior.

## Sources

### Primary (HIGH confidence)
- `https://opencode.ai/docs/plugins` - plugin hooks, event list, examples, and plugin loading behavior (last updated Feb 12, 2026).
- `https://opencode.ai/docs/sdk` - `client.tui.showToast`, session APIs, prompt APIs (`noReply`), and SDK method surface (last updated Feb 12, 2026).
- `https://raw.githubusercontent.com/sst/opencode/dev/packages/plugin/src/index.ts` - current TypeScript hook signatures (`event`, `tool.execute.before/after`, `experimental.chat.system.transform`).
- `.planning/REQUIREMENTS.md` - GOV-01..GOV-08 contracts for Phase 02.
- `.planning/phases/02-auto-hooks-governance-mesh/02-CONTEXT.md` - locked decisions/discretion/deferred scope.

### Secondary (MEDIUM confidence)
- `src/hooks/session-lifecycle.ts` - current bootstrap/drift injection behavior and budgeting.
- `src/hooks/soft-governance.ts` - current counters, violations, and detection-state writes.
- `src/hooks/event-handler.ts` - current event wiring baseline and Phase-2 TODO markers.
- `src/lib/detection.ts` - escalation tiering/evidence formatting baseline.

### Tertiary (LOW confidence)
- `google_search` unavailable in this environment (403), so no additional web-discovery claims included.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - validated from official docs and repository versions.
- Architecture: HIGH - directly grounded in current hook code plus locked decisions.
- Pitfalls: MEDIUM-HIGH - based on current implementation gaps and required GOV behavior, with one runtime-ability ambiguity called out in Open Questions.

**Research date:** 2026-02-12
**Valid until:** 2026-03-14 (30 days; recheck OpenCode docs on hook semantics before implementation starts)
