/**
 * save_anchor — Save an immutable fact that persists across compactions.
 * Agent Thought: "I must remember this constraint."
 */
import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool";
import { createStateManager } from "../lib/persistence.js";
import { loadAnchors, saveAnchors, addAnchor } from "../lib/anchors.js";

export function createSaveAnchorTool(directory: string): ToolDefinition {
  return tool({
    description:
      "Save a critical constraint or fact that must not be forgotten, " +
      "even after session compaction. Use for database schemas, API endpoints, port numbers, architectural constraints.",
    args: {
      key: tool.schema.string().describe("Short label for the anchor (e.g., 'DB_SCHEMA', 'API_PORT')"),
      value: tool.schema.string().describe("The immutable fact or constraint"),
    },
    async execute(args, _context) {
      if (!args.key?.trim()) return "ERROR: key cannot be empty. Use a descriptive name like 'DB_SCHEMA' or 'API_PORT'.";
      if (!args.value?.trim()) return "ERROR: value cannot be empty. Describe the constraint or fact.";

      const stateManager = createStateManager(directory);
      const state = await stateManager.load();
      const sessionId = state ? state.session.id : "unknown";
      const noSessionWarning = state ? "" : " (⚠ no active session — anchor saved but unlinked)";

      let anchorsState = await loadAnchors(directory);

      // Detect existing anchor before upsert to show delta
      const existing = anchorsState.anchors.find(a => a.key === args.key);

      anchorsState = addAnchor(anchorsState, args.key, args.value, sessionId);
      await saveAnchors(directory, anchorsState);

      const count = anchorsState.anchors.length;
      if (existing) {
        return `Anchor updated: [${args.key}] (was: "${existing.value.slice(0, 50)}", now: "${args.value.slice(0, 50)}"). ${count} total anchors.${noSessionWarning}\n→ Use scan_hierarchy to see all anchors.`;
      } else {
        return `Anchor saved: [${args.key}] = "${args.value.slice(0, 50)}". ${count} total anchors.${noSessionWarning}\n→ Use scan_hierarchy to see all anchors.`;
      }
    },
  });
}
