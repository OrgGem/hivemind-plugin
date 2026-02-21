/**
 * HiveMind WebUI — Integrated API + Static File Server
 *
 * Single HTTP server that:
 *  1. Exposes REST API endpoints for all CLI commands
 *  2. Provides skill/workflow CRUD + download
 *  3. Serves the built Vue SPA (or embedded fallback)
 *
 * Designed for container deployment; all config via environment variables.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import { existsSync } from "node:fs"
import { readFile, readdir, writeFile, mkdir, rm } from "node:fs/promises"
import { join, dirname, basename, extname, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"
import { createStateManager, loadConfig, saveConfig } from "../lib/persistence.js"
import { listArchives } from "../lib/planning-fs.js"
import { getEffectivePaths, hivemindExists } from "../lib/paths.js"
import { migrateToGraph, isGraphMigrationNeeded } from "../lib/graph-migrate.js"
import { normalizeAutomationLabel, createConfig, isValidGovernanceMode, isValidLanguage, isValidAutomationLevel, isValidExpertLevel, isValidOutputStyle, PROFILE_PRESETS } from "../schemas/config.js"
import { executeCompaction } from "../lib/compaction-engine.js"
import { request as httpsRequest } from "node:https"
import { request as httpRequest } from "node:http"
import { initProject } from "../cli/init.js"
import { syncOpencodeAssets } from "../cli/sync-assets.js"
import { runScanCommand } from "../cli/scan.js"
import type { InitOptions } from "../cli/init.js"
import type { ScanCommandOptions } from "../cli/scan.js"
import type { WebUIConfig } from "./config.js"
import { loadWebUIConfig } from "./config.js"
import { EMBEDDED_APP_HTML } from "./embedded-app.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ─── Helpers ──────────────────────────────────────────────────────────

function setCorsHeaders(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")
}

function sendJson(res: ServerResponse, statusCode: number, data: unknown): void {
  setCorsHeaders(res)
  res.writeHead(statusCode, { "Content-Type": "application/json" })
  res.end(JSON.stringify(data))
}

function sendError(res: ServerResponse, statusCode: number, message: string): void {
  sendJson(res, statusCode, { error: message })
}

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on("data", (chunk: Buffer) => chunks.push(chunk))
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")))
    req.on("error", reject)
  })
}

async function parseJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const body = await readBody(req)
  if (!body.trim()) return {}
  return JSON.parse(body) as Record<string, unknown>
}

/** Safe filename check — prevent path traversal */
const SAFE_NAME = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/

function isSafeName(name: string): boolean {
  if (!name || typeof name !== "string") return false
  if (!SAFE_NAME.test(name)) return false
  if (name.includes("..")) return false
  return true
}

// ─── File utilities ──────────────────────────────────────────────────

async function listFilesRecursive(dir: string): Promise<string[]> {
  const out: string[] = []
  if (!existsSync(dir)) return out
  const stack = [dir]
  while (stack.length > 0) {
    const current = stack.pop()!
    const entries = await readdir(current, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(current, entry.name)
      if (entry.isDirectory()) stack.push(fullPath)
      else if (entry.isFile()) out.push(fullPath)
    }
  }
  return out
}

function parseFrontmatter(content: string): Record<string, unknown> | null {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/)
  if (!match) return null
  try {
    const lines = match[1].split("\n")
    const result: Record<string, unknown> = {}
    let currentKey = ""
    let currentArray: string[] | null = null
    for (const line of lines) {
      const kvMatch = line.match(/^(\w[\w_-]*):\s*(.*)$/)
      if (kvMatch) {
        if (currentKey && currentArray) { result[currentKey] = currentArray; currentArray = null }
        currentKey = kvMatch[1]
        const val = kvMatch[2].trim()
        if (val === "" || val === "|" || val === ">") { currentArray = [] }
        else { result[currentKey] = val.replace(/^["']|["']$/g, ""); currentKey = "" }
      } else if (currentArray !== null) {
        const arrMatch = line.match(/^\s+-\s+(.+)$/)
        if (arrMatch) currentArray.push(arrMatch[1].replace(/^["']|["']$/g, ""))
      }
    }
    if (currentKey && currentArray) result[currentKey] = currentArray
    return result
  } catch { return null }
}

function parseYamlOrJson(content: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(content)
    if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>
  } catch { /* not JSON */ }
  try {
    const result: Record<string, unknown> = {}
    const lines = content.split("\n")
    let i = 0
    while (i < lines.length) {
      const line = lines[i]
      const topMatch = line.match(/^(\w[\w_-]*):\s*(.*)$/)
      if (topMatch) {
        const key = topMatch[1]
        const val = topMatch[2].trim()
        if (key === "steps") {
          const steps: Array<Record<string, unknown>> = []
          i++
          let cur: Record<string, unknown> | null = null
          let inArgs = false
          const args: Record<string, unknown> = {}
          while (i < lines.length) {
            const sl = lines[i]
            if (/^\w/.test(sl) && !sl.startsWith(" ")) break
            const nsm = sl.match(/^\s+-\s+name:\s*(.+)$/)
            if (nsm) {
              if (cur) {
                if (inArgs && Object.keys(args).length > 0) { cur.args = { ...args }; for (const k of Object.keys(args)) delete args[k] }
                steps.push(cur)
              }
              cur = { name: nsm[1].trim() }; inArgs = false; i++; continue
            }
            const pm = sl.match(/^\s+(\w[\w_-]*):\s*(.*)$/)
            if (pm && cur) {
              if (pm[1] === "args") { inArgs = true }
              else if (inArgs) { let av: unknown = pm[2].trim(); if (av === "true") av = true; else if (av === "false") av = false; args[pm[1]] = av }
              else { cur[pm[1]] = pm[2].trim() }
            }
            i++
          }
          if (cur) { if (inArgs && Object.keys(args).length > 0) cur.args = { ...args }; steps.push(cur) }
          result[key] = steps; continue
        } else { result[key] = val }
      }
      i++
    }
    return Object.keys(result).length > 0 ? result : null
  } catch { return null }
}

// ─── CLI Command Handlers ────────────────────────────────────────────

async function handleGetStatus(dir: string, res: ServerResponse): Promise<void> {
  if (!hivemindExists(dir)) {
    sendJson(res, 200, { initialized: false, message: "No .hivemind/ found. Run init first." })
    return
  }
  const stateManager = createStateManager(dir)
  const config = await loadConfig(dir)
  const state = await stateManager.load()
  if (!state) {
    sendJson(res, 200, { initialized: true, session_active: false, message: "Initialized but no active session." })
    return
  }
  const archives = await listArchives(dir)
  sendJson(res, 200, {
    initialized: true, session_active: true,
    session: { id: state.session.id, governance_status: state.session.governance_status, mode: state.session.mode },
    governance_mode: config.governance_mode,
    automation_level: normalizeAutomationLabel(config.automation_level),
    hierarchy: { trajectory: state.hierarchy.trajectory || null, tactic: state.hierarchy.tactic || null, action: state.hierarchy.action || null },
    metrics: { turn_count: state.metrics.turn_count, drift_score: state.metrics.drift_score, files_touched: state.metrics.files_touched.length, context_updates: state.metrics.context_updates, user_turn_count: state.metrics.user_turn_count },
    archives_count: archives.length,
  })
}

async function handleGetSettings(dir: string, res: ServerResponse): Promise<void> {
  const p = getEffectivePaths(dir)
  if (!existsSync(p.config)) {
    sendJson(res, 200, { initialized: false, message: "No configuration found." })
    return
  }
  const config = await loadConfig(dir)
  sendJson(res, 200, {
    initialized: true, config_path: p.config,
    governance_mode: config.governance_mode, language: config.language,
    automation_level: normalizeAutomationLabel(config.automation_level),
    agent_behavior: {
      expert_level: config.agent_behavior.expert_level,
      output_style: config.agent_behavior.output_style,
      language: config.agent_behavior.language,
      constraints: {
        require_code_review: config.agent_behavior.constraints.require_code_review,
        enforce_tdd: config.agent_behavior.constraints.enforce_tdd,
        max_response_tokens: config.agent_behavior.constraints.max_response_tokens,
        explain_reasoning: config.agent_behavior.constraints.explain_reasoning,
        be_skeptical: config.agent_behavior.constraints.be_skeptical,
      },
    },
    thresholds: {
      max_turns_before_warning: config.max_turns_before_warning,
      auto_compact_on_turns: config.auto_compact_on_turns,
      max_active_md_lines: config.max_active_md_lines,
      stale_session_days: config.stale_session_days,
      commit_suggestion_threshold: config.commit_suggestion_threshold,
    },
  })
}

async function handlePutSettings(dir: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await parseJsonBody(req)
  const cur = await loadConfig(dir)

  // Validate and apply enum fields
  if (typeof body.governance_mode === "string") {
    if (!isValidGovernanceMode(body.governance_mode)) { sendError(res, 400, "Invalid governance_mode."); return }
    (cur as unknown as Record<string, unknown>).governance_mode = body.governance_mode
  }
  if (typeof body.language === "string") {
    if (!isValidLanguage(body.language)) { sendError(res, 400, "Invalid language."); return }
    (cur as unknown as Record<string, unknown>).language = body.language
  }
  if (typeof body.automation_level === "string") {
    if (!isValidAutomationLevel(body.automation_level)) { sendError(res, 400, "Invalid automation_level."); return }
    (cur as unknown as Record<string, unknown>).automation_level = body.automation_level
  }
  if (body.agent_behavior && typeof body.agent_behavior === "object") {
    const ab = body.agent_behavior as Record<string, unknown>
    if (typeof ab.expert_level === "string") {
      if (!isValidExpertLevel(ab.expert_level)) { sendError(res, 400, "Invalid expert_level."); return }
      cur.agent_behavior.expert_level = ab.expert_level as typeof cur.agent_behavior.expert_level
    }
    if (typeof ab.output_style === "string") {
      if (!isValidOutputStyle(ab.output_style)) { sendError(res, 400, "Invalid output_style."); return }
      cur.agent_behavior.output_style = ab.output_style as typeof cur.agent_behavior.output_style
    }
    if (ab.constraints && typeof ab.constraints === "object") {
      const c = ab.constraints as Record<string, unknown>
      if (typeof c.require_code_review === "boolean") cur.agent_behavior.constraints.require_code_review = c.require_code_review
      if (typeof c.enforce_tdd === "boolean") cur.agent_behavior.constraints.enforce_tdd = c.enforce_tdd
      if (typeof c.explain_reasoning === "boolean") cur.agent_behavior.constraints.explain_reasoning = c.explain_reasoning
      if (typeof c.be_skeptical === "boolean") cur.agent_behavior.constraints.be_skeptical = c.be_skeptical
    }
  }
  // Threshold fields (numeric, validated)
  if (body.thresholds && typeof body.thresholds === "object") {
    const t = body.thresholds as Record<string, unknown>
    if (typeof t.max_turns_before_warning === "number" && t.max_turns_before_warning > 0) cur.max_turns_before_warning = t.max_turns_before_warning
    if (typeof t.auto_compact_on_turns === "number" && t.auto_compact_on_turns > 0) cur.auto_compact_on_turns = t.auto_compact_on_turns
    if (typeof t.max_active_md_lines === "number" && t.max_active_md_lines > 0) cur.max_active_md_lines = t.max_active_md_lines
    if (typeof t.stale_session_days === "number" && t.stale_session_days > 0) cur.stale_session_days = t.stale_session_days
    if (typeof t.commit_suggestion_threshold === "number" && t.commit_suggestion_threshold > 0) cur.commit_suggestion_threshold = t.commit_suggestion_threshold
  }
  const validated = createConfig(cur)
  await saveConfig(dir, validated)
  sendJson(res, 200, { success: true, message: "Settings updated." })
}

async function handleInit(dir: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await parseJsonBody(req)
  const options: InitOptions = {
    language: body.language as InitOptions["language"],
    governanceMode: body.governance_mode as InitOptions["governanceMode"],
    expertLevel: body.expert_level as InitOptions["expertLevel"],
    outputStyle: body.output_style as InitOptions["outputStyle"],
    automationLevel: body.automation_level as InitOptions["automationLevel"],
    requireCodeReview: body.require_code_review === true,
    enforceTdd: body.enforce_tdd === true,
    syncTarget: (body.sync_target as InitOptions["syncTarget"]) ?? undefined,
    overwriteAssets: body.overwrite_assets === true,
    force: body.force === true,
    silent: true,
  }
  await initProject(dir, options)
  sendJson(res, 200, { success: true, message: "Project initialized." })
}

async function handleScan(dir: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await parseJsonBody(req)
  const options: ScanCommandOptions = {
    action: (body.action as ScanCommandOptions["action"]) ?? "analyze",
    json: true, includeDrift: body.include_drift === true,
  }
  const output = await runScanCommand(dir, options)
  try { sendJson(res, 200, { success: true, result: JSON.parse(output) }) }
  catch { sendJson(res, 200, { success: true, result: output }) }
}

async function handleSyncAssets(dir: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await parseJsonBody(req)
  const logs: string[] = []
  const result = await syncOpencodeAssets(dir, {
    target: (body.target as "project" | "global" | "both") ?? "project",
    overwrite: body.overwrite === true, clean: body.clean === true,
    silent: false, onLog: (line) => logs.push(line),
  })
  sendJson(res, 200, { success: true, totalCopied: result.totalCopied, totalSkipped: result.totalSkipped, totalInvalid: result.totalInvalid, logs })
}

async function handleMigrate(dir: string, res: ServerResponse): Promise<void> {
  if (!isGraphMigrationNeeded(dir)) {
    sendJson(res, 200, { success: true, needed: false, message: "No migration needed." })
    return
  }
  const result = await migrateToGraph(dir)
  if (result.success) sendJson(res, 200, { success: true, needed: true, migrated: result.migrated, backupPath: result.backupPath })
  else sendJson(res, 500, { success: false, errors: result.errors })
}

async function handlePurge(dir: string, res: ServerResponse): Promise<void> {
  const hivemindDir = getEffectivePaths(dir).root
  if (!existsSync(hivemindDir)) {
    sendJson(res, 200, { success: false, message: "No .hivemind/ directory found." })
    return
  }
  await rm(hivemindDir, { recursive: true, force: true })
  try {
    const ocPath = join(dir, "opencode.json")
    if (existsSync(ocPath)) {
      const raw = await readFile(ocPath, "utf-8")
      const oc = JSON.parse(raw) as Record<string, unknown>
      if (Array.isArray(oc.plugin)) {
        const pat = /(^|[\\/])hivemind-context-governance(?:@.+)?$/
        const before = (oc.plugin as unknown[]).length
        oc.plugin = (oc.plugin as unknown[]).filter((v: unknown) => typeof v !== "string" || !pat.test(v))
        if ((oc.plugin as unknown[]).length !== before) await writeFile(ocPath, JSON.stringify(oc, null, 2) + "\n")
      }
    }
  } catch { /* best effort */ }
  sendJson(res, 200, { success: true, message: "HiveMind purged." })
}

async function handleCompact(dir: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!hivemindExists(dir)) {
    sendError(res, 400, "No .hivemind/ found. Initialize first.")
    return
  }
  const body = await parseJsonBody(req)
  const summary = typeof body.summary === "string" ? body.summary : undefined
  try {
    const result = await executeCompaction({ directory: dir, summary })
    sendJson(res, 200, {
      success: result.success,
      status: result.status,
      archivedSessionId: result.archivedSessionId,
      newSessionId: result.newSessionId,
      summaryLine: result.summaryLine,
      metrics: result.metrics,
    })
  } catch (err: unknown) {
    sendError(res, 500, `Compaction failed: ${err instanceof Error ? err.message : String(err)}`)
  }
}

async function handleListArchives(dir: string, res: ServerResponse): Promise<void> {
  if (!hivemindExists(dir)) {
    sendJson(res, 200, { archives: [] })
    return
  }
  const archives = await listArchives(dir)
  sendJson(res, 200, { archives, count: archives.length })
}

async function handleDeleteSkill(dir: string, name: string, res: ServerResponse): Promise<void> {
  if (!isSafeName(name)) { sendError(res, 400, "Invalid skill name."); return }
  const skillDir = join(getSkillsRoot(dir), name)
  if (!existsSync(skillDir)) { sendError(res, 404, `Skill '${name}' not found in project.`); return }
  await rm(skillDir, { recursive: true, force: true })
  sendJson(res, 200, { success: true, message: `Skill '${name}' deleted.` })
}

async function handleDeleteWorkflow(dir: string, name: string, res: ServerResponse): Promise<void> {
  if (!isSafeName(name)) { sendError(res, 400, "Invalid workflow name."); return }
  const workflowsDir = getWorkflowsRoot(dir)
  if (!existsSync(workflowsDir)) { sendError(res, 404, `Workflow '${name}' not found.`); return }
  const entries = await readdir(workflowsDir)
  for (const file of entries) {
    if (basename(file, extname(file).toLowerCase()) === name) {
      await rm(join(workflowsDir, file))
      sendJson(res, 200, { success: true, message: `Workflow '${name}' deleted.` })
      return
    }
  }
  sendError(res, 404, `Workflow '${name}' not found.`)
}

function handleHelp(res: ServerResponse): void {
  sendJson(res, 200, {
    commands: [
      { name: "status", method: "GET", path: "/api/status", description: "Current session state" },
      { name: "settings", method: "GET/PUT", path: "/api/settings", description: "View or update config (incl. thresholds)" },
      { name: "init", method: "POST", path: "/api/init", description: "Initialize project" },
      { name: "init/wizard", method: "GET", path: "/api/init/wizard", description: "Profile presets for init wizard" },
      { name: "compact", method: "POST", path: "/api/compact", description: "Archive current session and reset" },
      { name: "archives", method: "GET", path: "/api/archives", description: "List archived sessions" },
      { name: "scan", method: "POST", path: "/api/scan", description: "Brownfield scan" },
      { name: "sync-assets", method: "POST", path: "/api/sync-assets", description: "Sync OpenCode assets" },
      { name: "migrate", method: "POST", path: "/api/migrate", description: "Migrate to graph" },
      { name: "purge", method: "POST", path: "/api/purge", description: "Remove .hivemind/" },
      { name: "skills", method: "GET/POST/DELETE", path: "/api/skills", description: "List, create, or delete skills" },
      { name: "workflows", method: "GET/POST/DELETE", path: "/api/workflows", description: "List, create, or delete workflows" },
      { name: "llm/config", method: "GET/PUT", path: "/api/llm/config", description: "LLM provider configuration" },
      { name: "llm/chat", method: "POST", path: "/api/llm/chat", description: "Chat via LLM provider (OpenAI compatible)" },
    ],
  })
}

function handleGetEnvConfig(res: ServerResponse): void {
  sendJson(res, 200, loadWebUIConfig())
}

// ─── LLM Provider Config ─────────────────────────────────────────────

const DEFAULT_LLM_MAX_TOKENS = 1024

interface LLMProviderConfig {
  api_key: string
  base_url: string
  model: string
  enabled: boolean
}

const DEFAULT_LLM_CONFIG: LLMProviderConfig = {
  api_key: "",
  base_url: "https://api.openai.com/v1",
  model: "gpt-3.5-turbo",
  enabled: false,
}

function getLLMConfigPath(dir: string): string {
  return join(getEffectivePaths(dir).root, "llm-config.json")
}

async function loadLLMConfig(dir: string): Promise<LLMProviderConfig> {
  const configPath = getLLMConfigPath(dir)
  try {
    if (existsSync(configPath)) {
      const data = await readFile(configPath, "utf-8")
      const parsed = JSON.parse(data) as Partial<LLMProviderConfig>
      return { ...DEFAULT_LLM_CONFIG, ...parsed }
    }
  } catch { /* fallback to defaults */ }
  return { ...DEFAULT_LLM_CONFIG }
}

async function saveLLMConfig(dir: string, config: LLMProviderConfig): Promise<void> {
  const configPath = getLLMConfigPath(dir)
  await mkdir(dirname(configPath), { recursive: true })
  await writeFile(configPath, JSON.stringify(config, null, 2))
}

async function handleGetLLMConfig(dir: string, res: ServerResponse): Promise<void> {
  const config = await loadLLMConfig(dir)
  // Don't expose the full API key — mask it
  const masked = { ...config, api_key: config.api_key ? config.api_key.slice(0, 4) + "****" + config.api_key.slice(-4) : "" }
  sendJson(res, 200, masked)
}

async function handlePutLLMConfig(dir: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await parseJsonBody(req)
  const current = await loadLLMConfig(dir)
  if (typeof body.api_key === "string") current.api_key = body.api_key
  if (typeof body.base_url === "string") current.base_url = body.base_url
  if (typeof body.model === "string") current.model = body.model
  if (typeof body.enabled === "boolean") current.enabled = body.enabled
  await saveLLMConfig(dir, current)
  sendJson(res, 200, { success: true, message: "LLM config saved." })
}

async function handleLLMChat(dir: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const llmConfig = await loadLLMConfig(dir)
  if (!llmConfig.enabled || !llmConfig.api_key) {
    sendError(res, 400, "LLM provider not configured or disabled. Configure it in the LLM Config section.")
    return
  }
  const body = await parseJsonBody(req)
  const messages = body.messages as Array<{ role: string; content: string }>
  if (!Array.isArray(messages) || messages.length === 0) {
    sendError(res, 400, "Messages array is required.")
    return
  }

  try {
    const baseUrl = llmConfig.base_url.replace(/\/+$/, "")
    const chatUrl = `${baseUrl}/chat/completions`
    const payload = JSON.stringify({
      model: llmConfig.model,
      messages,
      max_tokens: DEFAULT_LLM_MAX_TOKENS,
      temperature: 0.7,
    })

    const parsedUrl = new URL(chatUrl)
    const isHttps = parsedUrl.protocol === "https:"
    const requestFn = isHttps ? httpsRequest : httpRequest

    const proxyResponse = await new Promise<string>((resolve, reject) => {
      const proxyReq = requestFn(chatUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${llmConfig.api_key}`,
        },
      }, (proxyRes) => {
        const chunks: Buffer[] = []
        proxyRes.on("data", (chunk: Buffer) => chunks.push(chunk))
        proxyRes.on("end", () => {
          const responseBody = Buffer.concat(chunks).toString("utf-8")
          if (proxyRes.statusCode && proxyRes.statusCode >= 400) {
            const sanitized = responseBody.slice(0, 200).replace(/sk-[a-zA-Z0-9]+/g, "sk-****")
            reject(new Error(`LLM API error (${proxyRes.statusCode}): ${sanitized}`))
          } else {
            resolve(responseBody)
          }
        })
        proxyRes.on("error", reject)
      })
      proxyReq.on("error", reject)
      proxyReq.write(payload)
      proxyReq.end()
    })

    const parsed = JSON.parse(proxyResponse) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = parsed.choices?.[0]?.message?.content ?? ""
    sendJson(res, 200, { success: true, content })
  } catch (err: unknown) {
    sendError(res, 502, `LLM request failed: ${err instanceof Error ? err.message : String(err)}`)
  }
}

// ─── Init Wizard Data ────────────────────────────────────────────────

interface ProfilePresetData {
  label: string
  governance_mode: string
  automation_level: string
  expert_level: string
  output_style: string
  require_code_review: boolean
  enforce_tdd: boolean
}

function handleGetInitWizard(res: ServerResponse): void {
  // Return profile presets so the frontend wizard can use them
  const profiles: Record<string, ProfilePresetData> = {}
  for (const [key, preset] of Object.entries(PROFILE_PRESETS)) {
    profiles[key] = {
      label: preset.label,
      governance_mode: preset.governance_mode,
      automation_level: preset.automation_level,
      expert_level: preset.expert_level,
      output_style: preset.output_style,
      require_code_review: preset.require_code_review,
      enforce_tdd: preset.enforce_tdd,
    }
  }
  sendJson(res, 200, { profiles })
}

// ─── Skill Handlers ──────────────────────────────────────────────────

function getSkillsRoot(dir: string): string { return join(dir, ".opencode", "skills") }
function getPackageSkillsRoot(): string { return join(__dirname, "..", "..", "skills") }

async function handleListSkills(dir: string, res: ServerResponse): Promise<void> {
  const roots = [getPackageSkillsRoot(), getSkillsRoot(dir)]
  const skills: Array<{ name: string; description: string; version: string; source: string }> = []
  for (const root of roots) {
    if (!existsSync(root)) continue
    const source = root === getPackageSkillsRoot() ? "package" : "project"
    const entries = await readdir(root, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const skillMd = join(root, entry.name, "SKILL.md")
      if (!existsSync(skillMd)) continue
      const content = await readFile(skillMd, "utf-8")
      const fm = parseFrontmatter(content)
      skills.push({ name: fm?.name as string ?? entry.name, description: fm?.description as string ?? "", version: fm?.version as string ?? "0.0.0", source })
    }
  }
  sendJson(res, 200, { skills })
}

async function handleGetSkill(dir: string, name: string, res: ServerResponse): Promise<void> {
  if (!isSafeName(name)) { sendError(res, 400, "Invalid skill name."); return }
  for (const root of [getSkillsRoot(dir), getPackageSkillsRoot()]) {
    const skillDir = join(root, name)
    if (!existsSync(skillDir)) continue
    const skillMd = join(skillDir, "SKILL.md")
    if (!existsSync(skillMd)) continue
    const content = await readFile(skillMd, "utf-8")
    const fm = parseFrontmatter(content)
    const files = await listFilesRecursive(skillDir)
    sendJson(res, 200, {
      name: fm?.name ?? name, description: fm?.description ?? "", version: fm?.version ?? "0.0.0",
      triggers: fm?.triggers ?? [], content, files: files.map(f => f.slice(skillDir.length + 1)),
      source: root === getPackageSkillsRoot() ? "package" : "project",
    })
    return
  }
  sendError(res, 404, `Skill '${name}' not found.`)
}

async function handleCreateSkill(dir: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await parseJsonBody(req)
  const name = body.name as string
  const description = body.description as string
  const version = (body.version as string) ?? "1.0.0"
  const triggers = (body.triggers as string[]) ?? []
  const content = (body.content as string) ?? ""
  if (!name || !isSafeName(name)) { sendError(res, 400, "Invalid skill name."); return }
  if (!description) { sendError(res, 400, "Description is required."); return }
  const skillDir = join(getSkillsRoot(dir), name)
  await mkdir(skillDir, { recursive: true })
  const triggersYaml = triggers.length > 0 ? `triggers:\n${triggers.map(t => `  - "${t}"`).join("\n")}\n` : ""
  const skillMd = `---\nname: "${name}"\ndescription: "${description}"\n${triggersYaml}version: "${version}"\n---\n\n${content}\n`
  await writeFile(join(skillDir, "SKILL.md"), skillMd)
  sendJson(res, 201, { success: true, name, path: skillDir })
}

async function handleDownloadSkill(dir: string, name: string, res: ServerResponse): Promise<void> {
  if (!isSafeName(name)) { sendError(res, 400, "Invalid skill name."); return }
  let skillDir: string | null = null
  for (const root of [getSkillsRoot(dir), getPackageSkillsRoot()]) {
    const candidate = join(root, name)
    if (existsSync(candidate)) { skillDir = candidate; break }
  }
  if (!skillDir) { sendError(res, 404, `Skill '${name}' not found.`); return }
  const files = await listFilesRecursive(skillDir)
  const bundle: Record<string, string> = {}
  for (const fp of files) bundle[fp.slice(skillDir.length + 1)] = await readFile(fp, "utf-8")
  setCorsHeaders(res)
  res.writeHead(200, { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="${name}-skill.json"` })
  res.end(JSON.stringify({ type: "hivemind-skill", name, files: bundle }, null, 2))
}

// ─── Workflow Handlers ───────────────────────────────────────────────

function getWorkflowsRoot(dir: string): string { return join(dir, ".opencode", "workflows") }
function getPackageWorkflowsRoot(): string { return join(__dirname, "..", "..", "workflows") }

async function handleListWorkflows(dir: string, res: ServerResponse): Promise<void> {
  const roots = [getPackageWorkflowsRoot(), getWorkflowsRoot(dir)]
  const workflows: Array<{ name: string; description: string; version: string | number; steps: number; source: string; filename: string }> = []
  for (const root of roots) {
    if (!existsSync(root)) continue
    const source = root === getPackageWorkflowsRoot() ? "package" : "project"
    const entries = await readdir(root)
    for (const file of entries) {
      const ext = extname(file).toLowerCase()
      if (ext !== ".yaml" && ext !== ".yml" && ext !== ".json") continue
      const content = await readFile(join(root, file), "utf-8")
      const parsed = parseYamlOrJson(content)
      if (!parsed) continue
      workflows.push({
        name: parsed.name as string ?? basename(file, ext), description: parsed.description as string ?? "",
        version: parsed.version as string | number ?? "0",
        steps: Array.isArray(parsed.steps) ? (parsed.steps as unknown[]).length : 0, source, filename: file,
      })
    }
  }
  sendJson(res, 200, { workflows })
}

async function handleGetWorkflow(dir: string, name: string, res: ServerResponse): Promise<void> {
  if (!isSafeName(name)) { sendError(res, 400, "Invalid workflow name."); return }
  for (const root of [getWorkflowsRoot(dir), getPackageWorkflowsRoot()]) {
    if (!existsSync(root)) continue
    const entries = await readdir(root)
    for (const file of entries) {
      const ext = extname(file).toLowerCase()
      if (basename(file, ext) !== name) continue
      const content = await readFile(join(root, file), "utf-8")
      const parsed = parseYamlOrJson(content)
      if (!parsed) continue
      sendJson(res, 200, {
        name: parsed.name ?? basename(file, ext), description: parsed.description ?? "",
        version: parsed.version ?? "0", steps: parsed.steps ?? [], raw: content,
        source: root === getPackageWorkflowsRoot() ? "package" : "project", filename: file,
      })
      return
    }
  }
  sendError(res, 404, `Workflow '${name}' not found.`)
}

async function handleCreateWorkflow(dir: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await parseJsonBody(req)
  const name = body.name as string
  const description = (body.description as string) ?? ""
  const version = (body.version as string | number) ?? 1
  const steps = body.steps as Array<{ name: string; tool: string; args?: Record<string, unknown> }>
  if (!name || !isSafeName(name)) { sendError(res, 400, "Invalid workflow name."); return }
  if (!Array.isArray(steps) || steps.length === 0) { sendError(res, 400, "At least one step required."); return }
  for (const step of steps) { if (!step.name || !step.tool) { sendError(res, 400, "Each step needs name and tool."); return } }
  const workflowsDir = getWorkflowsRoot(dir)
  await mkdir(workflowsDir, { recursive: true })
  let yaml = `name: ${name}\n`
  if (description) yaml += `description: ${description}\n`
  yaml += `version: ${version}\nsteps:\n`
  for (const step of steps) {
    yaml += `  - name: ${step.name}\n    tool: ${step.tool}\n`
    if (step.args && Object.keys(step.args).length > 0) {
      yaml += `    args:\n`
      for (const [k, v] of Object.entries(step.args)) yaml += `      ${k}: ${JSON.stringify(v)}\n`
    }
  }
  await writeFile(join(workflowsDir, `${name}.yaml`), yaml)
  sendJson(res, 201, { success: true, name, filename: `${name}.yaml` })
}

async function handleDownloadWorkflow(dir: string, name: string, res: ServerResponse): Promise<void> {
  if (!isSafeName(name)) { sendError(res, 400, "Invalid workflow name."); return }
  for (const root of [getWorkflowsRoot(dir), getPackageWorkflowsRoot()]) {
    if (!existsSync(root)) continue
    const entries = await readdir(root)
    for (const file of entries) {
      if (basename(file, extname(file).toLowerCase()) !== name) continue
      const content = await readFile(join(root, file), "utf-8")
      setCorsHeaders(res)
      res.writeHead(200, { "Content-Type": "application/x-yaml", "Content-Disposition": `attachment; filename="${file}"` })
      res.end(content)
      return
    }
  }
  sendError(res, 404, `Workflow '${name}' not found.`)
}

// ─── Static File Serving ─────────────────────────────────────────────

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml",
  ".ico": "image/x-icon", ".woff2": "font/woff2", ".woff": "font/woff",
}

async function serveStaticFile(filePath: string, res: ServerResponse): Promise<boolean> {
  if (!existsSync(filePath)) return false
  const content = await readFile(filePath)
  setCorsHeaders(res)
  res.writeHead(200, { "Content-Type": MIME_TYPES[extname(filePath)] || "application/octet-stream" })
  res.end(content)
  return true
}

// ─── Router ──────────────────────────────────────────────────────────

async function handleRequest(cfg: WebUIConfig, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`)
  const pathname = url.pathname
  const method = req.method ?? "GET"
  const dir = cfg.projectRoot

  if (method === "OPTIONS") { setCorsHeaders(res); res.writeHead(204); res.end(); return }

  if (pathname.startsWith("/api/")) {
    try {
      // CLI command endpoints
      if (pathname === "/api/status" && method === "GET") return await handleGetStatus(dir, res)
      if (pathname === "/api/settings" && method === "GET") return await handleGetSettings(dir, res)
      if (pathname === "/api/settings" && method === "PUT") return await handlePutSettings(dir, req, res)
      if (pathname === "/api/init" && method === "POST") return await handleInit(dir, req, res)
      if (pathname === "/api/scan" && method === "POST") return await handleScan(dir, req, res)
      if (pathname === "/api/sync-assets" && method === "POST") return await handleSyncAssets(dir, req, res)
      if (pathname === "/api/migrate" && method === "POST") return await handleMigrate(dir, res)
      if (pathname === "/api/purge" && method === "POST") return await handlePurge(dir, res)
      if (pathname === "/api/compact" && method === "POST") return await handleCompact(dir, req, res)
      if (pathname === "/api/archives" && method === "GET") return await handleListArchives(dir, res)
      if (pathname === "/api/help" && method === "GET") return handleHelp(res)
      if (pathname === "/api/env-config" && method === "GET") return handleGetEnvConfig(res)

      // LLM provider endpoints
      if (pathname === "/api/llm/config" && method === "GET") return await handleGetLLMConfig(dir, res)
      if (pathname === "/api/llm/config" && method === "PUT") return await handlePutLLMConfig(dir, req, res)
      if (pathname === "/api/llm/chat" && method === "POST") return await handleLLMChat(dir, req, res)

      // Init wizard data
      if (pathname === "/api/init/wizard" && method === "GET") return handleGetInitWizard(res)

      // Skill endpoints
      if (pathname === "/api/skills" && method === "GET") return await handleListSkills(dir, res)
      if (pathname === "/api/skills" && method === "POST") return await handleCreateSkill(dir, req, res)
      if (pathname.startsWith("/api/skills/") && method === "GET") {
        if (pathname.endsWith("/download")) {
          const name = pathname.slice("/api/skills/".length, -"/download".length)
          return await handleDownloadSkill(dir, name, res)
        }
        const name = pathname.slice("/api/skills/".length)
        return await handleGetSkill(dir, name, res)
      }
      if (pathname.startsWith("/api/skills/") && method === "DELETE") {
        const name = pathname.slice("/api/skills/".length)
        return await handleDeleteSkill(dir, name, res)
      }

      // Workflow endpoints
      if (pathname === "/api/workflows" && method === "GET") return await handleListWorkflows(dir, res)
      if (pathname === "/api/workflows" && method === "POST") return await handleCreateWorkflow(dir, req, res)
      if (pathname.startsWith("/api/workflows/") && method === "GET") {
        if (pathname.endsWith("/download")) {
          const name = pathname.slice("/api/workflows/".length, -"/download".length)
          return await handleDownloadWorkflow(dir, name, res)
        }
        const name = pathname.slice("/api/workflows/".length)
        return await handleGetWorkflow(dir, name, res)
      }
      if (pathname.startsWith("/api/workflows/") && method === "DELETE") {
        const name = pathname.slice("/api/workflows/".length)
        return await handleDeleteWorkflow(dir, name, res)
      }

      sendError(res, 404, `Unknown endpoint: ${method} ${pathname}`)
    } catch (err: unknown) {
      sendError(res, 500, err instanceof Error ? err.message : String(err))
    }
    return
  }

  // Static file serving (Vue SPA)
  const staticDir = cfg.staticDir || join(__dirname, "..", "..", "webui", "dist")
  if (pathname !== "/" && pathname !== "") {
    const filePath = resolve(staticDir, pathname.slice(1))
    if (filePath.startsWith(resolve(staticDir) + sep) || filePath === resolve(staticDir)) {
      if (await serveStaticFile(filePath, res)) return
    }
  }

  // SPA fallback → index.html or embedded app
  const indexPath = join(staticDir, "index.html")
  if (await serveStaticFile(indexPath, res)) return

  // Embedded fallback
  setCorsHeaders(res)
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
  res.end(EMBEDDED_APP_HTML)
}

// ─── Server Entry Point ──────────────────────────────────────────────

export interface WebUIServerOptions {
  port?: number
  host?: string
  staticDir?: string
  projectRoot?: string
  onLog?: (message: string) => void
}

export function startWebUIServer(
  options: WebUIServerOptions = {},
): { server: ReturnType<typeof createServer>; port: number; host: string } {
  const cfg = loadWebUIConfig()
  if (options.port !== undefined) cfg.port = options.port
  if (options.host !== undefined) cfg.host = options.host
  if (options.staticDir !== undefined) cfg.staticDir = options.staticDir
  if (options.projectRoot !== undefined) cfg.projectRoot = options.projectRoot

  const log = options.onLog ?? ((_msg: string) => {})

  const server = createServer(async (req, res) => {
    try { await handleRequest(cfg, req, res) }
    catch (err: unknown) { sendError(res, 500, err instanceof Error ? err.message : String(err)) }
  })

  server.listen(cfg.port, cfg.host, () => {
    log(`HiveMind WebUI running at http://${cfg.host}:${cfg.port}`)
    log(`Project: ${cfg.projectRoot}`)
  })

  return { server, port: cfg.port, host: cfg.host }
}
