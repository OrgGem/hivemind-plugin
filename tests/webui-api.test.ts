/**
 * WebUI API Server — Unit Tests
 *
 * Tests the REST API endpoints that mirror CLI commands,
 * plus skill/workflow CRUD and download.
 */

import { test, describe, before, after } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, existsSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import type { Server } from "node:http"

// ─── Helpers ─────────────────────────────────────────────────────────

let server: Server
let baseUrl: string
let projectDir: string

async function api(path: string, options: RequestInit = {}): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  })
  const body = await res.json() as Record<string, unknown>
  return { status: res.status, body }
}

// ─── Setup / Teardown ────────────────────────────────────────────────

before(async () => {
  projectDir = mkdtempSync(join(tmpdir(), "hivemind-webui-test-"))

  const { startWebUIServer } = await import("../src/webui/api-server.js")
  const result = startWebUIServer({
    port: 0, // random available port
    host: "127.0.0.1",
    projectRoot: projectDir,
    onLog: () => {},
  })
  server = result.server

  // Wait for server to be listening and get actual port
  await new Promise<void>((resolve) => {
    server.once("listening", () => {
      const addr = server.address()
      if (addr && typeof addr === "object") {
        baseUrl = `http://127.0.0.1:${addr.port}`
      }
      resolve()
    })
  })
})

after(() => {
  server?.close()
  if (projectDir && existsSync(projectDir)) {
    rmSync(projectDir, { recursive: true, force: true })
  }
})

// ─── Tests ───────────────────────────────────────────────────────────

describe("WebUI API — CLI Command Endpoints", () => {
  test("GET /api/help returns command list", async () => {
    const { status, body } = await api("/api/help")
    assert.equal(status, 200)
    assert.ok(Array.isArray(body.commands))
    const names = (body.commands as Array<{ name: string }>).map((c) => c.name)
    assert.ok(names.includes("status"))
    assert.ok(names.includes("init"))
    assert.ok(names.includes("skills"))
    assert.ok(names.includes("workflows"))
  })

  test("GET /api/status returns uninitialized state", async () => {
    const { status, body } = await api("/api/status")
    assert.equal(status, 200)
    assert.equal(body.initialized, false)
  })

  test("GET /api/settings returns uninitialized state", async () => {
    const { status, body } = await api("/api/settings")
    assert.equal(status, 200)
    assert.equal(body.initialized, false)
  })

  test("GET /api/env-config returns server configuration", async () => {
    const { status, body } = await api("/api/env-config")
    assert.equal(status, 200)
    assert.ok("port" in body)
    assert.ok("host" in body)
    assert.ok("defaultGovernanceMode" in body)
  })

  test("POST /api/init initializes project", async () => {
    const { status, body } = await api("/api/init", {
      method: "POST",
      body: JSON.stringify({
        language: "en",
        governance_mode: "assisted",
        expert_level: "intermediate",
        force: true,
      }),
    })
    assert.equal(status, 200)
    assert.equal(body.success, true)

    // Verify .hivemind/ was created
    assert.ok(existsSync(join(projectDir, ".hivemind")))
  })

  test("GET /api/status returns initialized state after init", async () => {
    const { status, body } = await api("/api/status")
    assert.equal(status, 200)
    assert.equal(body.initialized, true)
  })

  test("GET /api/settings returns config after init", async () => {
    const { status, body } = await api("/api/settings")
    assert.equal(status, 200)
    assert.equal(body.initialized, true)
    assert.equal(body.governance_mode, "assisted")
    assert.ok(body.agent_behavior)
    assert.ok(body.thresholds)
  })

  test("PUT /api/settings updates configuration", async () => {
    const { status, body } = await api("/api/settings", {
      method: "PUT",
      body: JSON.stringify({
        governance_mode: "strict",
        agent_behavior: {
          constraints: { enforce_tdd: true },
        },
      }),
    })
    assert.equal(status, 200)
    assert.equal(body.success, true)

    // Verify changes persisted
    const { body: settings } = await api("/api/settings")
    assert.equal(settings.governance_mode, "strict")
  })

  test("PUT /api/settings rejects invalid governance_mode", async () => {
    const { status, body } = await api("/api/settings", {
      method: "PUT",
      body: JSON.stringify({ governance_mode: "invalid_mode" }),
    })
    assert.equal(status, 400)
    assert.ok(body.error)
  })

  test("POST /api/scan runs scan", async () => {
    const { status, body } = await api("/api/scan", {
      method: "POST",
      body: JSON.stringify({ action: "status" }),
    })
    assert.equal(status, 200)
    assert.equal(body.success, true)
  })

  test("POST /api/migrate handles no-migration-needed", async () => {
    const { status, body } = await api("/api/migrate", { method: "POST" })
    assert.equal(status, 200)
    assert.equal(body.success, true)
  })

  test("Unknown API endpoint returns 404", async () => {
    const { status, body } = await api("/api/nonexistent")
    assert.equal(status, 404)
    assert.ok(body.error)
  })

  test("CORS preflight returns 204", async () => {
    const res = await fetch(`${baseUrl}/api/status`, { method: "OPTIONS" })
    assert.equal(res.status, 204)
  })
})

describe("WebUI API — Skill Endpoints", () => {
  test("GET /api/skills lists skills", async () => {
    const { status, body } = await api("/api/skills")
    assert.equal(status, 200)
    assert.ok(Array.isArray(body.skills))
  })

  test("POST /api/skills creates a skill", async () => {
    const { status, body } = await api("/api/skills", {
      method: "POST",
      body: JSON.stringify({
        name: "test-skill",
        description: "A test skill for unit tests",
        version: "1.0.0",
        triggers: ["When tests run"],
        content: "# Test Skill\n\nDo test things.",
      }),
    })
    assert.equal(status, 201)
    assert.equal(body.success, true)
    assert.equal(body.name, "test-skill")
  })

  test("POST /api/skills rejects invalid name", async () => {
    const { status, body } = await api("/api/skills", {
      method: "POST",
      body: JSON.stringify({ name: "../bad", description: "x" }),
    })
    assert.equal(status, 400)
    assert.ok(body.error)
  })

  test("POST /api/skills rejects missing description", async () => {
    const { status, body } = await api("/api/skills", {
      method: "POST",
      body: JSON.stringify({ name: "good-name" }),
    })
    assert.equal(status, 400)
    assert.ok(body.error)
  })

  test("GET /api/skills/:name retrieves skill details", async () => {
    const { status, body } = await api("/api/skills/test-skill")
    assert.equal(status, 200)
    assert.equal(body.name, "test-skill")
    assert.ok(body.content)
  })

  test("GET /api/skills/:name/download downloads skill bundle", async () => {
    const res = await fetch(`${baseUrl}/api/skills/test-skill/download`)
    assert.equal(res.status, 200)
    const disposition = res.headers.get("content-disposition")
    assert.ok(disposition?.includes("test-skill-skill.json"))
    const data = await res.json() as Record<string, unknown>
    assert.equal(data.type, "hivemind-skill")
    assert.equal(data.name, "test-skill")
    assert.ok(data.files)
  })

  test("GET /api/skills/nonexistent returns 404", async () => {
    const { status } = await api("/api/skills/does-not-exist")
    assert.equal(status, 404)
  })
})

describe("WebUI API — Workflow Endpoints", () => {
  test("GET /api/workflows lists workflows", async () => {
    const { status, body } = await api("/api/workflows")
    assert.equal(status, 200)
    assert.ok(Array.isArray(body.workflows))
  })

  test("POST /api/workflows creates a workflow", async () => {
    const { status, body } = await api("/api/workflows", {
      method: "POST",
      body: JSON.stringify({
        name: "test-workflow",
        description: "A test workflow",
        version: "1",
        steps: [
          { name: "analyze", tool: "hivemind_inspect" },
          { name: "report", tool: "hivemind_session", args: { action: "status" } },
        ],
      }),
    })
    assert.equal(status, 201)
    assert.equal(body.success, true)
    assert.equal(body.name, "test-workflow")
  })

  test("POST /api/workflows rejects empty steps", async () => {
    const { status, body } = await api("/api/workflows", {
      method: "POST",
      body: JSON.stringify({ name: "bad-wf", steps: [] }),
    })
    assert.equal(status, 400)
    assert.ok(body.error)
  })

  test("POST /api/workflows rejects invalid name", async () => {
    const { status, body } = await api("/api/workflows", {
      method: "POST",
      body: JSON.stringify({ name: "../escape", steps: [{ name: "a", tool: "b" }] }),
    })
    assert.equal(status, 400)
    assert.ok(body.error)
  })

  test("GET /api/workflows/:name retrieves workflow", async () => {
    const { status, body } = await api("/api/workflows/test-workflow")
    assert.equal(status, 200)
    assert.ok(body.name)
    assert.ok(body.steps)
  })

  test("GET /api/workflows/:name/download downloads YAML", async () => {
    const res = await fetch(`${baseUrl}/api/workflows/test-workflow/download`)
    assert.equal(res.status, 200)
    const disposition = res.headers.get("content-disposition")
    assert.ok(disposition?.includes("test-workflow.yaml"))
    const text = await res.text()
    assert.ok(text.includes("test-workflow"))
    assert.ok(text.includes("steps:"))
  })

  test("GET /api/workflows/nonexistent returns 404", async () => {
    const { status } = await api("/api/workflows/does-not-exist")
    assert.equal(status, 404)
  })
})

describe("WebUI API — Static Serving", () => {
  test("GET / serves HTML (embedded fallback)", async () => {
    const res = await fetch(`${baseUrl}/`)
    assert.equal(res.status, 200)
    const ct = res.headers.get("content-type")
    assert.ok(ct?.includes("text/html"))
    const html = await res.text()
    assert.ok(html.includes("HiveMind"))
  })

  test("GET /nonexistent-page serves SPA fallback", async () => {
    const res = await fetch(`${baseUrl}/some/random/path`)
    assert.equal(res.status, 200)
    const html = await res.text()
    assert.ok(html.includes("HiveMind"))
  })
})

describe("WebUI API — Security", () => {
  test("Path traversal in skill name is rejected", async () => {
    const { status } = await api("/api/skills/..%2F..%2Fetc%2Fpasswd")
    assert.equal(status, 400)
  })

  test("Path traversal in workflow name is rejected", async () => {
    const { status } = await api("/api/workflows/..%2F..%2Fetc%2Fpasswd")
    assert.equal(status, 400)
  })
})

describe("WebUI API — Purge", () => {
  test("POST /api/purge removes .hivemind/", async () => {
    // Ensure initialized first
    assert.ok(existsSync(join(projectDir, ".hivemind")))

    const { status, body } = await api("/api/purge", { method: "POST" })
    assert.equal(status, 200)
    assert.equal(body.success, true)

    // Verify .hivemind/ is gone
    assert.ok(!existsSync(join(projectDir, ".hivemind")))
  })

  test("POST /api/purge on empty project returns not-found", async () => {
    const { status, body } = await api("/api/purge", { method: "POST" })
    assert.equal(status, 200)
    assert.equal(body.success, false)
  })
})
