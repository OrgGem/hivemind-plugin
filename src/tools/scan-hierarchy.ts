/**
 * scan_hierarchy — Structured read of current session state.
 * Agent Thought: "What am I working on right now?"
 */
import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool";
import { createStateManager } from "../lib/persistence.js";
import { loadAnchors } from "../lib/anchors.js";

export function createScanHierarchyTool(directory: string): ToolDefinition {
  return tool({
    description:
      "See your current session state — hierarchy, metrics, and anchors. " +
      "Call this when you want to know what you're working on.",
    args: {},
    async execute(_args, _context) {
      const stateManager = createStateManager(directory);
      const state = await stateManager.load();
      if (!state) {
        return "No active session. Call declare_intent to start.";
      }
      const anchorsState = await loadAnchors(directory);
      const result = {
        session: {
          id: state.session.id,
          mode: state.session.mode,
          status: state.session.governance_status,
          date: state.session.date,
          role: state.session.role,
        },
        hierarchy: {
          trajectory: state.hierarchy.trajectory || "(not set)",
          tactic: state.hierarchy.tactic || "(not set)",
          action: state.hierarchy.action || "(not set)",
        },
        metrics: {
          turns: state.metrics.turn_count,
          drift_score: state.metrics.drift_score,
          files_touched: state.metrics.files_touched.length,
          context_updates: state.metrics.context_updates,
        },
        anchors: anchorsState.anchors.map(a => `[${a.key}]: ${a.value}`),
      };
      return JSON.stringify(result, null, 2);
    },
  });
}
