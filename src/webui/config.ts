/**
 * HiveMind WebUI — Environment-based Configuration
 *
 * All settings can be overridden via environment variables.
 * Defaults are suitable for local development; .env.example documents all options.
 */

export interface WebUIConfig {
  /** HTTP server port */
  port: number
  /** HTTP server host (0.0.0.0 for container, localhost for dev) */
  host: string
  /** Project root directory to manage */
  projectRoot: string
  /** Directory containing built Vue SPA files */
  staticDir: string
  /** Log level */
  logLevel: "debug" | "info" | "warn" | "error"

  // ─── HiveMind defaults (used when creating new projects) ───
  /** Default governance mode */
  defaultGovernanceMode: "permissive" | "assisted" | "strict"
  /** Default language */
  defaultLanguage: "en" | "vi"
  /** Default automation level */
  defaultAutomationLevel: "manual" | "guided" | "assisted" | "full" | "coach"
  /** Default expert level */
  defaultExpertLevel: "beginner" | "intermediate" | "advanced" | "expert"
  /** Default output style */
  defaultOutputStyle: "explanatory" | "outline" | "skeptical" | "architecture" | "minimal"
  /** Default: require code review */
  defaultRequireCodeReview: boolean
  /** Default: enforce TDD */
  defaultEnforceTdd: boolean
}

function envBool(key: string, fallback: boolean): boolean {
  const val = process.env[key]
  if (val === undefined || val === "") return fallback
  return val === "true" || val === "1" || val === "yes"
}

function envInt(key: string, fallback: number): number {
  const val = process.env[key]
  if (val === undefined || val === "") return fallback
  const parsed = parseInt(val, 10)
  return Number.isNaN(parsed) ? fallback : parsed
}

function envStr<T extends string>(key: string, fallback: T, allowed?: readonly T[]): T {
  const val = process.env[key] as T | undefined
  if (val === undefined || val === "") return fallback
  if (allowed && !allowed.includes(val)) return fallback
  return val
}

export function loadWebUIConfig(): WebUIConfig {
  return {
    port: envInt("HIVEMIND_PORT", 3000),
    host: envStr("HIVEMIND_HOST", "0.0.0.0"),
    projectRoot: envStr("HIVEMIND_PROJECT_ROOT", process.cwd()),
    staticDir: envStr("HIVEMIND_STATIC_DIR", ""),
    logLevel: envStr("HIVEMIND_LOG_LEVEL", "info", ["debug", "info", "warn", "error"] as const),

    defaultGovernanceMode: envStr("HIVEMIND_DEFAULT_GOVERNANCE_MODE", "assisted", ["permissive", "assisted", "strict"] as const),
    defaultLanguage: envStr("HIVEMIND_DEFAULT_LANGUAGE", "en", ["en", "vi"] as const),
    defaultAutomationLevel: envStr("HIVEMIND_DEFAULT_AUTOMATION_LEVEL", "assisted", ["manual", "guided", "assisted", "full", "coach"] as const),
    defaultExpertLevel: envStr("HIVEMIND_DEFAULT_EXPERT_LEVEL", "intermediate", ["beginner", "intermediate", "advanced", "expert"] as const),
    defaultOutputStyle: envStr("HIVEMIND_DEFAULT_OUTPUT_STYLE", "explanatory", ["explanatory", "outline", "skeptical", "architecture", "minimal"] as const),
    defaultRequireCodeReview: envBool("HIVEMIND_DEFAULT_REQUIRE_CODE_REVIEW", false),
    defaultEnforceTdd: envBool("HIVEMIND_DEFAULT_ENFORCE_TDD", false),
  }
}
