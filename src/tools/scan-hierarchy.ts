/**
 * scan_hierarchy — Structured read of current session state + optional drift analysis.
 * Agent Thought: "What am I working on right now?" / "Am I still on track?"
 *
 * Hierarchy Redesign: renders ASCII tree from hierarchy.json instead of flat strings.
 * Absorbs check_drift: when include_drift=true, appends drift report.
 */
import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool";
import { createStateManager } from "../lib/persistence.js";
import { loadAnchors } from "../lib/anchors.js";
import { loadMems, getShelfSummary } from "../lib/mems.js";
import {
  loadTree,
  toAsciiTree,
  getTreeStats,
  treeExists,
} from "../lib/hierarchy-tree.js";
import { detectChainBreaks } from "../lib/chain-analysis.js";
import { calculateDriftScore } from "../schemas/brain-state.js";

export function createScanHierarchyTool(directory: string): ToolDefinition {
  return tool({
    description:
      "Quick snapshot of your current session — hierarchy, metrics, anchors, and memories. " +
      "Set include_drift=true for alignment analysis with drift score, chain integrity, and recommendations. " +
      "For a deeper refocus with plan review, use think_back instead.",
    args: {
      include_drift: tool.schema
        .boolean()
        .optional()
        .describe("Include drift alignment analysis (default: false). Set true to check if work aligns with trajectory."),
      json: tool.schema
        .boolean()
        .optional()
        .describe("Return output as JSON (default: false)"),
    },
    async execute(args, _context) {
      const stateManager = createStateManager(directory);
      const state = await stateManager.load();
      if (!state) {
        return "ERROR: No active session. Call declare_intent to start.";
      }

      const lines: string[] = []
      lines.push(`📊 Session: ${state.session.governance_status} | Mode: ${state.session.mode}`)
      lines.push(`   ID: ${state.session.id}`)
      lines.push(``)

      // Hierarchy: prefer tree if available, fall back to flat strings
      if (treeExists(directory)) {
        const tree = await loadTree(directory);
        const stats = getTreeStats(tree);
        lines.push(`Hierarchy Tree (${stats.totalNodes} nodes, depth ${stats.depth}):`)
        lines.push(toAsciiTree(tree))
        if (stats.completedNodes > 0) {
          lines.push(`  Completed: ${stats.completedNodes} | Active: ${stats.activeNodes} | Pending: ${stats.pendingNodes}`)
        }
      } else {
        lines.push(`Hierarchy:`)
        lines.push(`  Trajectory: ${state.hierarchy.trajectory || '(not set)'}`)
        lines.push(`  Tactic: ${state.hierarchy.tactic || '(not set)'}`)
        lines.push(`  Action: ${state.hierarchy.action || '(not set)'}`)
      }
      lines.push(``)

      lines.push(`Metrics:`)
      lines.push(`  Turns: ${state.metrics.turn_count} | Drift: ${state.metrics.drift_score}/100`)
      lines.push(`  Files: ${state.metrics.files_touched.length} | Context updates: ${state.metrics.context_updates}`)

      // Anchors
      const anchorsState = await loadAnchors(directory)
      if (anchorsState.anchors.length > 0) {
        lines.push(``)
        lines.push(`Anchors (${anchorsState.anchors.length}):`)
        for (const a of anchorsState.anchors.slice(0, 5)) {
          lines.push(`  [${a.key}]: ${a.value.slice(0, 60)}`)
        }
        if (anchorsState.anchors.length > 5) {
          lines.push(`  ... and ${anchorsState.anchors.length - 5} more`)
        }
      }

      // Mems
      const memsState = await loadMems(directory)
      if (memsState.mems.length > 0) {
        const summary = getShelfSummary(memsState)
        const shelfInfo = Object.entries(summary).map(([k, v]) => `${k}(${v})`).join(', ')
        lines.push(``)
        lines.push(`Memories: ${memsState.mems.length} [${shelfInfo}]`)
      }

      // Drift analysis (absorbs check_drift)
      if (args.include_drift) {
        const chainBreaks = detectChainBreaks(state)
        const driftScore = calculateDriftScore(state)

        lines.push(``)
        lines.push(`=== DRIFT REPORT ===`)
        lines.push(``)

        const healthEmoji = driftScore >= 70 ? "✅" : driftScore >= 40 ? "⚠️" : "❌"
        lines.push(`${healthEmoji} Drift Score: ${driftScore}/100`)
        lines.push(``)

        lines.push(`## Chain Integrity`)
        if (chainBreaks.length === 0) {
          lines.push(`✅ Hierarchy chain is intact.`)
        } else {
          chainBreaks.forEach(b => lines.push(`❌ ${b.message}`))
        }
        lines.push(``)

        if (anchorsState.anchors.length > 0) {
          lines.push(`## Anchor Compliance`)
          lines.push(`Verify your work respects these immutable constraints:`)
          anchorsState.anchors.forEach(a => lines.push(`  ☐ [${a.key}]: ${a.value}`))
          lines.push(``)
        }

        lines.push(`## Recommendation`)
        if (driftScore >= 70 && chainBreaks.length === 0) {
          lines.push(`✅ On track. Continue working.`)
        } else if (driftScore >= 40) {
          lines.push(`⚠ Some drift detected. Consider using map_context to update your focus.`)
        } else {
          lines.push(`❌ Significant drift. Use map_context to re-focus, or compact_session to reset.`)
        }
        lines.push(`=== END DRIFT REPORT ===`)
      }

      if (!args.include_drift) {
        lines.push(``)
        lines.push(`→ Use scan_hierarchy with include_drift=true for alignment analysis, or think_back for a full context refresh.`)
      }

      if (args.json) {
        const data: Record<string, unknown> = {
          session: { id: state.session.id, mode: state.session.mode, status: state.session.governance_status },
          hierarchy: { trajectory: state.hierarchy.trajectory, tactic: state.hierarchy.tactic, action: state.hierarchy.action },
          metrics: { turns: state.metrics.turn_count, drift_score: state.metrics.drift_score, files: state.metrics.files_touched.length, context_updates: state.metrics.context_updates },
          anchors: anchorsState.anchors.map(a => ({ key: a.key, value: a.value })),
        }
        if (args.include_drift) {
          const chainBreaks = detectChainBreaks(state)
          data.drift = { score: calculateDriftScore(state), chain_intact: chainBreaks.length === 0, breaks: chainBreaks.map(b => b.message) }
        }
        return JSON.stringify(data, null, 2)
      }

      return lines.join('\n')
    },
  });
}
