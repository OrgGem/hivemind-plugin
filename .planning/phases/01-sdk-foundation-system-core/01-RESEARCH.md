# Phase 1 Research: OpenCode SDK TUI Capabilities

**Research Task:** SDK-RESEARCH-01  
**Phase:** 01 - SDK Foundation + System Core  
**Date:** 2026-02-12  
**Status:** ✅ COMPLETE

---

## Findings

### TUI APIs Available

The OpenCode SDK (`@opencode-ai/sdk`) exposes a `Tui` class with the following methods:

| Method | Purpose | Notes |
|--------|---------|-------|
| `showToast()` | Display toast notification | ✅ Available - visual feedback for governance |
| `openHelp()` | Open help dialog | Opens built-in help panel |
| `openSessions()` | Open session dialog | Opens built-in sessions panel |
| `openThemes()` | Open theme dialog | Opens built-in themes panel |
| `openModels()` | Open model dialog | Opens built-in models panel |
| `appendPrompt()` | Append text to prompt | For prompt manipulation |
| `submitPrompt()` | Submit current prompt | Triggers AI response |
| `clearPrompt()` | Clear prompt input | Resets prompt area |
| `executeCommand()` | Execute TUI command | e.g., `agent_cycle` |
| `publish()` | Publish TUI event | Event bus integration |
| `control.next()` | Get next TUI request | Control queue interaction |
| `control.response()` | Submit TUI response | Control queue response |

### Critical Finding: No Custom Panel Support

**Custom panels are NOT supported.** There is NO `registerPanel()`, `createPanel()`, or similar API in the SDK.

Plugins CANNOT:
- Register custom sidebar panels
- Create custom tab views
- Embed custom TUI components
- Position UI elements arbitrarily

Plugins CAN only:
- Show toast notifications via `showToast()`
- Open existing built-in dialogs (sessions, themes, models, help)
- Append/submit/clear prompt text
- Execute predefined TUI commands
- Publish events to the TUI event bus

### Technical Constraints Identified

1. **Panel lifecycle:** Managed entirely by OpenCode host — plugins cannot control
2. **State ownership:** TUI state is host-owned — plugins interact via API calls only
3. **Event handling:** Limited to publish/subscribe pattern — no custom keyboard handlers
4. **Render limits:** Toast notifications only — no custom render surfaces
5. **UX constraints:** No custom titles/icons for plugin-created content

### Reference: SDK Client Structure

```typescript
class OpencodeClient {
  tui: Tui          // TUI operations (toast, dialogs, prompt control)
  session: Session  // Session lifecycle (create, get, messages, etc.)
  file: File        // File operations (read, list, status)
  find: Find        // Search operations (text, files, symbols)
  event: Event      // Event subscription (SSE)
  // ... other namespaces
}
```

---

## Recommendation

### ✅ DECISION: Defer Embedded Dashboard to v2

**Reasoning:**
- Custom panels not supported by current SDK
- `showToast()` is sufficient for Phase 2 governance visual feedback
- Building a standalone TUI dashboard (Ink-based) is out of scope for Phase 1
- Requesting upstream feature adds dependency we can't control

**Impact on Phase 1:**
- Proceed with original 2-plan scope (01-01, 01-02)
- No additional TUI panel work needed
- `showToast()` will be used in Phase 2 for drift alerts and governance feedback

### Updated v2 Requirements

If custom panels become available in future SDK versions:

```
SDK-06: Embedded dashboard panel using client.tui.registerPanel() (when available)
SDK-07: Real-time session metrics visualization in panel
SDK-08: Hierarchy tree visualization via custom panel
```

---

## Deliverables

1. ✅ **Research Report** (this file) — Documents TUI API surface and constraints
2. ✅ **Recommendation** — Defer embedded dashboard to v2
3. ✅ **Updated Planning** — Phase 1 proceeds with original scope

---

## References

- `@opencode-ai/sdk/dist/gen/sdk.gen.d.ts` — SDK type definitions
- `@opencode-ai/plugin/dist/index.d.ts` — Plugin input types
- `client.tui.showToast()` — Primary UI integration point for governance

---

*Research completed: 2026-02-12*
*Next: Proceed with Phase 1 execution (2 plans, no panel work required)*
