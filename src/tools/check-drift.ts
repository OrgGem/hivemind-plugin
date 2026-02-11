/**
 * check_drift — Verify current work against declared trajectory.
 * Agent Thought: "Am I still on track?"
 */
import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool";
import { createStateManager } from "../lib/persistence.js";
import { loadAnchors } from "../lib/anchors.js";
import { detectChainBreaks } from "../lib/chain-analysis.js";
import { calculateDriftScore } from "../schemas/brain-state.js";

export function createCheckDriftTool(directory: string): ToolDefinition {
  return tool({
    description:
      "Check if your current work aligns with your declared trajectory. " +
      "Returns a drift report with health indicators. Use before marking work complete.",
    args: {},
    async execute(_args, _context) {
      const stateManager = createStateManager(directory);
      const state = await stateManager.load();
      if (!state) {
        return "ERROR: No active session. Call declare_intent to start.";
      }
      const anchorsState = await loadAnchors(directory);
      const chainBreaks = detectChainBreaks(state);
      const driftScore = calculateDriftScore(state);

      const lines: string[] = [];
      lines.push("=== DRIFT REPORT ===");
      lines.push("");

      const healthEmoji = driftScore >= 70 ? "✅" : driftScore >= 40 ? "⚠️" : "❌";
      lines.push(`${healthEmoji} Drift Score: ${driftScore}/100`);
      lines.push("");

      lines.push("## Trajectory Alignment");
      if (state.hierarchy.trajectory) {
        lines.push(`Original: ${state.hierarchy.trajectory}`);
        if (state.hierarchy.tactic) lines.push(`Current tactic: ${state.hierarchy.tactic}`);
        if (state.hierarchy.action) lines.push(`Current action: ${state.hierarchy.action}`);
      } else {
        lines.push("⚠ No trajectory set. Use declare_intent to set your focus.");
      }
      lines.push("");

      lines.push("## Chain Integrity");
      if (chainBreaks.length === 0) {
        lines.push("✅ Hierarchy chain is intact.");
      } else {
        chainBreaks.forEach(b => lines.push(`❌ ${b.message}`));
      }
      lines.push("");

      if (anchorsState.anchors.length > 0) {
        lines.push("## Anchor Compliance");
        lines.push("Verify your work respects these immutable constraints:");
        anchorsState.anchors.forEach(a => lines.push(`  ☐ [${a.key}]: ${a.value}`));
        lines.push("");
      }

      lines.push("## Metrics");
      lines.push(`Turns: ${state.metrics.turn_count}`);
      lines.push(`Files: ${state.metrics.files_touched.length}`);
      lines.push(`Context updates: ${state.metrics.context_updates}`);
      if (state.metrics.violation_count > 0) {
        lines.push(`⚠ Violations: ${state.metrics.violation_count}`);
      }
      lines.push("");

      lines.push("## Recommendation");
      if (driftScore >= 70 && chainBreaks.length === 0) {
        lines.push("✅ On track. Continue working.");
      } else if (driftScore >= 40) {
        lines.push("⚠ Some drift detected. Consider using map_context to update your focus.");
      } else {
        lines.push("❌ Significant drift. Use map_context to re-focus, or compact_session to reset.");
      }
      lines.push("");
      lines.push("=== END DRIFT REPORT ===");
      return lines.join("\n");
    },
  });
}
