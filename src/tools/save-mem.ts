/**
 * save_mem — Save a memory to the Mems Brain.
 *
 * Agent Thought: "I should remember this for future sessions."
 *
 * Design:
 *   1. Iceberg — 2 required args (shelf, content)
 *   2. Context Inference — session ID from brain state
 *   3. Signal-to-Noise — 1-line confirmation
 */
import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool";
import { createStateManager } from "../lib/persistence.js";
import { loadMems, saveMems, addMem, BUILTIN_SHELVES } from "../lib/mems.js";

export function createSaveMemTool(directory: string): ToolDefinition {
  return tool({
    description:
      "Save a memory to the Mems Brain — decisions, patterns, errors, solutions. " +
      "These persist across sessions and compactions. Use for lessons learned, architecture decisions, error patterns.",
    args: {
      shelf: tool.schema
        .string()
        .describe(
          `Category: ${BUILTIN_SHELVES.join(", ")} (or custom)`
        ),
      content: tool.schema
        .string()
        .describe("The memory content to save"),
      tags: tool.schema
        .string()
        .optional()
        .describe("Comma-separated tags for searchability (e.g., 'auth,jwt,middleware')"),
    },
    async execute(args) {
      const stateManager = createStateManager(directory);
      const state = await stateManager.load();
      const sessionId = state?.session.id || "unknown";

      const tagList = args.tags
        ? args.tags.split(",").map((t: string) => t.trim()).filter(Boolean)
        : [];

      let memsState = await loadMems(directory);
      memsState = addMem(memsState, args.shelf, args.content, tagList, sessionId);
      await saveMems(directory, memsState);

      return `Memory saved to [${args.shelf}]. ${memsState.mems.length} total memories. Tags: ${tagList.length > 0 ? tagList.join(", ") : "(none)"}`;
    },
  });
}
