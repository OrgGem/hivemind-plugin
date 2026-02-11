/**
 * Round 3 Tools Tests — Anchors Persistence + scan_hierarchy
 *
 * 14 assertions:
 *   Anchors (8): load, add, replace, remove, roundtrip, format empty, format values, format tags
 *   scan_hierarchy (6): no session, valid JSON, hierarchy levels, metrics, anchors array, not-set defaults
 */

import { mkdtempSync, rmSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"
import {
  loadAnchors,
  saveAnchors,
  addAnchor,
  removeAnchor,
  formatAnchorsForPrompt,
} from "../src/lib/anchors.js"
import type { AnchorsState } from "../src/lib/anchors.js"
import { createScanHierarchyTool } from "../src/tools/scan-hierarchy.js"
import { createStateManager } from "../src/lib/persistence.js"
import { createBrainState } from "../src/schemas/brain-state.js"
import { createConfig } from "../src/schemas/config.js"

// ─── Harness ─────────────────────────────────────────────────────────

let passed = 0
let failed_ = 0
function assert(cond: boolean, name: string) {
  if (cond) {
    passed++
    process.stderr.write(`  PASS: ${name}\n`)
  } else {
    failed_++
    process.stderr.write(`  FAIL: ${name}\n`)
  }
}

function makeTmpDir(): string {
  return mkdtempSync(join(tmpdir(), "hm-r3-"))
}

function cleanTmpDir(dir: string): void {
  try {
    rmSync(dir, { recursive: true })
  } catch { /* ignore */ }
}

// ─── Anchor Tests (8 assertions) ──────────────────────────────────────

async function test_anchors() {
  process.stderr.write("\n--- anchors: persistence + CRUD ---\n")

  // 1. loadAnchors returns empty state for new project
  const tmpDir = makeTmpDir()
  try {
    const state = await loadAnchors(tmpDir)
    assert(
      state.anchors.length === 0 && state.version === "1.0.0",
      "loadAnchors returns empty state for new project"
    )

    // 2. addAnchor adds to state
    const s2 = addAnchor(state, "stack", "TypeScript + Node.js", "sess-001")
    assert(
      s2.anchors.length === 1 && s2.anchors[0].key === "stack" && s2.anchors[0].value === "TypeScript + Node.js",
      "addAnchor adds to state"
    )

    // 3. addAnchor replaces existing key
    const s3 = addAnchor(s2, "stack", "Rust + Tokio", "sess-002")
    assert(
      s3.anchors.length === 1 && s3.anchors[0].value === "Rust + Tokio",
      "addAnchor replaces existing key"
    )

    // 4. removeAnchor removes by key
    const s4 = addAnchor(s3, "db", "PostgreSQL", "sess-002")
    const s5 = removeAnchor(s4, "stack")
    assert(
      s5.anchors.length === 1 && s5.anchors[0].key === "db",
      "removeAnchor removes by key"
    )

    // 5. saveAnchors + loadAnchors roundtrip
    const saveState: AnchorsState = addAnchor(
      addAnchor({ anchors: [], version: "1.0.0" }, "lang", "TypeScript", "sess-1"),
      "framework", "Express", "sess-1"
    )
    await saveAnchors(tmpDir, saveState)
    const loaded = await loadAnchors(tmpDir)
    assert(
      loaded.anchors.length === 2 &&
      loaded.anchors[0].key === "lang" &&
      loaded.anchors[1].key === "framework",
      "saveAnchors + loadAnchors roundtrip"
    )

    // 6. formatAnchorsForPrompt with 0 anchors returns empty string
    const emptyState: AnchorsState = { anchors: [], version: "1.0.0" }
    assert(
      formatAnchorsForPrompt(emptyState) === "",
      "formatAnchorsForPrompt with 0 anchors returns empty string"
    )

    // 7. formatAnchorsForPrompt includes key-value pairs
    const formatted = formatAnchorsForPrompt(loaded)
    assert(
      formatted.includes("[lang]: TypeScript") && formatted.includes("[framework]: Express"),
      "formatAnchorsForPrompt includes key-value pairs"
    )

    // 8. formatAnchorsForPrompt includes immutable-anchors tags
    assert(
      formatted.includes("<immutable-anchors>") && formatted.includes("</immutable-anchors>"),
      "formatAnchorsForPrompt includes immutable-anchors tags"
    )
  } finally {
    cleanTmpDir(tmpDir)
  }
}

// ─── scan_hierarchy Tests (6 assertions) ──────────────────────────────

async function test_scanHierarchy() {
  process.stderr.write("\n--- scan_hierarchy: structured read ---\n")

  // 1. Returns error message when no session
  const tmpDir1 = makeTmpDir()
  try {
    const tool = createScanHierarchyTool(tmpDir1)
    const noSession = await tool.execute({})
    assert(
      noSession.includes("No active session"),
      "returns error message when no session"
    )
  } finally {
    cleanTmpDir(tmpDir1)
  }

  // Tests 2-6: with a saved brain state
  const tmpDir2 = makeTmpDir()
  try {
    const config = createConfig({ governance_mode: "assisted" })
    const brainState = createBrainState("test-session-r3", config, "plan_driven")
    brainState.hierarchy.trajectory = "Build auth system"
    brainState.hierarchy.tactic = "JWT validation"
    brainState.hierarchy.action = "Write middleware"
    brainState.metrics.turn_count = 7
    brainState.metrics.drift_score = 65
    brainState.metrics.files_touched = ["src/auth.ts", "src/middleware.ts"]
    brainState.metrics.context_updates = 3

    const stateManager = createStateManager(tmpDir2)
    await stateManager.save(brainState)

    // Also save anchors
    const anchorsState = addAnchor(
      { anchors: [], version: "1.0.0" },
      "test-key", "test-value", "test-session-r3"
    )
    await saveAnchors(tmpDir2, anchorsState)

    const tool = createScanHierarchyTool(tmpDir2)
    const result = await tool.execute({})

    // 2. Returns valid JSON with session info
    let parsed: any
    try {
      parsed = JSON.parse(result)
    } catch {
      parsed = null
    }
    assert(
      parsed !== null && parsed.session?.id === "test-session-r3" && parsed.session?.mode === "plan_driven",
      "returns valid JSON with session info"
    )

    // 3. Returns hierarchy levels when set
    assert(
      parsed.hierarchy?.trajectory === "Build auth system" &&
      parsed.hierarchy?.tactic === "JWT validation" &&
      parsed.hierarchy?.action === "Write middleware",
      "returns hierarchy levels when set"
    )

    // 4. Returns metrics
    assert(
      parsed.metrics?.turns === 7 &&
      parsed.metrics?.drift_score === 65 &&
      parsed.metrics?.files_touched === 2 &&
      parsed.metrics?.context_updates === 3,
      "returns metrics"
    )

    // 5. Returns anchors list (array)
    assert(
      Array.isArray(parsed.anchors) && parsed.anchors.length === 1 &&
      parsed.anchors[0] === "[test-key]: test-value",
      "returns anchors list (array)"
    )

    // 6. Returns "(not set)" for empty hierarchy levels
    const brainEmpty = createBrainState("test-empty", config, "quick_fix")
    // hierarchy is empty strings by default
    await stateManager.save(brainEmpty)

    const emptyResult = await tool.execute({})
    const parsedEmpty = JSON.parse(emptyResult)
    assert(
      parsedEmpty.hierarchy?.trajectory === "(not set)" &&
      parsedEmpty.hierarchy?.tactic === "(not set)" &&
      parsedEmpty.hierarchy?.action === "(not set)",
      "returns '(not set)' for empty hierarchy levels"
    )
  } finally {
    cleanTmpDir(tmpDir2)
  }
}

// ─── Main ────────────────────────────────────────────────────────────

async function main() {
  process.stderr.write("=== Round 3 Tools Tests ===\n")

  await test_anchors()
  await test_scanHierarchy()

  process.stderr.write(`\n=== Round 3: ${passed} passed, ${failed_} failed ===\n`)
  process.exit(failed_ > 0 ? 1 : 0)
}

main()
