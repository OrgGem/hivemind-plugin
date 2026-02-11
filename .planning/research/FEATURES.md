# Feature Landscape

**Domain:** AI Agent Context Governance Plugin (OpenCode)
**Researched:** 2026-02-12

## Table Stakes

Features users expect. Missing = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Session lifecycle (declare→map→compact) | Core value prop. 3 tools that make agent context trackable. | ✅ DONE | 14 tools built, 705 tests passing |
| Hierarchy tree with timestamps | Agents lose track after compaction. Stamps enable cross-session grep. | ✅ DONE | MiMiHrHrDDMMYYYY stamps, tree engine |
| Drift detection + escalation | Without this, governance is just a label. Must detect AND push back. | ✅ DONE | 4-tier escalation, 11 counter-excuses |
| Evidence discipline from session start | **ST12 FAIL**: Currently only taught in strict mode bootstrap. Must fire in ALL modes. | High | Bootstrap condition needs `turn_count <= 2` not `LOCKED` |
| Config persistence across compaction | Settings must survive. Users don't re-configure every session. | ✅ DONE | config.json separate from brain.json |
| Fail-safe non-breaking hooks | Plugin must NEVER crash the host. All hooks try/catch. | ✅ DONE | P3 pattern on all 4 hooks |
| One-command system health check | User must validate entire system with one command. | ✅ DONE | `ecosystem-check` 9-step chain |
| Permissive mode actually silent | **ST11 CONDITIONAL**: Mode documented as "silent" but pushes warnings. | Med | Add governance_mode filter to session-lifecycle.ts |

## Differentiators

Features that set product apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| GSD framework integration | Auto-detect GSD projects, read STATE.md, inject GSD context into governance. HiveMind becomes the governance brain for GSD orchestration. | High | Parse STATE.md, detect phases/plans, align hierarchy with GSD structure |
| Spec-kit framework integration | Auto-detect spec-kit projects, read spec files, align governance with spec structure. | Med | Marker detection (.spec-kit/, spec-kit.config.json), spec file parsing |
| Fast codebase extraction (Repomix) | One-command codebase dump for agent consumption. `--compress` for signatures-only. Token budget awareness. | Med | Shell out to repomix with smart defaults, parse token-count-tree |
| Fast grep/glob/regex tools | Built-in tools for rapid codebase search without full file reads. Agents search instead of guessing. | Med | Wrap rg/fd with smart defaults, return structured results |
| Ralph-loop orchestration pattern | User stories → agent iterations → completion control. Prevents infinite loops. | High | Implement prd.json schema, loop-state tracking, acceptance criteria gates |
| Argue-back system with counter-excuses | System doesn't just warn — it challenges agent rationalizations with evidence. | ✅ DONE | 11 counter-excuses, 4-tier escalation |
| Cross-session memory (mems brain) | Agents remember across compactions. Knowledge persists. | ✅ DONE | save_mem, recall_mems, list_shelves |
| Ink TUI dashboard | Visual system state in terminal. Real-time hierarchy, metrics, traces. | ✅ DONE | server.ts renders Ink components |
| Export cycle intelligence | Capture subagent results into hierarchy + mems. Auto-capture hook as safety net. | ✅ DONE | export_cycle tool + auto-capture in soft-governance |
| "I am retard" mode (max governance) | For users who want maximum hand-holding. Forces strict, skeptical, beginner settings. | ✅ DONE | 5 automation levels, retard forces strict |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Hard-blocking tool execution | OpenCode v1.1+ plugins CANNOT block tools. `tool.execute.before` returns void. | Track violations, escalate pressure via system prompt. Soft governance. |
| Agent hierarchy (boss/worker) | User stays in control. No autonomous agent spawning by HiveMind. | User-driven tools. HiveMind suggests, user decides. |
| Custom LLM calls from plugin | Plugin SDK doesn't support LLM invocation. Would add complexity. | Use system prompt injection to guide agent behavior. |
| Database persistence | Overkill for session state. Loses git-trackability. | JSON files in .hivemind/. Human-readable, git-friendly. |
| Framework-specific commands in CLI | Don't add `hivemind gsd start` or `hivemind spec-kit plan`. | Framework detection is automatic. HiveMind adapts behavior, doesn't expose framework-specific CLI. |

## Feature Dependencies

```
Evidence discipline from start → Bootstrap fires in all modes (prerequisite)
GSD integration → Framework detector (prerequisite)
Spec-kit integration → Framework detector (prerequisite)
Fast extraction → Repomix installed (external dep)
Fast grep/glob → rg/fd installed (external dep, graceful fallback)
Ralph-loop orchestration → prd.json schema definition (prerequisite)
Ralph-loop orchestration → loop-state.json tracking (prerequisite)
Permissive mode fix → session-lifecycle.ts governance_mode filter (code change)
```

## MVP Recommendation

Prioritize:
1. **Fix ST12 (evidence from start)** — Bootstrap in all modes. Core product promise.
2. **Fix ST11 (permissive consistency)** — Doc-code alignment. Trust issue.
3. **GSD framework integration** — Largest user base for this product.
4. **Fast extraction tools** — Agents need codebase awareness.

Defer:
- Spec-kit integration — Framework doesn't exist yet. Build when it materializes.
- Ralph-loop orchestration — Complex, can use GSD's existing orchestration instead.

## Sources

- Stress test verification: 6 parallel sub-agent reports (this conversation)
- GSD framework: /Users/apple/.config/opencode/get-shit-done/ (v1.18.0)
- Repomix: https://github.com/yamadashy/repomix
- Spec-kit markers: /Users/apple/idumb-v2/src/lib/framework-detector.ts
