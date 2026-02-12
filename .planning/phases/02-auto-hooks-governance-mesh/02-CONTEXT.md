# Phase 02: Auto-Hooks & Governance Mesh - Context

**Gathered:** 2026-02-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the governance behavior layer for HiveMind: turn-0 guidance, mode-aware warning pressure, event-driven stale detection, framework-aware prompt context, escalation behavior, and human-visible feedback via toasts.

This phase clarifies how governance behaves for both the human operator and the agent. It does not add new product capabilities outside Auto-Hooks and Governance Mesh.

</domain>

<decisions>
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

</decisions>

<specifics>
## Specific Ideas

- Current failure mode to fix: agents use governance tools as write-only logging and do not use exported planning state to steer next actions.
- Desired behavior: governance acts like navigation/GPS (what you declared, where you are, what to do next), not passive history capture.
- Human should be kept aware of violations while agent receives concrete next-step correction in injected context.

</specifics>

<deferred>
## Deferred Ideas

- True hard-block tool denial at platform level is deferred until/if OpenCode exposes block-capable plugin hooks; current phase uses simulated block + rollback only.

</deferred>

---

*Phase: 02-auto-hooks-governance-mesh*
*Context gathered: 2026-02-12*
