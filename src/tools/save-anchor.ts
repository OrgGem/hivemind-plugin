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
      "even after session compaction. Use for database schemas, API keys, requirements.",
    args: {
      key: tool.schema.string().describe("Short label for the anchor (e.g., 'DB_SCHEMA', 'API_PORT')"),
      value: tool.schema.string().describe("The immutable fact or constraint"),
    },
    async execute(args, _context) {
      const stateManager = createStateManager(directory);
      const state = await stateManager.load();
      const sessionId = state?.session.id || "unknown";
      let anchorsState = await loadAnchors(directory);
      anchorsState = addAnchor(anchorsState, args.key, args.value, sessionId);
      await saveAnchors(directory, anchorsState);
      return `Anchor saved: [${args.key}] = "${args.value}". ${anchorsState.anchors.length} total anchors.`;
    },
  });
}
