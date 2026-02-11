/**
 * recall_mems — Search the Mems Brain for relevant memories.
 *
 * Agent Thought: "Have I seen this problem/pattern before?"
 *
 * Design:
 *   1. Iceberg — 1 required arg (query)
 *   2. Context Inference — reads mems.json, optional shelf filter
 *   3. Signal-to-Noise — structured search results
 */
import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool";
import { loadMems, searchMems } from "../lib/mems.js";

const MAX_RESULTS = 5;

export function createRecallMemsTool(directory: string): ToolDefinition {
  return tool({
    description:
      "Search the Mems Brain for relevant memories by keyword. " +
      "Returns matching decisions, patterns, errors, and solutions from all sessions. " +
      "Use when you encounter a familiar problem or need past context.",
    args: {
      query: tool.schema
        .string()
        .describe("Search keyword (matches content and tags, case-insensitive)"),
      shelf: tool.schema
        .string()
        .optional()
        .describe("Optional: filter results to a specific shelf (e.g., 'errors', 'decisions')"),
    },
    async execute(args, _context) {
      const memsState = await loadMems(directory);

      if (memsState.mems.length === 0) {
        return "Mems Brain is empty. Use save_mem to store memories first.";
      }

      const results = searchMems(memsState, args.query, args.shelf);

      if (results.length === 0) {
        const filterNote = args.shelf ? ` in shelf "${args.shelf}"` : "";
        return `No memories found for "${args.query}"${filterNote}. Try a broader search or different keywords.`;
      }

      const shown = results.slice(0, MAX_RESULTS);
      const lines: string[] = [];
      lines.push(`=== RECALL: ${results.length} memories found for "${args.query}" ===`);
      lines.push("");

      for (const m of shown) {
        const date = new Date(m.created_at).toISOString().split("T")[0];
        lines.push(`[${m.shelf}] ${m.id} (${date})`);
        lines.push(`  ${m.content}`);
        if (m.tags.length > 0) {
          lines.push(`  Tags: ${m.tags.join(", ")}`);
        }
        lines.push("");
      }

      if (results.length > MAX_RESULTS) {
        lines.push(`... and ${results.length - MAX_RESULTS} more. Narrow your search or filter by shelf.`);
      }

      lines.push("=== END RECALL ===");
      return lines.join("\n");
    },
  });
}
