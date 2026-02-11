/**
 * Tool Activation Advisor — pure function.
 * Suggests which HiveMind tools are most relevant for the current state.
 */
import type { BrainState } from "../schemas/brain-state.js";

/** Drift score below this triggers a map_context hint */
const DRIFT_SCORE_THRESHOLD = 50;
/** Minimum turns before drift hint activates */
const DRIFT_MIN_TURNS = 5;
/** Turn count above this suggests session compaction */
const LONG_SESSION_TURNS = 15;

export interface ToolHint {
  tool: string;
  reason: string;
  priority: "high" | "medium" | "low";
}

/**
 * Returns the single most relevant tool hint based on current brain state.
 * Priority order: LOCKED > drift > long session > empty hierarchy.
 */
export function getToolActivation(state: BrainState): ToolHint | null {
  // Priority 1: Session locked → must declare intent
  if (state.session.governance_status === "LOCKED") {
    return {
      tool: "declare_intent",
      reason: "Session is LOCKED. Declare your intent to start working.",
      priority: "high",
    };
  }

  // Priority 2: High drift → map context
  if (state.metrics.drift_score < DRIFT_SCORE_THRESHOLD && state.metrics.turn_count >= DRIFT_MIN_TURNS) {
    return {
      tool: "map_context",
      reason: "Drift detected. Update your focus to stay on track.",
      priority: "high",
    };
  }

  // Priority 3: Long session → suggest compact
  if (state.metrics.turn_count >= LONG_SESSION_TURNS) {
    return {
      tool: "compact_session",
      reason: "Long session detected. Consider archiving and resetting.",
      priority: "medium",
    };
  }

  // Priority 4: No hierarchy set → suggest map_context
  if (!state.hierarchy.trajectory && !state.hierarchy.tactic && !state.hierarchy.action) {
    return {
      tool: "map_context",
      reason: "No hierarchy set. Define your trajectory for better tracking.",
      priority: "medium",
    };
  }

  return null;
}
