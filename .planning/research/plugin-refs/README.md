# Plugin Reference Library

Research corpus of OpenCode plugin repos downloaded via [Repomix](https://github.com/yamadashy/repomix) for local grep/search analysis.

**Last downloaded:** 2026-02-12

## Repos

| File | Repo | What It Does | Key Patterns |
|------|------|-------------|--------------|
| `dynamic-context-pruning.xml` | [Tarquinen/opencode-dynamic-context-pruning](https://github.com/Tarquinen/opencode-dynamic-context-pruning) | Context window management — prune/distill/compress tools | `messages.transform`, custom context pruning |
| `micode.xml` | [vtemian/micode](https://github.com/vtemian/micode) | Mindmodel injection + constraint review system | `plugin()` wrapper, `chat.params`, `client.session.create/prompt/delete` |
| `oh-my-opencode.xml` | [code-yeongyu/oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode) | Full ecosystem plugin (41 internal hooks, dynamic tools) | SDK client, showToast, serverUrl, ralph-loop hook, event system |
| `opencode-pty.xml` | [shekohex/opencode-pty](https://github.com/shekohex/opencode-pty) | Pseudo-terminal sessions for persistent processes | 5 pty tools, SDK client for permissions + toasts |
| `opencode-sdk.xml` | [sst/opencode](https://github.com/sst/opencode) (packages/plugin + packages/sdk) | Official OpenCode SDK source | Plugin types, SDK client, tool() helper, BunShell |
| `opencode-worktree.xml` | [kdcokenny/opencode-worktree](https://github.com/kdcokenny/opencode-worktree) | Git worktree management | `session.idle` event, SDK Event type |
| `opencode-zellij-namer.xml` | [24601/opencode-zellij-namer](https://github.com/24601/opencode-zellij-namer) | Auto-rename Zellij tabs from context | Standalone event listener, Google Gemini |
| `plannotator.xml` | [backnotprop/plannotator](https://github.com/backnotprop/plannotator) | Plan annotation + review system | `submit_plan` tool, system prompt injection, `ctx.client` for sessions |
| `subtask2.xml` | [spoons-and-mirrors/subtask2](https://github.com/spoons-and-mirrors/subtask2) | Subtask orchestration + loop control | `setClient()`, `messages.transform`, `command.execute.before`, loop state |

## How to Download / Refresh

```bash
cd .planning/research/plugin-refs

# All repos (compressed XML — signatures only, no implementation bodies)
npx repomix --remote Tarquinen/opencode-dynamic-context-pruning --output dynamic-context-pruning.xml --compress
npx repomix --remote shekohex/opencode-pty --output opencode-pty.xml --compress
npx repomix --remote code-yeongyu/oh-my-opencode --output oh-my-opencode.xml --compress
npx repomix --remote 24601/opencode-zellij-namer --output opencode-zellij-namer.xml --compress
npx repomix --remote backnotprop/plannotator --output plannotator.xml --compress
npx repomix --remote vtemian/micode --output micode.xml --compress
npx repomix --remote kdcokenny/opencode-worktree --output opencode-worktree.xml --compress
npx repomix --remote spoons-and-mirrors/subtask2 --output subtask2.xml --compress

# OpenCode SDK source (plugin + sdk packages only)
npx repomix --include "packages/plugin/**,packages/sdk/**" --remote sst/opencode --output opencode-sdk.xml --compress
```

## How to Research

```bash
# Search across all plugins for a pattern
rg "showToast" .planning/research/plugin-refs/

# Find how plugins use the SDK client
rg "client\.session\." .planning/research/plugin-refs/

# Find hook implementations
rg "tool\.execute\.after" .planning/research/plugin-refs/

# Find tool registrations
rg "tool\(" .planning/research/plugin-refs/ --include "*.xml"
```

## Adding New Repos

1. Find the GitHub repo URL
2. Run: `npx repomix --remote owner/repo --output repo-name.xml --compress`
3. Update this README table
4. Use `rg` to search the downloaded XML

Also see: [opencode.cafe](https://www.opencode.cafe/) for the community plugin directory.

---

*The .xml files are gitignored (too large). This README + download commands are committed so anyone can reproduce the research corpus.*
