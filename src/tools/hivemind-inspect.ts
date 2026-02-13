/**
 * hivemind_inspect — Unified inspection tool for session state and drift analysis.
 *
 * Merged from: scan_hierarchy, think_back, check_drift
 * Actions: scan (quick snapshot), deep (full context refresh), drift (alignment check)
 *
 * Design:
 *   1. Iceberg — minimal args, system handles state reads
 *   2. Context Inference — reads from brain.json, hierarchy.json, anchors.json
 *   3. Signal-to-Noise — structured output with actionable guidance
 *   4. HC5 Compliance — --json flag for deterministic machine-parseable output
 */

import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import { createStateManager } from "../lib/persistence.js"
import { loadAnchors } from "../lib/anchors.js"
import { loadMems, getShelfSummary } from "../lib/mems.js"
import { detectChainBreaks } from "../lib/chain-analysis.js"
import { calculateDriftScore } from "../schemas/brain-state.js"
import { readActiveMd } from "../lib/planning-fs.js"
import {
  loadTree,
  toAsciiTree,
  getAncestors,
  getCursorNode,
  detectGaps,
  treeExists,
  getTreeStats,
} from "../lib/hierarchy-tree.js"

interface JsonOutput {
  success: boolean
  action: string
  data: Record<string, unknown>
  timestamp: string
}

function toJsonOutput(action: string, data: Record<string, unknown>): string {
  return JSON.stringify({
    success: true,
    action,
    data,
    timestamp: new Date().toISOString(),
  } as JsonOutput)
}

export function createHivemindInspectTool(directory: string): ToolDefinition {
  return tool({
    description:
      "Inspect your session state and alignment. " +
      "Actions: scan (quick snapshot), deep (full context refresh), drift (alignment check). " +
      "Use --json for machine-parseable output.",
    args: {
      action: tool.schema
        .enum(["scan", "deep", "drift"])
        .describe("What to do: scan | deep | drift"),
      json: tool.schema
        .boolean()
        .optional()
        .describe("Output as machine-parseable JSON (HC5)"),
    },
    async execute(args, _context) {
      const jsonOutput = args.json ?? false

      switch (args.action) {
        case "scan":
          return handleScan(directory, jsonOutput)
        case "deep":
          return handleDeep(directory, jsonOutput)
        case "drift":
          return handleDrift(directory, jsonOutput)
        default:
          return jsonOutput
            ? toJsonOutput("error", { message: `Unknown action: ${args.action}` })
            : `ERROR: Unknown action. Use scan, deep, or drift.`
      }
    },
  })
}

/**
 * scan — Quick snapshot of current session state.
 * Merged from: scan_hierarchy
 */
async function handleScan(directory: string, jsonOutput: boolean): Promise<string> {
  const stateManager = createStateManager(directory)
  const state = await stateManager.load()

  if (!state) {
    return jsonOutput
      ? toJsonOutput("scan", { error: "no session", active: false })
      : "ERROR: No active session. Call hivemind_session start to begin."
  }

  const anchorsState = await loadAnchors(directory)
  const memsState = await loadMems(directory)
  const tree = treeExists(directory) ? await loadTree(directory) : null
  const treeStats = tree?.root ? getTreeStats(tree) : null

  if (jsonOutput) {
    return toJsonOutput("scan", {
      active: true,
      sessionId: state.session.id,
      governanceStatus: state.session.governance_status,
      mode: state.session.mode,
      hierarchy: {
        trajectory: state.hierarchy.trajectory,
        tactic: state.hierarchy.tactic,
        action: state.hierarchy.action,
      },
      metrics: {
        turnCount: state.metrics.turn_count,
        driftScore: state.metrics.drift_score,
        filesTouched: state.metrics.files_touched.length,
        contextUpdates: state.metrics.context_updates,
      },
      treeStats: treeStats ? {
        totalNodes: treeStats.totalNodes,
        depth: treeStats.depth,
        activeNodes: treeStats.activeNodes,
        completedNodes: treeStats.completedNodes,
      } : null,
      anchorCount: anchorsState.anchors.length,
      memCount: memsState.mems.length,
    })
  }

  const lines: string[] = []
  lines.push(`📊 Session: ${state.session.governance_status} | Mode: ${state.session.mode}`)
  lines.push(`   ID: ${state.session.id}`)
  lines.push("")

  // Hierarchy tree
  if (tree?.root) {
    lines.push(`Hierarchy Tree (${treeStats?.totalNodes} nodes, depth ${treeStats?.depth}):`)
    lines.push(toAsciiTree(tree))
    if (treeStats && treeStats.completedNodes > 0) {
      lines.push(`  Completed: ${treeStats.completedNodes} | Active: ${treeStats.activeNodes} | Pending: ${treeStats.pendingNodes}`)
    }
  } else {
    lines.push("Hierarchy:")
    lines.push(`  Trajectory: ${state.hierarchy.trajectory || "(not set)"}`)
    lines.push(`  Tactic: ${state.hierarchy.tactic || "(not set)"}`)
    lines.push(`  Action: ${state.hierarchy.action || "(not set)"}`)
  }
  lines.push("")

  lines.push("Metrics:")
  lines.push(`  Turns: ${state.metrics.turn_count} | Drift: ${state.metrics.drift_score}/100`)
  lines.push(`  Files: ${state.metrics.files_touched.length} | Context updates: ${state.metrics.context_updates}`)

  // Anchors
  if (anchorsState.anchors.length > 0) {
    lines.push("")
    lines.push(`Anchors (${anchorsState.anchors.length}):`)
    for (const a of anchorsState.anchors.slice(0, 5)) {
      lines.push(`  [${a.key}]: ${a.value.slice(0, 60)}`)
    }
    if (anchorsState.anchors.length > 5) {
      lines.push(`  ... and ${anchorsState.anchors.length - 5} more`)
    }
  }

  // Mems
  if (memsState.mems.length > 0) {
    const summary = getShelfSummary(memsState)
    const shelfInfo = Object.entries(summary).map(([k, v]) => `${k}(${v})`).join(", ")
    lines.push("")
    lines.push(`Memories: ${memsState.mems.length} [${shelfInfo}]`)
  }

  return lines.join("\n") + "\n→ Use hivemind_inspect drift for alignment analysis, or deep for full context refresh."
}

/**
 * deep — Full context refresh with plan review and chain analysis.
 * Merged from: think_back
 */
async function handleDeep(directory: string, jsonOutput: boolean): Promise<string> {
  const stateManager = createStateManager(directory)
  const state = await stateManager.load()

  if (!state) {
    return jsonOutput
      ? toJsonOutput("deep", { error: "no session", active: false })
      : "ERROR: No active session. Call hivemind_session start to begin."
  }

  const anchorsState = await loadAnchors(directory)
  const activeMd = await readActiveMd(directory)
  const chainBreaks = detectChainBreaks(state)
  const tree = treeExists(directory) ? await loadTree(directory) : null

  if (jsonOutput) {
    const cursorNode = tree?.root && tree.cursor ? getCursorNode(tree) : null
    const ancestors = tree?.root && tree.cursor ? getAncestors(tree.root, tree.cursor) : []
    const gaps = tree?.root ? detectGaps(tree) : []

    return toJsonOutput("deep", {
      active: true,
      sessionId: state.session.id,
      mode: state.session.mode,
      hierarchy: {
        trajectory: state.hierarchy.trajectory,
        tactic: state.hierarchy.tactic,
        action: state.hierarchy.action,
      },
      cursor: cursorNode ? {
        id: cursorNode.id,
        level: cursorNode.level,
        content: cursorNode.content,
        status: cursorNode.status,
      } : null,
      cursorPath: ancestors.map(n => ({ level: n.level, content: n.content, stamp: n.stamp })),
      metrics: {
        turnCount: state.metrics.turn_count,
        driftScore: state.metrics.drift_score,
        filesTouched: state.metrics.files_touched.length,
        contextUpdates: state.metrics.context_updates,
      },
      chainBreaks: chainBreaks.map(b => b.message),
      staleGaps: gaps.filter(g => g.severity === "stale").map(g => ({
        from: g.from,
        to: g.to,
        gapHours: Math.round(g.gapMs / (60 * 60 * 1000) * 10) / 10,
        relationship: g.relationship,
      })),
      anchors: anchorsState.anchors.map(a => ({ key: a.key, value: a.value })),
      filesTouched: state.metrics.files_touched.slice(0, 10),
    })
  }

  const lines: string[] = []
  lines.push("=== DEEP INSPECT: Context Refresh ===")
  lines.push("")

  lines.push("## Where You Are")
  lines.push(`Mode: ${state.session.mode}`)

  // Hierarchy tree
  if (tree?.root) {
    lines.push("")
    lines.push("Hierarchy Tree:")
    lines.push(toAsciiTree(tree))

    // Cursor ancestry
    const cursorNode = getCursorNode(tree)
    if (cursorNode) {
      const ancestors = getAncestors(tree.root, cursorNode.id)
      if (ancestors.length > 1) {
        lines.push("")
        lines.push("Cursor path:")
        for (const node of ancestors) {
          lines.push(`  ${node.level}: ${node.content} (${node.stamp})`)
        }
      }
    }

    // Timestamp gaps
    const gaps = detectGaps(tree)
    const staleGaps = gaps.filter(g => g.severity === "stale")
    if (staleGaps.length > 0) {
      lines.push("")
      lines.push("⚠ Stale gaps detected:")
      for (const gap of staleGaps.slice(0, 3)) {
        const hours = Math.round(gap.gapMs / (60 * 60 * 1000) * 10) / 10
        lines.push(`  ${gap.from} → ${gap.to}: ${hours}hr (${gap.relationship})`)
      }
    }
  } else {
    if (state.hierarchy.trajectory) lines.push(`Trajectory: ${state.hierarchy.trajectory}`)
    if (state.hierarchy.tactic) lines.push(`Tactic: ${state.hierarchy.tactic}`)
    if (state.hierarchy.action) lines.push(`Action: ${state.hierarchy.action}`)
  }
  lines.push("")

  lines.push("## Session Health")
  lines.push(`Turns: ${state.metrics.turn_count} | Drift: ${state.metrics.drift_score}/100`)
  lines.push(`Files touched: ${state.metrics.files_touched.length}`)
  lines.push(`Context updates: ${state.metrics.context_updates}`)
  if (chainBreaks.length > 0) {
    lines.push("⚠ Chain breaks:")
    chainBreaks.forEach(b => lines.push(`  - ${b.message}`))
  }
  lines.push("")

  if (anchorsState.anchors.length > 0) {
    lines.push("## Immutable Anchors")
    const anchorsToShow = anchorsState.anchors.slice(0, 5)
    for (const a of anchorsToShow) {
      lines.push(`  [${a.key}]: ${a.value}`)
    }
    if (anchorsState.anchors.length > 5) {
      lines.push(`  ... and ${anchorsState.anchors.length - 5} more anchors`)
    }
    lines.push("")
  }

  if (state.metrics.files_touched.length > 0) {
    lines.push("## Files Touched")
    const maxShow = 10
    state.metrics.files_touched.slice(0, maxShow).forEach(f => lines.push(`  - ${f}`))
    if (state.metrics.files_touched.length > maxShow) {
      lines.push(`  ... and ${state.metrics.files_touched.length - maxShow} more`)
    }
    lines.push("")
  }

  // Plan section from active.md
  if (activeMd.body.includes("## Plan")) {
    const planStart = activeMd.body.indexOf("## Plan")
    const planEnd = activeMd.body.indexOf("\n## ", planStart + 1)
    const planSection = planEnd > -1
      ? activeMd.body.substring(planStart, planEnd)
      : activeMd.body.substring(planStart)
    const planContent = planSection.trim()
    const planLines = planContent.split("\n")
    if (planLines.length > 10) {
      lines.push(...planLines.slice(0, 10))
      lines.push(`  ... (${planLines.length - 10} more lines)`)
    } else {
      lines.push(...planLines)
    }
    lines.push("")
  }

  lines.push("=== END DEEP INSPECT ===")
  let result = lines.join("\n") + "\n→ Use hivemind_session update to change focus, or close to archive."
  if (result.length > 2000) {
    result = result.slice(0, 1970) + "\n... (output truncated)"
  }
  return result
}

/**
 * drift — Verify current work against declared trajectory.
 * Merged from: check_drift
 */
async function handleDrift(directory: string, jsonOutput: boolean): Promise<string> {
  const stateManager = createStateManager(directory)
  const state = await stateManager.load()

  if (!state) {
    return jsonOutput
      ? toJsonOutput("drift", { error: "no session", active: false })
      : "ERROR: No active session. Call hivemind_session start to begin."
  }

  const anchorsState = await loadAnchors(directory)
  const chainBreaks = detectChainBreaks(state)
  const driftScore = calculateDriftScore(state)

  if (jsonOutput) {
    return toJsonOutput("drift", {
      active: true,
      driftScore,
      healthStatus: driftScore >= 70 ? "good" : driftScore >= 40 ? "warning" : "critical",
      hierarchy: {
        trajectory: state.hierarchy.trajectory,
        tactic: state.hierarchy.tactic,
        action: state.hierarchy.action,
      },
      chainBreaks: chainBreaks.map(b => b.message),
      chainIntact: chainBreaks.length === 0,
      anchors: anchorsState.anchors.map(a => ({ key: a.key, value: a.value })),
      metrics: {
        turnCount: state.metrics.turn_count,
        filesTouched: state.metrics.files_touched.length,
        contextUpdates: state.metrics.context_updates,
        violationCount: state.metrics.violation_count,
      },
      recommendation: driftScore >= 70 && chainBreaks.length === 0
        ? "on_track"
        : driftScore >= 40
          ? "some_drift"
          : "significant_drift",
    })
  }

  const lines: string[] = []
  lines.push("=== DRIFT REPORT ===")
  lines.push("")

  const healthEmoji = driftScore >= 70 ? "✅" : driftScore >= 40 ? "⚠️" : "❌"
  lines.push(`${healthEmoji} Drift Score: ${driftScore}/100`)
  lines.push("")

  lines.push("## Trajectory Alignment")
  if (state.hierarchy.trajectory) {
    lines.push(`Original: ${state.hierarchy.trajectory}`)
    if (state.hierarchy.tactic) lines.push(`Current tactic: ${state.hierarchy.tactic}`)
    if (state.hierarchy.action) lines.push(`Current action: ${state.hierarchy.action}`)
  } else {
    lines.push("⚠ No trajectory set. Use hivemind_session start to set your focus.")
  }
  lines.push("")

  lines.push("## Chain Integrity")
  if (chainBreaks.length === 0) {
    lines.push("✅ Hierarchy chain is intact.")
  } else {
    chainBreaks.forEach(b => lines.push(`❌ ${b.message}`))
  }
  lines.push("")

  if (anchorsState.anchors.length > 0) {
    lines.push("## Anchor Compliance")
    lines.push("Verify your work respects these immutable constraints:")
    anchorsState.anchors.forEach(a => lines.push(`  ☐ [${a.key}]: ${a.value}`))
    lines.push("")
  }

  lines.push("## Metrics")
  lines.push(`Turns: ${state.metrics.turn_count}`)
  lines.push(`Files: ${state.metrics.files_touched.length}`)
  lines.push(`Context updates: ${state.metrics.context_updates}`)
  if (state.metrics.violation_count > 0) {
    lines.push(`⚠ Violations: ${state.metrics.violation_count}`)
  }
  lines.push("")

  lines.push("## Recommendation")
  if (driftScore >= 70 && chainBreaks.length === 0) {
    lines.push("✅ On track. Continue working.")
  } else if (driftScore >= 40) {
    lines.push("⚠ Some drift detected. Consider using hivemind_session update to refocus.")
  } else {
    lines.push("❌ Significant drift. Use hivemind_session update to re-focus, or close to reset.")
  }
  lines.push("")
  lines.push("=== END DRIFT REPORT ===")
  return lines.join("\n")
}
