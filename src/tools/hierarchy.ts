/**
 * Hierarchy Tools — prune + migrate branches
 *
 * Two tools packed in one file. Each is a one-shot that exports to brain.
 *
 * | Branch             | Agent Discovers As              | When It Fires                        |
 * |--------------------|---------------------------------|--------------------------------------|
 * | hierarchy_prune    | "Clean completed branches"      | Hook alerts: completed count > threshold |
 * | hierarchy_migrate  | "Convert flat to tree"          | Hook alerts: no hierarchy.json found |
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
 * hierarchy_prune — Clean completed branches from the hierarchy tree.
 *
 * Agent Thought: "The tree has too many completed items, clean it up"
 *
 * One-shot: prunes completed branches, updates brain projection, returns summary.
 */
export function createHierarchyPruneTool(directory: string): ToolDefinition {
  return tool({
    description:
      "Clean completed branches from the hierarchy tree. " +
      "Removes fully-completed sub-trees and replaces them with summaries.",
    args: {},
    async execute(_args, _context) {
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
    },
  })
}

/**
 * hierarchy_migrate — Convert flat hierarchy (brain.json) to tree structure.
 *
 * Agent Thought: "I need to upgrade from flat strings to a tree"
 *
 * One-shot: reads brain.json flat hierarchy, creates tree, saves hierarchy.json.
 */
export function createHierarchyMigrateTool(directory: string): ToolDefinition {
  return tool({
    description:
      "Convert flat hierarchy (trajectory/tactic/action strings) to navigable tree structure. " +
      "Run this when prompted to upgrade to the tree-based hierarchy.",
    args: {},
    async execute(_args, _context) {
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
    },
  })
}
