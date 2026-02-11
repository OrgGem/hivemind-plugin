# Technology Stack

**Project:** HiveMind v3 — Context Governance for OpenCode
**Researched:** 2026-02-12

## Recommended Stack

### Core Framework
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| TypeScript | 5.x | Language | Already in use. Plugin SDK requires it. Type safety critical for brain state schema. |
| @opencode-ai/plugin | latest | Plugin SDK | Required for OpenCode integration. Provides tool(), hook(), and context injection APIs. |
| Node.js | 22+ | Runtime | OpenCode runtime requirement. ES modules. |

### CLI & TUI
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Ink + React | 5.x + 18.x | TUI Dashboard | Already built (v2.6.0). Ink renders React components in terminal. |
| process.argv | native | CLI parsing | No dependency needed. `hivemind init/status/help` is simple enough. |

### Testing
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| node:test + node:assert | native | Test runner | Already in use. 705 assertions passing. Zero dependencies. |

### Fast Extraction (NEW — v3)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Repomix | 0.3.x | Codebase packing | Pack entire codebase into single AI-friendly file. XML/Markdown output. `--compress` mode uses tree-sitter for signature-only extraction. `--token-count-tree` for budget planning. |
| ripgrep (rg) | system | Fast content search | 10-100x faster than grep. Respects .gitignore. Already installed on most dev machines. |
| fd | system | Fast file search | Faster alternative to find. Respects .gitignore. |
| tree-sitter | via repomix | AST parsing | Used by Repomix `--compress` to extract function signatures, types, interfaces without implementation bodies. |

### Orchestration Patterns (NEW — v3)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| prd.json schema | internal | Loop control | Ralph-tui pattern: user stories with acceptance criteria, `passes: true/false`, `dependsOn[]`. Drives agent iteration loops. |
| loop-state.json | internal | Iteration tracking | Tracks `currentStory`, `completedStories[]`, `failedAttempts`, `qualityGatesPassing`. |

### Framework Integration (NEW — v3)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Framework Detector | internal | Detect GSD/Spec-kit | Marker-based detection: `.gsd/` or `gsd.config.json` → GSD; `.spec-kit/` or `spec-kit.config.json` → Spec-kit. |
| STATE.md parser | internal | Read GSD state | Parse GSD's STATE.md to understand current position, phase, plan, progress. |

## Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:fs/promises | native | File I/O | All persistence operations |
| node:child_process | native | Shell commands | Git hash, repomix invocation, validation scripts |
| node:path | native | Path manipulation | Cross-platform path handling |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Test runner | node:test | vitest | Zero dependency preference. Already working with 705 assertions. |
| CLI framework | process.argv | commander/yargs | Would add dependency for minimal gain. CLI is simple. |
| File search | repomix + rg | custom walker | Repomix already solves this problem. Don't reinvent. |
| Schema validation | manual + TypeScript | zod/joi | Plugin needs zero runtime deps. TypeScript types + manual validation sufficient. |
| State persistence | JSON files | SQLite | Overkill. JSON files are human-readable, git-trackable, debuggable. |

## Installation

```bash
# Core (already installed)
npm install @opencode-ai/plugin

# Dev dependencies (already installed)
npm install -D typescript @types/node @types/react @types/ink

# New for v3 — fast extraction
npm install -g repomix
# OR via npx (no global install)
npx repomix@latest

# System tools (usually pre-installed)
brew install ripgrep fd  # macOS
```

## Sources

- OpenCode Plugin SDK: @opencode-ai/plugin package docs
- Repomix: https://github.com/yamadashy/repomix (21.8k stars)
- GSD Framework: /Users/apple/.config/opencode/get-shit-done/ (local, v1.18.0)
- Ralph-tui patterns: /Users/apple/.agents/skills/ralph-tui-create-json/SKILL.md
- Spec-kit markers: /Users/apple/idumb-v2/src/lib/framework-detector.ts
