/**
 * Hierarchy Tools — unified hierarchy_manage tool
 *
 * Single tool with action param for prune + migrate operations.
 *
 * | Action   | Agent Discovers As              | When It Fires                        |
 * |----------|---------------------------------|--------------------------------------|
 * | prune    | "Clean completed branches"      | Hook alerts: completed count > threshold |
 * | migrate  | "Convert flat to tree"          | Hook alerts: no hierarchy.json found |
 */

import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import { createStateManager } from "../lib/persistence.js"
import {
  loadTree,
  saveTree,
  treeExists,
  pruneCompleted,
  migrateFromFlat,
  toAsciiTree,
  getTreeStats,
  toBrainProjection,
} from "../lib/hierarchy-tree.js"
import { updateHierarchy } from "../schemas/brain-state.js"

/**
 * hierarchy_manage — Manage the hierarchy tree: prune completed branches or migrate from flat.
 *
 * Agent Thought: "I need to clean or upgrade the hierarchy tree"
 */
export function createHierarchyManageTool(directory: string): ToolDefinition {
  return tool({
    description:
      "Manage the hierarchy tree. " +
      "action=prune: clean completed branches and replace with summaries. " +
      "action=migrate: convert flat hierarchy strings to navigable tree structure.",
    args: {
      action: tool.schema
        .enum(["prune", "migrate"])
        .describe("Which operation: 'prune' to clean completed branches, 'migrate' to convert flat to tree"),
      json: tool.schema
        .boolean()
        .optional()
        .describe("Return output as JSON (default: false)"),
    },
    async execute(args, _context) {
      if (args.action === "prune") {
        return handlePrune(directory, args.json)
      }
      return handleMigrate(directory, args.json)
    },
  })
}

async function handlePrune(directory: string, jsonOutput?: boolean): Promise<string> {
  const tree = await loadTree(directory)

  if (!tree.root) {
    return "No hierarchy tree exists. Use declare_intent to start a session."
  }

  const stats = getTreeStats(tree)
  if (stats.completedNodes === 0) {
    return "No completed branches to prune. Tree is clean."
  }

  const result = pruneCompleted(tree)

  // Save pruned tree
  await saveTree(directory, result.tree)

  // Update brain.json with new projection
  const stateManager = createStateManager(directory)
  let state = await stateManager.load()
  if (state) {
    const projection = toBrainProjection(result.tree)
    state = updateHierarchy(state, projection)
    await stateManager.save(state)
  }

  const newStats = getTreeStats(result.tree)
  const treeView = toAsciiTree(result.tree)

  if (jsonOutput) {
    return JSON.stringify({
      action: "prune",
      pruned: result.pruned,
      summaries: result.summaries,
      remaining: { total: newStats.totalNodes, active: newStats.activeNodes, pending: newStats.pendingNodes },
    }, null, 2)
  }

  return [
    `Pruned ${result.pruned} nodes from ${result.summaries.length} completed branches.`,
    `Tree: ${newStats.totalNodes} nodes remaining (${newStats.activeNodes} active, ${newStats.pendingNodes} pending).`,
    "",
    "Summaries:",
    ...result.summaries.map((s) => `  ${s}`),
    "",
    "Current tree:",
    treeView,
  ].join("\n")
}

async function handleMigrate(directory: string, jsonOutput?: boolean): Promise<string> {
  // Check if tree already exists
  if (treeExists(directory)) {
    const existingTree = await loadTree(directory)
    if (existingTree.root) {
      const stats = getTreeStats(existingTree)
      return `Tree already exists with ${stats.totalNodes} nodes. No migration needed.`
    }
  }

  // Read flat hierarchy from brain.json
  const stateManager = createStateManager(directory)
  const state = await stateManager.load()

  if (!state) {
    return "No brain state found. Use declare_intent to start a session first."
  }

  const { trajectory, tactic, action } = state.hierarchy

  if (!trajectory) {
    return "No hierarchy data to migrate. Use declare_intent to set a trajectory."
  }

  // Migrate flat → tree
  const tree = migrateFromFlat({ trajectory, tactic, action })
  await saveTree(directory, tree)

  const stats = getTreeStats(tree)
  const treeView = toAsciiTree(tree)

  if (jsonOutput) {
    return JSON.stringify({
      action: "migrate",
      nodes_created: stats.totalNodes,
      hierarchy: { trajectory, tactic, action },
    }, null, 2)
  }

  return [
    `Migrated flat hierarchy to tree: ${stats.totalNodes} nodes created.`,
    `  Trajectory: ${trajectory}`,
    tactic ? `  Tactic: ${tactic}` : null,
    action ? `  Action: ${action}` : null,
    "",
    "Tree:",
    treeView,
  ]
    .filter((line) => line !== null)
    .join("\n")
}
