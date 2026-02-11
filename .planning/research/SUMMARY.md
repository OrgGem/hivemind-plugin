# Research Summary: HiveMind v3

**Domain:** AI Agent Context Governance Plugin for OpenCode
**Researched:** 2026-02-12
**Overall confidence:** HIGH (brownfield project, deep codebase knowledge from 705-assertion test suite and full stress test verification)

## Executive Summary

HiveMind v2.6.0 is a mature context governance plugin with 14 tools, 4 hooks, 5 skills, and 705 passing test assertions across 20 test files. The stress test verification against STRESS-TEST-1.MD revealed 10 out of 12 requirements as PASS, 1 CONDITIONAL PASS (ST11: permissive mode contradiction), and 1 FAIL (ST12: agents not taught evidence/team behavior from session start in non-strict modes).

The v3 iteration adds three new capability layers: **framework integration** (GSD + Spec-kit auto-detection and context bridging), **fast extraction** (Repomix codebase packing + rg/fd search wrappers), and **orchestration patterns** (Ralph-loop style completion control with prd.json schema). These address the user's explicit requirements for supporting GSD/Spec-kit frameworks, providing fast codebase awareness tools, and controlling agent iteration loops.

The critical path is fixing ST11/ST12 first (these are the product's core promise), then building framework integration (the highest-value differentiator), then fast extraction tools (enabling agent codebase awareness), with orchestration patterns and spec-kit integration deferred as they depend on external frameworks that either don't exist yet (spec-kit) or have their own orchestration (GSD).

## Key Findings

**Stack:** Keep TypeScript + @opencode-ai/plugin. Add Repomix for extraction, rg/fd for search. Zero new npm runtime dependencies.
**Architecture:** Three new layers (framework integration, fast extraction, orchestration) all additive and optional. Non-breaking extension pattern.
**Critical pitfall:** Bootstrap block only fires in strict mode — the DEFAULT (assisted) mode gets zero governance teaching from session start. This undermines the entire product value proposition.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **ST11/ST12 Critical Fixes** — Fix the 2 stress test failures
   - Addresses: Bootstrap in all modes, evidence discipline teaching, permissive mode consistency
   - Avoids: Publishing with broken core promise (Pitfall 1, 2)

2. **Framework Detector + GSD Bridge** — Auto-detect governance frameworks, read GSD state
   - Addresses: GSD integration (the primary user-requested feature)
   - Avoids: Framework coupling breaking standalone mode (Pitfall 3)

3. **Fast Extraction Tools** — Repomix wrapper, rg/fd search tools
   - Addresses: Agent codebase awareness (user-requested)
   - Avoids: Output exceeding context window (Pitfall 4)

4. **Orchestration Patterns** — Ralph-loop completion control
   - Addresses: Story-based iteration tracking with acceptance gates
   - Avoids: Infinite iteration (Pitfall 6)

5. **Spec-kit Stub + Comprehensive Stress Test** — Interface for future spec-kit, full stress test suite
   - Addresses: All 13 stress test requirements verifiable via automated tests
   - Avoids: Regression on fixed issues

6. **npm Publish + CI/CD** — Package and publish to npm registry
   - Addresses: Distribution (L6 in master plan, currently BLOCKED)

**Phase ordering rationale:**
- Phase 1 MUST come first — can't publish with ST12 FAIL
- Phase 2 before 3 because framework detection is the foundation for context-aware extraction
- Phase 3 before 4 because agents need codebase awareness before orchestration
- Phase 5 before 6 because stress test must pass before publish
- Phase 4 can potentially run in parallel with Phase 3

**Research flags for phases:**
- Phase 2: May need deeper research on GSD STATE.md format stability
- Phase 3: Needs verification of Repomix --compress accuracy (tree-sitter coverage)
- Phase 4: Needs clarity on whether Ralph-tui binary will be installed or manual-loop-only
- Phase 5: Standard patterns, unlikely to need research

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Brownfield. Existing stack proven with 705 tests. New additions verified (Repomix 21.8k stars). |
| Features | HIGH | Feature gaps identified via systematic stress test of 13 requirements with code evidence. |
| Architecture | HIGH | Extension to existing architecture. Non-breaking patterns established. |
| Pitfalls | HIGH | Pitfalls derived from actual stress test failures (code-level evidence, not speculation). |

## Gaps to Address

- **Spec-kit framework**: Does not exist yet. Can only build stub/interface. Implement when framework materializes.
- **Ralph-tui binary**: Not installed on machine. Skills exist for manual loop pattern. Decision needed: build binary dependency or manual-only.
- **GSD STATE.md stability**: GSD is at v1.18.0 and actively evolving. STATE.md format may change. Parser must be resilient.
- **OpenCode Plugin SDK v2**: If OpenCode releases SDK v2, hook signatures may change. Current architecture is v1.1+ compatible.
- **npm publish auth**: L6 in master plan is BLOCKED on npm login. Token provided by user in this conversation — should be rotated.
