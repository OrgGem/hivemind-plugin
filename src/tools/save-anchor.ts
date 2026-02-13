/**
 * save_anchor — Save, list, or get immutable facts that persist across compactions.
 * Agent Thought: "I must remember this constraint." / "What constraints exist?"
 *
 * HC4 Compliant: symmetric read/write via mode param.
 *   mode=save (default): save a key/value anchor
 *   mode=list: show all anchors
 *   mode=get: retrieve a specific anchor by key
 */
import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool";
import { createStateManager } from "../lib/persistence.js";
import { loadAnchors, saveAnchors, addAnchor } from "../lib/anchors.js";

export function createSaveAnchorTool(directory: string): ToolDefinition {
  return tool({
    description:
      "Manage immutable anchors that persist across session compaction. " +
      "mode=save (default): save a critical constraint (key + value required). " +
      "mode=list: show all saved anchors. " +
      "mode=get: retrieve a specific anchor by key.",
    args: {
      mode: tool.schema
        .enum(["save", "list", "get"])
        .optional()
        .describe("Operation mode: 'save' (default), 'list', or 'get'"),
      key: tool.schema
        .string()
        .optional()
        .describe("Anchor key. Required for save and get modes (e.g., 'DB_SCHEMA', 'API_PORT')"),
      value: tool.schema
        .string()
        .optional()
        .describe("The immutable fact or constraint. Required for save mode."),
      json: tool.schema
        .boolean()
        .optional()
        .describe("Return output as JSON (default: false)"),
    },
    async execute(args, _context) {
      const mode = args.mode || "save";

      // List mode: show all anchors
      if (mode === "list") {
        const anchorsState = await loadAnchors(directory);
        if (anchorsState.anchors.length === 0) {
          return "No anchors saved. Use save_anchor to store critical constraints.";
        }
        const lines: string[] = [];
        lines.push(`=== ANCHORS (${anchorsState.anchors.length}) ===`);
        lines.push("");
        for (const a of anchorsState.anchors) {
          const date = new Date(a.created_at).toISOString().split("T")[0];
          lines.push(`[${a.key}] = ${a.value}`);
          lines.push(`  Session: ${a.session_id} | Created: ${date}`);
          lines.push("");
        }
        lines.push("=== END ANCHORS ===");
        if (args.json) {
          return JSON.stringify({ anchors: anchorsState.anchors.map(a => ({ key: a.key, value: a.value, session_id: a.session_id, created_at: a.created_at })) }, null, 2)
        }
        return lines.join("\n");
      }

      // Get mode: retrieve a specific anchor
      if (mode === "get") {
        if (!args.key?.trim()) return "ERROR: key is required for get mode.";
        const anchorsState = await loadAnchors(directory);
        const anchor = anchorsState.anchors.find(a => a.key === args.key);
        if (!anchor) {
          return `No anchor found with key "${args.key}". Use save_anchor with mode=list to see all anchors.`;
        }
        const date = new Date(anchor.created_at).toISOString().split("T")[0];
        if (args.json) {
          return JSON.stringify({ key: anchor.key, value: anchor.value, session_id: anchor.session_id, created_at: anchor.created_at }, null, 2)
        }
        return `[${anchor.key}] = ${anchor.value}\nSession: ${anchor.session_id} | Created: ${date}`;
      }

      // Save mode (default)
      if (!args.key?.trim()) return "ERROR: key cannot be empty. Use a descriptive name like 'DB_SCHEMA' or 'API_PORT'.";
      if (!args.value?.trim()) return "ERROR: value cannot be empty. Describe the constraint or fact.";

      const stateManager = createStateManager(directory);
      const state = await stateManager.load();
      const sessionId = state ? state.session.id : "unknown";
      const noSessionWarning = state ? "" : " (⚠ no active session — anchor saved but unlinked)";

      let anchorsState = await loadAnchors(directory);

      // Detect existing anchor before upsert to show delta
      const existing = anchorsState.anchors.find(a => a.key === args.key);

      anchorsState = addAnchor(anchorsState, args.key!, args.value!, sessionId);
      await saveAnchors(directory, anchorsState);

      const count = anchorsState.anchors.length;
      if (existing) {
        return `Anchor updated: [${args.key}] (was: "${existing.value.slice(0, 50)}", now: "${args.value!.slice(0, 50)}"). ${count} total anchors.${noSessionWarning}`;
      } else {
        return `Anchor saved: [${args.key}] = "${args.value!.slice(0, 50)}". ${count} total anchors.${noSessionWarning}`;
      }
    },
  });
}
