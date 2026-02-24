/**
 * HiveMind WebUI — Embedded Vue 3 + Tailwind CSS SPA
 *
 * Self-contained single-page application served when webui/dist is not built.
 * Includes:
 *  - Dashboard / Status view
 *  - Init wizard (mirrors CLI flags)
 *  - Settings editor
 *  - Brownfield Scan
 *  - Skills list, chat-wizard creation, download
 *  - Workflows list, chat-wizard creation, download
 *  - Operations (sync-assets, migrate, purge)
 *  - Environment config viewer
 *
 * Uses CDN for Vue 3 and Tailwind CSS — zero build step required.
 */

export const EMBEDDED_APP_HTML = `<!DOCTYPE html>
<html lang="en" class="h-full bg-gray-50">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HiveMind WebUI</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"><\/script>
  <style>
    [v-cloak] { display: none; }
    .chat-bubble { max-width: 85%; }
    .chat-bubble-system { background: #f0f4ff; border: 1px solid #c7d2fe; }
    .chat-bubble-user { background: #ecfdf5; border: 1px solid #a7f3d0; }
    .typing-dot { animation: typing 1.4s infinite; }
    .typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .typing-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes typing { 0%,60%,100% { opacity: 0.3; } 30% { opacity: 1; } }
  </style>
</head>
<body class="h-full">
<div id="app" v-cloak>
<div class="min-h-full flex">

  <!-- Sidebar -->
  <nav class="fixed inset-y-0 left-0 w-56 bg-gray-900 text-white flex flex-col z-30">
    <div class="p-4 border-b border-gray-700">
      <h1 class="text-lg font-bold tracking-tight">&#x1F41D; HiveMind</h1>
      <p class="text-xs text-gray-400 mt-1">Standalone WebUI Server</p>
    </div>
    <div class="flex-1 overflow-y-auto py-2">
      <button v-for="item in navItems" :key="item.id"
        @click="currentView = item.id"
        :class="['w-full text-left px-4 py-2.5 text-sm flex items-center gap-2.5 transition-colors',
          currentView === item.id ? 'bg-gray-700 text-white font-medium' : 'text-gray-300 hover:bg-gray-800 hover:text-white']">
        <span>{{ item.icon }}</span>
        <span>{{ item.label }}</span>
      </button>
    </div>
    <div class="p-3 border-t border-gray-700 text-xs text-gray-500">
      Standalone Server
    </div>
  </nav>

  <!-- Main -->
  <main class="ml-56 flex-1 p-6 min-h-screen">

    <!-- Toast -->
    <div v-if="toast.show"
      :class="['fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium max-w-sm',
        toast.type==='success' ? 'bg-green-100 text-green-800 border border-green-200' :
        toast.type==='error'   ? 'bg-red-100 text-red-800 border border-red-200' :
        'bg-blue-100 text-blue-800 border border-blue-200']">
      {{ toast.message }}
    </div>

    <!-- ═══════════ DASHBOARD ═══════════ -->
    <section v-if="currentView==='dashboard'">
      <h2 class="text-2xl font-bold text-gray-900 mb-6">Dashboard</h2>

      <div v-if="status.initialized===false" class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <p class="text-yellow-800 font-medium">&#x26A0;&#xFE0F; Project not initialized</p>
        <p class="text-yellow-700 text-sm mt-1">Go to <button @click="currentView='init'" class="underline font-medium">Init</button> to set up HiveMind.</p>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div class="bg-white rounded-lg shadow p-5 border">
          <h3 class="text-sm font-medium text-gray-500 mb-3">Session</h3>
          <div v-if="status.session_active">
            <p class="text-lg font-semibold font-mono">{{ status.session?.id?.slice(0,12) }}&#x2026;</p>
            <div class="mt-2 flex gap-2">
              <span :class="['px-2 py-0.5 rounded text-xs font-medium', status.session?.governance_status==='OPEN'?'bg-green-100 text-green-800':'bg-red-100 text-red-800']">{{ status.session?.governance_status }}</span>
              <span class="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">{{ status.session?.mode }}</span>
            </div>
          </div>
          <p v-else class="text-gray-400 text-sm">No active session</p>
        </div>

        <div class="bg-white rounded-lg shadow p-5 border">
          <h3 class="text-sm font-medium text-gray-500 mb-3">Governance</h3>
          <p class="text-lg font-semibold capitalize">{{ status.governance_mode }}</p>
          <p class="text-sm text-gray-500 mt-1">Automation: {{ status.automation_level }}</p>
        </div>

        <div class="bg-white rounded-lg shadow p-5 border">
          <h3 class="text-sm font-medium text-gray-500 mb-3">Metrics</h3>
          <div v-if="status.metrics" class="space-y-1 text-sm">
            <p>Turns: <span class="font-semibold">{{ status.metrics.turn_count }}</span></p>
            <p>Drift: <span class="font-semibold" :class="status.metrics.drift_score>50?'text-red-600':'text-green-600'">{{ status.metrics.drift_score }}/100</span></p>
            <p>Files touched: <span class="font-semibold">{{ status.metrics.files_touched }}</span></p>
          </div>
        </div>

        <div class="bg-white rounded-lg shadow p-5 border md:col-span-2 lg:col-span-3">
          <h3 class="text-sm font-medium text-gray-500 mb-3">Hierarchy</h3>
          <div v-if="status.hierarchy" class="text-sm space-y-1 font-mono">
            <p>&#x1F3AF; Trajectory: <span class="font-medium">{{ status.hierarchy.trajectory || '(none)' }}</span></p>
            <p class="ml-6">&#x1F4CB; Tactic: <span class="font-medium">{{ status.hierarchy.tactic || '(none)' }}</span></p>
            <p class="ml-12">&#x26A1; Action: <span class="font-medium">{{ status.hierarchy.action || '(none)' }}</span></p>
          </div>
        </div>
      </div>
      <button @click="loadStatus" class="mt-4 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm">&#x21BB; Refresh</button>
    </section>

    <!-- ═══════════ INIT ═══════════ -->
    <section v-if="currentView==='init'">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-900">Initialize Project</h2>
        <button @click="toggleInitWizard" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium">
          {{ initWizard.active ? '&#x2715; Close Wizard' : '&#x1F41D; Start Setup Wizard' }}
        </button>
      </div>

      <!-- ── Init Chat Wizard ── -->
      <div v-if="initWizard.active" class="bg-white rounded-lg shadow border mb-6 max-w-2xl flex flex-col" style="height:560px">
        <div class="px-4 py-3 border-b bg-gray-50 rounded-t-lg">
          <h3 class="font-semibold text-gray-800 text-sm">&#x1F41D; HiveMind + HiveFiver v2 &#x2014; Setup Wizard</h3>
          <p class="text-xs text-gray-500">Interactive guided setup &#x2014; mirrors CLI wizard flow</p>
        </div>

        <!-- Messages -->
        <div class="flex-1 overflow-y-auto p-4 space-y-3" ref="initChatBox">
          <div v-for="(msg, i) in initWizard.messages" :key="i"
            :class="['flex', msg.from==='system' ? 'justify-start' : 'justify-end']">
            <div :class="['chat-bubble rounded-lg px-3 py-2 text-sm', msg.from==='system' ? 'chat-bubble-system' : 'chat-bubble-user']">
              <div v-if="msg.options" class="space-y-1 mt-2">
                <button v-for="opt in msg.options" :key="opt.value||opt"
                  @click="answerInitWizard(opt.value||opt)"
                  class="block w-full text-left px-3 py-1.5 rounded bg-white hover:bg-indigo-50 border text-xs font-medium">
                  <span class="font-semibold">{{ opt.label||opt }}</span>
                  <span v-if="opt.hint" class="block text-gray-400 text-xs mt-0.5">{{ opt.hint }}</span>
                </button>
              </div>
              <div v-else-if="msg.checkboxes" class="space-y-1 mt-2">
                <label v-for="cb in msg.checkboxes" :key="cb.value" class="flex items-center gap-2 px-3 py-1.5 rounded bg-white border text-xs font-medium cursor-pointer hover:bg-indigo-50">
                  <input type="checkbox" :checked="initWizard.selectedExtras.includes(cb.value)" @change="toggleInitExtra(cb.value)" class="rounded">
                  <span>{{ cb.label }}</span>
                  <span v-if="cb.hint" class="text-gray-400 ml-1">&#x2014; {{ cb.hint }}</span>
                </label>
                <button @click="answerInitWizard('__extras_done__')" class="mt-2 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium">Continue &#x2192;</button>
              </div>
              <span v-else v-html="msg.text"></span>
            </div>
          </div>
          <!-- Typing indicator -->
          <div v-if="initWizard.typing" class="flex justify-start">
            <div class="chat-bubble chat-bubble-system rounded-lg px-4 py-3 flex gap-1">
              <span class="typing-dot w-2 h-2 bg-indigo-400 rounded-full inline-block"></span>
              <span class="typing-dot w-2 h-2 bg-indigo-400 rounded-full inline-block"></span>
              <span class="typing-dot w-2 h-2 bg-indigo-400 rounded-full inline-block"></span>
            </div>
          </div>
        </div>

        <!-- Input (not used in wizard, all option-based) -->
        <div v-if="initWizard.waitingInput" class="border-t p-3 flex gap-2">
          <input v-model="initWizard.inputText" @keyup.enter="answerInitWizard(initWizard.inputText)"
            class="flex-1 border rounded-md px-3 py-2 text-sm" :placeholder="initWizard.inputPlaceholder" autofocus>
          <button @click="answerInitWizard(initWizard.inputText)"
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm">Send</button>
        </div>
      </div>

      <!-- ── Fallback: flat form if wizard not active ── -->
      <form v-if="!initWizard.active" @submit.prevent="runInit" class="bg-white rounded-lg shadow border p-6 max-w-2xl space-y-4">
        <p class="text-sm text-gray-500 mb-2">Quick init with manual options &#x2014; or use the <strong>Setup Wizard</strong> above for guided setup.</p>
        <div class="grid grid-cols-2 gap-4">
          <div><label class="block text-sm font-medium text-gray-700 mb-1">Language</label>
            <select v-model="initForm.language" class="w-full border rounded-md px-3 py-2 text-sm"><option value="en">English</option><option value="vi">Ti&#x1EBF;ng Vi&#x1EC7;t</option></select></div>
          <div><label class="block text-sm font-medium text-gray-700 mb-1">Governance Mode</label>
            <select v-model="initForm.governance_mode" class="w-full border rounded-md px-3 py-2 text-sm"><option value="permissive">Permissive</option><option value="assisted">Assisted</option><option value="strict">Strict</option></select></div>
          <div><label class="block text-sm font-medium text-gray-700 mb-1">Automation Level</label>
            <select v-model="initForm.automation_level" class="w-full border rounded-md px-3 py-2 text-sm"><option value="manual">Manual</option><option value="guided">Guided</option><option value="assisted">Assisted</option><option value="full">Full</option><option value="coach">Coach</option></select></div>
          <div><label class="block text-sm font-medium text-gray-700 mb-1">Expert Level</label>
            <select v-model="initForm.expert_level" class="w-full border rounded-md px-3 py-2 text-sm"><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option><option value="expert">Expert</option></select></div>
          <div><label class="block text-sm font-medium text-gray-700 mb-1">Output Style</label>
            <select v-model="initForm.output_style" class="w-full border rounded-md px-3 py-2 text-sm"><option value="explanatory">Explanatory</option><option value="outline">Outline</option><option value="skeptical">Skeptical</option><option value="architecture">Architecture</option><option value="minimal">Minimal</option></select></div>
          <div><label class="block text-sm font-medium text-gray-700 mb-1">Sync Target</label>
            <select v-model="initForm.sync_target" class="w-full border rounded-md px-3 py-2 text-sm"><option value="project">Project</option><option value="global">Global</option><option value="both">Both</option></select></div>
        </div>
        <div class="flex gap-4 flex-wrap">
          <label class="flex items-center gap-2 text-sm"><input type="checkbox" v-model="initForm.require_code_review" class="rounded"> Require Code Review</label>
          <label class="flex items-center gap-2 text-sm"><input type="checkbox" v-model="initForm.enforce_tdd" class="rounded"> Enforce TDD</label>
          <label class="flex items-center gap-2 text-sm"><input type="checkbox" v-model="initForm.force" class="rounded text-red-600"> Force Re-init</label>
        </div>
        <button type="submit" :disabled="loading" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium disabled:opacity-50">
          {{ loading ? 'Initializing&#x2026;' : '&#x1F680; Initialize Project' }}
        </button>
      </form>
    </section>

    <!-- ═══════════ SETTINGS ═══════════ -->
    <section v-if="currentView==='settings'">
      <h2 class="text-2xl font-bold text-gray-900 mb-6">Settings</h2>
      <div v-if="!settings.initialized" class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p class="text-yellow-800">Not initialized. <button @click="currentView='init'" class="underline font-medium">Init first</button>.</p>
      </div>
      <form v-else @submit.prevent="saveSettings" class="bg-white rounded-lg shadow border p-6 max-w-2xl space-y-5">
        <div class="grid grid-cols-2 gap-4">
          <div><label class="block text-sm font-medium text-gray-700 mb-1">Governance Mode</label>
            <select v-model="settingsForm.governance_mode" class="w-full border rounded-md px-3 py-2 text-sm"><option value="permissive">Permissive</option><option value="assisted">Assisted</option><option value="strict">Strict</option></select></div>
          <div><label class="block text-sm font-medium text-gray-700 mb-1">Language</label>
            <select v-model="settingsForm.language" class="w-full border rounded-md px-3 py-2 text-sm"><option value="en">English</option><option value="vi">Ti&#x1EBF;ng Vi&#x1EC7;t</option></select></div>
          <div><label class="block text-sm font-medium text-gray-700 mb-1">Automation Level</label>
            <select v-model="settingsForm.automation_level" class="w-full border rounded-md px-3 py-2 text-sm"><option value="manual">Manual</option><option value="guided">Guided</option><option value="assisted">Assisted</option><option value="full">Full</option><option value="coach">Coach</option></select></div>
        </div>
        <h3 class="text-lg font-semibold text-gray-800 border-t pt-4">Agent Behavior</h3>
        <div class="grid grid-cols-2 gap-4">
          <div><label class="block text-sm font-medium text-gray-700 mb-1">Expert Level</label>
            <select v-model="settingsForm.agent_behavior.expert_level" class="w-full border rounded-md px-3 py-2 text-sm"><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option><option value="expert">Expert</option></select></div>
          <div><label class="block text-sm font-medium text-gray-700 mb-1">Output Style</label>
            <select v-model="settingsForm.agent_behavior.output_style" class="w-full border rounded-md px-3 py-2 text-sm"><option value="explanatory">Explanatory</option><option value="outline">Outline</option><option value="skeptical">Skeptical</option><option value="architecture">Architecture</option><option value="minimal">Minimal</option></select></div>
        </div>
        <h3 class="text-lg font-semibold text-gray-800 border-t pt-4">Constraints</h3>
        <div class="flex flex-wrap gap-x-6 gap-y-2">
          <label class="flex items-center gap-2 text-sm"><input type="checkbox" v-model="settingsForm.agent_behavior.constraints.require_code_review" class="rounded"> Code Review</label>
          <label class="flex items-center gap-2 text-sm"><input type="checkbox" v-model="settingsForm.agent_behavior.constraints.enforce_tdd" class="rounded"> TDD</label>
          <label class="flex items-center gap-2 text-sm"><input type="checkbox" v-model="settingsForm.agent_behavior.constraints.explain_reasoning" class="rounded"> Explain Reasoning</label>
          <label class="flex items-center gap-2 text-sm"><input type="checkbox" v-model="settingsForm.agent_behavior.constraints.be_skeptical" class="rounded"> Be Skeptical</label>
        </div>
        <div v-if="settings.thresholds" class="border-t pt-4">
          <h3 class="text-lg font-semibold text-gray-800 mb-3">Thresholds</h3>
          <div class="grid grid-cols-2 gap-4">
            <div><label class="block text-xs text-gray-500 mb-1">Drift warning (turns)</label>
              <input type="number" v-model.number="settingsForm.thresholds.max_turns_before_warning" class="w-full border rounded-md px-3 py-2 text-sm" min="1"></div>
            <div><label class="block text-xs text-gray-500 mb-1">Long session (turns)</label>
              <input type="number" v-model.number="settingsForm.thresholds.auto_compact_on_turns" class="w-full border rounded-md px-3 py-2 text-sm" min="1"></div>
            <div><label class="block text-xs text-gray-500 mb-1">Max active lines</label>
              <input type="number" v-model.number="settingsForm.thresholds.max_active_md_lines" class="w-full border rounded-md px-3 py-2 text-sm" min="1"></div>
            <div><label class="block text-xs text-gray-500 mb-1">Stale session (days)</label>
              <input type="number" v-model.number="settingsForm.thresholds.stale_session_days" class="w-full border rounded-md px-3 py-2 text-sm" min="1"></div>
            <div><label class="block text-xs text-gray-500 mb-1">Commit suggestion (files)</label>
              <input type="number" v-model.number="settingsForm.thresholds.commit_suggestion_threshold" class="w-full border rounded-md px-3 py-2 text-sm" min="1"></div>
          </div>
        </div>
        <button type="submit" :disabled="loading" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium disabled:opacity-50">
          {{ loading ? 'Saving&#x2026;' : '&#x1F4BE; Save Settings' }}
        </button>
      </form>
    </section>

    <!-- ═══════════ SCAN ═══════════ -->
    <section v-if="currentView==='scan'">
      <h2 class="text-2xl font-bold text-gray-900 mb-6">Brownfield Scan</h2>
      <div class="bg-white rounded-lg shadow border p-6 max-w-2xl space-y-4">
        <div><label class="block text-sm font-medium text-gray-700 mb-1">Scan Action</label>
          <select v-model="scanForm.action" class="w-full border rounded-md px-3 py-2 text-sm">
            <option value="analyze">Analyze &#x2014; Deep inspection</option>
            <option value="status">Status &#x2014; Quick overview</option>
            <option value="recommend">Recommend &#x2014; Suggestions</option>
            <option value="orchestrate">Orchestrate &#x2014; Full pipeline</option>
          </select></div>
        <label class="flex items-center gap-2 text-sm"><input type="checkbox" v-model="scanForm.include_drift" class="rounded"> Include Drift Report</label>
        <button @click="runScan" :disabled="loading" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium disabled:opacity-50">
          {{ loading ? 'Scanning&#x2026;' : '&#x1F50D; Run Scan' }}</button>
        <pre v-if="scanResult" class="mt-4 bg-gray-50 border rounded-md p-4 text-xs overflow-auto max-h-96 whitespace-pre-wrap">{{ typeof scanResult==='object' ? JSON.stringify(scanResult,null,2) : scanResult }}</pre>
      </div>
    </section>

    <!-- ═══════════ SKILLS ═══════════ -->
    <section v-if="currentView==='skills'">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-900">Skills</h2>
        <button @click="startSkillChat" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium">
          {{ skillChat.active ? '&#x2715; Close Wizard' : '+ Create Skill' }}
        </button>
      </div>

      <!-- ── Chat Wizard ── -->
      <div v-if="skillChat.active" class="bg-white rounded-lg shadow border mb-6 max-w-2xl flex flex-col" style="height:520px">
        <div class="px-4 py-3 border-b bg-gray-50 rounded-t-lg">
          <h3 class="font-semibold text-gray-800 text-sm">&#x1F4AC; Skill Creation Wizard</h3>
          <p class="text-xs text-gray-500">Chat to define your skill step by step</p>
        </div>

        <!-- Messages -->
        <div class="flex-1 overflow-y-auto p-4 space-y-3" ref="skillChatBox">
          <div v-for="(msg, i) in skillChat.messages" :key="i"
            :class="['flex', msg.from==='system' ? 'justify-start' : 'justify-end']">
            <div :class="['chat-bubble rounded-lg px-3 py-2 text-sm', msg.from==='system' ? 'chat-bubble-system' : 'chat-bubble-user']">
              <div v-if="msg.options" class="space-y-1 mt-2">
                <button v-for="opt in msg.options" :key="opt"
                  @click="answerSkillChat(opt)"
                  class="block w-full text-left px-3 py-1.5 rounded bg-white hover:bg-indigo-50 border text-xs font-medium">
                  {{ opt }}
                </button>
              </div>
              <span v-else v-html="msg.text"></span>
            </div>
          </div>
          <!-- Typing indicator -->
          <div v-if="skillChat.typing" class="flex justify-start">
            <div class="chat-bubble chat-bubble-system rounded-lg px-4 py-3 flex gap-1">
              <span class="typing-dot w-2 h-2 bg-indigo-400 rounded-full inline-block"></span>
              <span class="typing-dot w-2 h-2 bg-indigo-400 rounded-full inline-block"></span>
              <span class="typing-dot w-2 h-2 bg-indigo-400 rounded-full inline-block"></span>
            </div>
          </div>
        </div>

        <!-- Input -->
        <div v-if="skillChat.waitingInput" class="border-t p-3 flex gap-2">
          <input v-model="skillChat.inputText" @keyup.enter="answerSkillChat(skillChat.inputText)"
            class="flex-1 border rounded-md px-3 py-2 text-sm" :placeholder="skillChat.inputPlaceholder" autofocus>
          <button @click="answerSkillChat(skillChat.inputText)"
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm">Send</button>
        </div>
      </div>

      <!-- ── Skills Grid ── -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div v-for="skill in skillsList" :key="skill.name" class="bg-white rounded-lg shadow border p-4 flex items-start justify-between">
          <div class="min-w-0">
            <h3 class="font-semibold text-gray-900 truncate">{{ skill.name }}</h3>
            <p class="text-sm text-gray-600 mt-1 line-clamp-2">{{ skill.description }}</p>
            <div class="mt-2 flex gap-2">
              <span class="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">v{{ skill.version }}</span>
              <span :class="['text-xs px-2 py-0.5 rounded', skill.source==='package'?'bg-purple-100 text-purple-700':'bg-green-100 text-green-700']">{{ skill.source }}</span>
            </div>
          </div>
          <button @click="downloadSkill(skill.name)" class="ml-3 shrink-0 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded text-gray-700" title="Download">&#x2B07;&#xFE0F;</button>
          <button v-if="skill.source==='project'" @click="deleteSkill(skill.name)" class="ml-1 shrink-0 px-2 py-1 text-xs bg-red-50 hover:bg-red-100 rounded text-red-600" title="Delete">&#x1F5D1;</button>
        </div>
      </div>
      <p v-if="skillsList.length===0 && !skillChat.active" class="text-gray-500 text-sm mt-4">No skills found. Click <em>Create Skill</em> to start!</p>
    </section>

    <!-- ═══════════ WORKFLOWS ═══════════ -->
    <section v-if="currentView==='workflows'">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-900">Workflows</h2>
        <button @click="startWorkflowChat" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium">
          {{ wfChat.active ? '&#x2715; Close Wizard' : '+ Create Workflow' }}
        </button>
      </div>

      <!-- ── Workflow Chat Wizard ── -->
      <div v-if="wfChat.active" class="bg-white rounded-lg shadow border mb-6 max-w-2xl flex flex-col" style="height:520px">
        <div class="px-4 py-3 border-b bg-gray-50 rounded-t-lg">
          <h3 class="font-semibold text-gray-800 text-sm">&#x1F4AC; Workflow Creation Wizard</h3>
          <p class="text-xs text-gray-500">Chat to build your workflow step by step</p>
        </div>

        <div class="flex-1 overflow-y-auto p-4 space-y-3" ref="wfChatBox">
          <div v-for="(msg, i) in wfChat.messages" :key="i"
            :class="['flex', msg.from==='system' ? 'justify-start' : 'justify-end']">
            <div :class="['chat-bubble rounded-lg px-3 py-2 text-sm', msg.from==='system' ? 'chat-bubble-system' : 'chat-bubble-user']">
              <div v-if="msg.options" class="space-y-1 mt-2">
                <button v-for="opt in msg.options" :key="opt"
                  @click="answerWfChat(opt)"
                  class="block w-full text-left px-3 py-1.5 rounded bg-white hover:bg-indigo-50 border text-xs font-medium">
                  {{ opt }}
                </button>
              </div>
              <span v-else v-html="msg.text"></span>
            </div>
          </div>
          <div v-if="wfChat.typing" class="flex justify-start">
            <div class="chat-bubble chat-bubble-system rounded-lg px-4 py-3 flex gap-1">
              <span class="typing-dot w-2 h-2 bg-indigo-400 rounded-full inline-block"></span>
              <span class="typing-dot w-2 h-2 bg-indigo-400 rounded-full inline-block"></span>
              <span class="typing-dot w-2 h-2 bg-indigo-400 rounded-full inline-block"></span>
            </div>
          </div>
        </div>

        <div v-if="wfChat.waitingInput" class="border-t p-3 flex gap-2">
          <input v-model="wfChat.inputText" @keyup.enter="answerWfChat(wfChat.inputText)"
            class="flex-1 border rounded-md px-3 py-2 text-sm" :placeholder="wfChat.inputPlaceholder" autofocus>
          <button @click="answerWfChat(wfChat.inputText)"
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm">Send</button>
        </div>
      </div>

      <!-- ── Workflows Grid ── -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div v-for="wf in workflowsList" :key="wf.name" class="bg-white rounded-lg shadow border p-4 flex items-start justify-between">
          <div class="min-w-0">
            <h3 class="font-semibold text-gray-900 truncate">{{ wf.name }}</h3>
            <p class="text-sm text-gray-600 mt-1 line-clamp-2">{{ wf.description }}</p>
            <div class="mt-2 flex gap-2">
              <span class="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">v{{ wf.version }}</span>
              <span class="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">{{ wf.steps }} steps</span>
              <span :class="['text-xs px-2 py-0.5 rounded', wf.source==='package'?'bg-purple-100 text-purple-700':'bg-green-100 text-green-700']">{{ wf.source }}</span>
            </div>
          </div>
          <button @click="downloadWorkflow(wf.name)" class="ml-3 shrink-0 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded text-gray-700" title="Download">&#x2B07;&#xFE0F;</button>
          <button v-if="wf.source==='project'" @click="deleteWorkflow(wf.name)" class="ml-1 shrink-0 px-2 py-1 text-xs bg-red-50 hover:bg-red-100 rounded text-red-600" title="Delete">&#x1F5D1;</button>
        </div>
      </div>
      <p v-if="workflowsList.length===0 && !wfChat.active" class="text-gray-500 text-sm mt-4">No workflows found. Click <em>Create Workflow</em> to start!</p>
    </section>

    <!-- ═══════════ OPERATIONS ═══════════ -->
    <section v-if="currentView==='operations'">
      <h2 class="text-2xl font-bold text-gray-900 mb-6">Operations</h2>
      <div class="space-y-4 max-w-2xl">
        <div class="bg-white rounded-lg shadow border p-5">
          <h3 class="font-semibold text-gray-900 mb-2">&#x1F4E6; Compact Session</h3>
          <p class="text-sm text-gray-600 mb-3">Archive the current session and start fresh. Preserves history and memory.</p>
          <div class="flex gap-3 items-end flex-wrap">
            <div class="flex-1"><label class="block text-xs text-gray-500 mb-1">Summary (optional)</label>
              <input v-model="compactSummary" type="text" class="w-full border rounded px-2 py-1 text-sm" placeholder="Brief summary of what was accomplished"></div>
            <button @click="runCompact" :disabled="loading" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm disabled:opacity-50">Compact</button>
          </div>
          <pre v-if="compactResult" class="mt-3 bg-gray-50 border rounded p-3 text-xs whitespace-pre-wrap">{{ JSON.stringify(compactResult,null,2) }}</pre>
        </div>
        <div class="bg-white rounded-lg shadow border p-5">
          <h3 class="font-semibold text-gray-900 mb-2">&#x1F4DA; Session Archives</h3>
          <p class="text-sm text-gray-600 mb-3">Previously archived sessions.</p>
          <button @click="loadArchives" :disabled="loading" class="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm disabled:opacity-50 mb-3">&#x21BB; Load Archives</button>
          <div v-if="archivesList" class="text-sm">
            <p class="text-gray-500 mb-2">{{ archivesList.count }} archived session(s)</p>
            <ul v-if="archivesList.archives.length > 0" class="space-y-1">
              <li v-for="a in archivesList.archives" :key="a" class="font-mono text-xs bg-gray-50 px-2 py-1 rounded border">{{ a }}</li>
            </ul>
          </div>
        </div>
        <div class="bg-white rounded-lg shadow border p-5">
          <h3 class="font-semibold text-gray-900 mb-2">&#x1F4E6; Sync Assets</h3>
          <p class="text-sm text-gray-600 mb-3">Copy packaged OpenCode assets to .opencode/ directory.</p>
          <div class="flex gap-3 items-end flex-wrap">
            <div><label class="block text-xs text-gray-500 mb-1">Target</label>
              <select v-model="opsForm.syncTarget" class="border rounded px-2 py-1 text-sm"><option value="project">Project</option><option value="global">Global</option><option value="both">Both</option></select></div>
            <label class="flex items-center gap-1 text-sm"><input type="checkbox" v-model="opsForm.syncOverwrite" class="rounded"> Overwrite</label>
            <label class="flex items-center gap-1 text-sm"><input type="checkbox" v-model="opsForm.syncClean" class="rounded"> Clean</label>
            <button @click="runSyncAssets" :disabled="loading" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm disabled:opacity-50">Sync</button>
          </div>
          <pre v-if="syncResult" class="mt-3 bg-gray-50 border rounded p-3 text-xs whitespace-pre-wrap">{{ JSON.stringify(syncResult,null,2) }}</pre>
        </div>
        <div class="bg-white rounded-lg shadow border p-5">
          <h3 class="font-semibold text-gray-900 mb-2">&#x1F504; Migrate</h3>
          <p class="text-sm text-gray-600 mb-3">Migrate legacy flat files to graph structure (one-time).</p>
          <button @click="runMigrate" :disabled="loading" class="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded text-sm disabled:opacity-50">Run Migration</button>
          <pre v-if="migrateResult" class="mt-3 bg-gray-50 border rounded p-3 text-xs whitespace-pre-wrap">{{ JSON.stringify(migrateResult,null,2) }}</pre>
        </div>
        <div class="bg-white rounded-lg shadow border p-5 border-red-200">
          <h3 class="font-semibold text-red-700 mb-2">&#x1F5D1;&#xFE0F; Purge</h3>
          <p class="text-sm text-gray-600 mb-3">Remove .hivemind/ directory entirely. <strong class="text-red-600">Destructive!</strong></p>
          <button @click="confirmPurge" :disabled="loading" class="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-sm disabled:opacity-50">&#x26A0;&#xFE0F; Purge</button>
        </div>
      </div>
    </section>

    <!-- ═══════════ ENV CONFIG ═══════════ -->
    <section v-if="currentView==='envconfig'">
      <h2 class="text-2xl font-bold text-gray-900 mb-6">Environment Configuration</h2>
      <div class="bg-white rounded-lg shadow border p-6 max-w-2xl">
        <p class="text-sm text-gray-600 mb-4">Values loaded from environment variables. Edit <code class="bg-gray-100 px-1.5 py-0.5 rounded text-xs">.env</code> and restart the server to apply changes.</p>
        <div v-if="envConfig" class="divide-y">
          <div v-for="(val, key) in envConfig" :key="key" class="flex items-center justify-between py-2.5">
            <span class="text-sm font-mono text-gray-600">{{ key }}</span>
            <span class="text-sm font-semibold text-gray-900 ml-4 text-right">{{ val }}</span>
          </div>
        </div>
        <button @click="loadEnvConfig" class="mt-4 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm">&#x21BB; Refresh</button>
      </div>
    </section>

    <!-- ═══════════ LLM CONFIG ═══════════ -->
    <section v-if="currentView==='llmconfig'">
      <h2 class="text-2xl font-bold text-gray-900 mb-6">LLM Provider Configuration</h2>
      <div class="bg-white rounded-lg shadow border p-6 max-w-2xl space-y-5">
        <p class="text-sm text-gray-600 mb-2">Configure an <strong>OpenAI API-compatible</strong> LLM provider. This powers the interactive wizards for Init, Skill, and Workflow creation.</p>

        <div class="flex items-center gap-3 p-3 rounded-lg" :class="llmForm.enabled ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'">
          <label class="flex items-center gap-2 text-sm font-medium cursor-pointer">
            <input type="checkbox" v-model="llmForm.enabled" class="rounded">
            <span :class="llmForm.enabled ? 'text-green-800' : 'text-gray-600'">{{ llmForm.enabled ? '&#x2705; LLM Provider Enabled' : 'LLM Provider Disabled' }}</span>
          </label>
        </div>

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Base URL</label>
            <input v-model="llmForm.base_url" type="text" class="w-full border rounded-md px-3 py-2 text-sm font-mono" placeholder="https://api.openai.com/v1">
            <p class="text-xs text-gray-400 mt-1">OpenAI: https://api.openai.com/v1 &#x2022; Local: http://localhost:11434/v1 &#x2022; Any OpenAI-compatible endpoint</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">API Key</label>
            <div class="relative">
              <input v-model="llmForm.api_key" :type="showApiKey ? 'text' : 'password'" class="w-full border rounded-md px-3 py-2 text-sm font-mono pr-20" placeholder="sk-...">
              <button @click="showApiKey = !showApiKey" type="button" class="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded text-gray-600">
                {{ showApiKey ? 'Hide' : 'Show' }}
              </button>
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Model</label>
            <input v-model="llmForm.model" type="text" class="w-full border rounded-md px-3 py-2 text-sm font-mono" placeholder="gpt-3.5-turbo">
            <p class="text-xs text-gray-400 mt-1">e.g. gpt-4o, gpt-3.5-turbo, deepseek-chat, llama3, etc.</p>
          </div>
        </div>

        <div class="flex gap-3 pt-2">
          <button @click="saveLLMConfig" :disabled="loading" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium disabled:opacity-50">
            {{ loading ? 'Saving&#x2026;' : '&#x1F4BE; Save Configuration' }}
          </button>
          <button @click="testLLMConnection" :disabled="loading || !llmForm.enabled" class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium disabled:opacity-50">
            {{ loading ? 'Testing&#x2026;' : '&#x1F50C; Test Connection' }}
          </button>
        </div>

        <div v-if="llmTestResult" class="p-3 rounded-lg text-sm" :class="llmTestResult.success ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'">
          {{ llmTestResult.message }}
        </div>
      </div>
    </section>

  </main>
</div>
</div>

<script>
const { createApp, ref, reactive, onMounted, watch, nextTick } = Vue

createApp({
  setup() {
    const currentView = ref('dashboard')
    const loading = ref(false)
    const toast = reactive({ show: false, message: '', type: 'info' })
    const skillChatBox = ref(null)
    const wfChatBox = ref(null)

    const navItems = [
      { id: 'dashboard', icon: '📊', label: 'Dashboard' },
      { id: 'init',      icon: '🚀', label: 'Init' },
      { id: 'settings',  icon: '⚙️', label: 'Settings' },
      { id: 'scan',      icon: '🔍', label: 'Scan' },
      { id: 'skills',    icon: '🎯', label: 'Skills' },
      { id: 'workflows', icon: '🔗', label: 'Workflows' },
      { id: 'operations',icon: '🛠️', label: 'Operations' },
      { id: 'llmconfig', icon: '🤖', label: 'LLM Config' },
      { id: 'envconfig', icon: '📋', label: 'Env Config' },
    ]

    function showToast(msg, type='info') {
      toast.message = msg; toast.type = type; toast.show = true
      setTimeout(() => { toast.show = false }, 3500)
    }

    async function api(path, opts={}) {
      const r = await fetch(path, { headers:{'Content-Type':'application/json'}, ...opts })
      return r.json()
    }

    // ── Dashboard ──
    const status = reactive({})
    async function loadStatus() {
      try { Object.assign(status, await api('/api/status')) }
      catch(e) { showToast('Status load failed','error') }
    }

    // ── Init ──
    const initForm = reactive({
      language:'en', governance_mode:'assisted', automation_level:'assisted',
      expert_level:'intermediate', output_style:'explanatory', sync_target:'project',
      require_code_review:false, enforce_tdd:false, force:false
    })
    async function runInit() {
      loading.value = true
      try {
        const d = await api('/api/init',{method:'POST',body:JSON.stringify(initForm)})
        showToast(d.message||'Done', d.success?'success':'error')
        loadStatus()
      } catch(e){showToast('Init failed','error')} finally{loading.value=false}
    }

    // ══════════ INIT CHAT WIZARD ══════════
    const initChatBox = ref(null)
    const initWizard = reactive({
      active: false, messages: [], step: '', typing: false,
      waitingInput: false, inputText: '', inputPlaceholder: '',
      selectedExtras: [],
      data: {
        profile: 'intermediate',
        governance_mode: 'assisted', language: 'en', automation_level: 'assisted',
        expert_level: 'intermediate', output_style: 'explanatory',
        require_code_review: false, enforce_tdd: false,
        sync_target: 'project'
      },
      presets: null
    })

    function scrollInitChat() { nextTick(()=>{ if(initChatBox.value) initChatBox.value.scrollTop = initChatBox.value.scrollHeight }) }

    function initSysMsg(text, options, checkboxes) {
      initWizard.typing = true; scrollInitChat()
      setTimeout(()=>{
        initWizard.typing = false
        initWizard.messages.push({ from:'system', text, options: options||null, checkboxes: checkboxes||null })
        scrollInitChat()
      }, 400)
    }

    async function toggleInitWizard() {
      if(initWizard.active){ initWizard.active=false; return }
      initWizard.active = true; initWizard.messages = []; initWizard.step = 'profile'
      initWizard.selectedExtras = []
      initWizard.data = {
        profile:'intermediate', governance_mode:'assisted', language:'en',
        automation_level:'assisted', expert_level:'intermediate', output_style:'explanatory',
        require_code_review:false, enforce_tdd:false, sync_target:'project'
      }
      // Fetch presets from API
      try { initWizard.presets = await api('/api/init/wizard') } catch(e){ initWizard.presets = null }
      initWizard.waitingInput = false
      initSysMsg("Welcome! Let's set up HiveMind together. \\u{1F41D}\\u{1F680}<br><br><strong>What kind of developer are you?</strong>", [
        { value:'beginner', label:'Beginner', hint:'Learning with AI. Maximum guidance, asks before acting.' },
        { value:'intermediate', label:'Intermediate (recommended)', hint:'Comfortable with AI tools. Balanced automation.' },
        { value:'advanced', label:'Advanced', hint:'Experienced. Permissive, outline responses, full control.' },
        { value:'expert', label:'Expert', hint:'Senior developer. Minimal guidance, terse responses.' },
        { value:'coach', label:'Coach (max guidance)', hint:'Strict governance, skeptical, asks everything.' },
      ])
    }

    function toggleInitExtra(val) {
      const idx = initWizard.selectedExtras.indexOf(val)
      if(idx === -1) initWizard.selectedExtras.push(val)
      else initWizard.selectedExtras.splice(idx, 1)
    }

    function getPresetDefaults(profileKey) {
      if(initWizard.presets && initWizard.presets.profiles && initWizard.presets.profiles[profileKey]) {
        return initWizard.presets.profiles[profileKey]
      }
      // Fallback defaults
      const defaults = {
        beginner:      { governance_mode:'assisted', automation_level:'assisted', expert_level:'beginner',     output_style:'explanatory', require_code_review:false, enforce_tdd:false },
        intermediate:  { governance_mode:'assisted', automation_level:'assisted', expert_level:'intermediate', output_style:'explanatory', require_code_review:false, enforce_tdd:false },
        advanced:      { governance_mode:'permissive',automation_level:'guided', expert_level:'advanced',     output_style:'outline',      require_code_review:false, enforce_tdd:false },
        expert:        { governance_mode:'permissive',automation_level:'manual', expert_level:'expert',       output_style:'minimal',      require_code_review:false, enforce_tdd:false },
        coach:         { governance_mode:'strict',    automation_level:'coach',  expert_level:'beginner',     output_style:'skeptical',    require_code_review:true,  enforce_tdd:false },
      }
      return defaults[profileKey] || defaults.intermediate
    }

    async function answerInitWizard(answer) {
      const val = (typeof answer === 'string' ? answer : '').trim()
      if(!val && initWizard.step !== 'extras') return
      initWizard.inputText = ''
      if(val && val !== '__extras_done__') initWizard.messages.push({ from:'user', text: val })
      scrollInitChat()

      const isCoach = initWizard.data.automation_level === 'coach'

      switch(initWizard.step) {
        case 'profile': {
          initWizard.data.profile = val
          const p = getPresetDefaults(val)
          Object.assign(initWizard.data, p)
          initWizard.step = 'governance_mode'
          initSysMsg("Profile: <strong>" + val + "</strong> \\u2705<br><br><strong>Governance mode</strong> \\u2014 how strict should session enforcement be?", [
            { value:'assisted', label:'Assisted (recommended)', hint:'Session starts OPEN. Warns on drift but never blocks.' },
            { value:'strict',   label:'Strict',                 hint:'Session starts LOCKED. Must declare_intent before writing.' },
            { value:'permissive',label:'Permissive',            hint:'Always OPEN. Silent tracking only, zero pressure.' },
          ])
          break
        }

        case 'governance_mode':
          initWizard.data.governance_mode = val
          initWizard.step = 'language'
          initSysMsg("Governance: <strong>" + val + "</strong> \\u2705<br><br><strong>Language</strong> for agent responses?", [
            { value:'en', label:'English' },
            { value:'vi', label:'Ti\\u1EBFng Vi\\u1EC7t' },
          ])
          break

        case 'language':
          initWizard.data.language = val
          initWizard.step = 'automation_level'
          initSysMsg("Language: <strong>" + (val==='en'?'English':'Ti\\u1EBFng Vi\\u1EC7t') + "</strong> \\u2705<br><br><strong>Automation level</strong> \\u2014 how much should HiveMind intervene?", [
            { value:'manual',   label:'Manual',                hint:'Minimal automation. You drive everything.' },
            { value:'guided',   label:'Guided',                hint:'Gentle nudges when drift detected.' },
            { value:'assisted', label:'Assisted (recommended)',hint:'Active guidance with evidence-based warnings.' },
            { value:'full',     label:'Full',                  hint:'Maximum governance. System argues back with evidence.' },
            { value:'coach',    label:'Coach (max guidance)',   hint:'Strict mode, skeptical review, code review required.' },
          ])
          break

        case 'automation_level':
          initWizard.data.automation_level = val
          if(val === 'coach') {
            // Coach mode: auto-set expert/style/constraints and skip to summary
            initWizard.data.governance_mode = 'strict'
            initWizard.data.expert_level = 'beginner'
            initWizard.data.output_style = 'skeptical'
            initWizard.data.require_code_review = true
            initWizard.step = 'summary'
            showInitSummary()
          } else {
            initWizard.step = 'expert_level'
            initSysMsg("Automation: <strong>" + val + "</strong> \\u2705<br><br><strong>Your expertise level</strong> \\u2014 affects response depth and assumptions?", [
              { value:'beginner',     label:'Beginner',                hint:'Explain everything, assume little prior knowledge.' },
              { value:'intermediate', label:'Intermediate (recommended)', hint:'Standard technical depth, balanced explanations.' },
              { value:'advanced',     label:'Advanced',                hint:'Skip basics, focus on implementation details.' },
              { value:'expert',       label:'Expert',                  hint:'Minimal explanation, code-first, challenge assumptions.' },
            ])
          }
          break

        case 'expert_level':
          initWizard.data.expert_level = val
          initWizard.step = 'output_style'
          initSysMsg("Expert level: <strong>" + val + "</strong> \\u2705<br><br><strong>Output style</strong> \\u2014 how should the agent format responses?", [
            { value:'explanatory',  label:'Explanatory (recommended)', hint:'Detailed explanations with reasoning.' },
            { value:'outline',      label:'Outline',                   hint:'Bullet points and structured summaries.' },
            { value:'skeptical',    label:'Skeptical',                 hint:'Critical review, challenge assumptions.' },
            { value:'architecture', label:'Architecture',              hint:'Focus on design patterns and structure.' },
            { value:'minimal',      label:'Minimal',                   hint:'Brief, code-only responses.' },
          ])
          break

        case 'output_style':
          initWizard.data.output_style = val
          initWizard.step = 'extras'
          initWizard.selectedExtras = []
          if(initWizard.data.require_code_review) initWizard.selectedExtras.push('code-review')
          if(initWizard.data.enforce_tdd) initWizard.selectedExtras.push('tdd')
          initSysMsg("Style: <strong>" + val + "</strong> \\u2705<br><br><strong>Additional constraints</strong> (optional, click Continue to skip):", null, [
            { value:'code-review', label:'Require code review', hint:'Agent must review code before accepting.' },
            { value:'tdd',         label:'Enforce TDD',         hint:'Write failing test first, then implementation.' },
          ])
          break

        case 'extras':
          if(val === '__extras_done__') {
            initWizard.messages.push({ from:'user', text: initWizard.selectedExtras.length > 0 ? initWizard.selectedExtras.join(', ') : '(none)' })
            scrollInitChat()
          }
          initWizard.data.require_code_review = initWizard.selectedExtras.includes('code-review')
          initWizard.data.enforce_tdd = initWizard.selectedExtras.includes('tdd')
          initWizard.step = 'summary'
          showInitSummary()
          break

        case 'confirm':
          if(val.includes('Proceed')){
            loading.value = true
            try {
              const payload = {
                language: initWizard.data.language,
                governance_mode: initWizard.data.governance_mode,
                automation_level: initWizard.data.automation_level,
                expert_level: initWizard.data.expert_level,
                output_style: initWizard.data.output_style,
                require_code_review: initWizard.data.require_code_review,
                enforce_tdd: initWizard.data.enforce_tdd,
                sync_target: initWizard.data.sync_target,
              }
              const d = await api('/api/init',{method:'POST',body:JSON.stringify(payload)})
              if(d.success){ initSysMsg("\\u{1F389} HiveMind initialized successfully!<br>Your project is ready. Visit the <strong>Dashboard</strong> to see session status.")
                loadStatus()
                setTimeout(()=>{ initWizard.waitingInput=false; initWizard.step='done' }, 500)
              } else { initSysMsg("\\u274C Error: " + (d.error||d.message||'Unknown error')); initWizard.step='done' }
            } catch(e){ initSysMsg("\\u274C Failed: " + e.message); initWizard.step='done' }
            finally { loading.value = false }
          } else {
            initSysMsg("Setup cancelled. No changes were made.")
            initWizard.step = 'done'
          }
          break
      }
    }

    function showInitSummary() {
      const d = initWizard.data
      const isCoach = d.automation_level === 'coach'
      const summary = [
        'Profile:     ' + d.profile,
        'Governance:  ' + (isCoach ? 'strict (forced)' : d.governance_mode),
        'Language:    ' + (d.language === 'en' ? 'English' : 'Ti\\u1EBFng Vi\\u1EC7t'),
        'Automation:  ' + d.automation_level + (isCoach ? ' (max guidance)' : ''),
        'Expert:      ' + (isCoach ? 'beginner (forced)' : d.expert_level),
        'Style:       ' + (isCoach ? 'skeptical (forced)' : d.output_style),
        d.require_code_review || isCoach ? '\\u2713 Code review required' : '',
        d.enforce_tdd ? '\\u2713 TDD enforced' : '',
      ].filter(Boolean).join('<br>')
      initSysMsg("\\u{1F4CB} <strong>Configuration Summary</strong><br><br><code style='white-space:pre-wrap;display:block;padding:8px;background:#f9fafb;border-radius:6px;font-size:12px'>" + summary + "</code>")
      setTimeout(()=>{
        initWizard.messages.push({ from:'system', text:'Proceed with this configuration?', options:[
          { value:'\\u2705 Proceed', label:'\\u2705 Proceed' },
          { value:'\\u274C Cancel', label:'\\u274C Cancel' },
        ]})
        initWizard.step = 'confirm'
        scrollInitChat()
      }, 600)
    }

    // ── Settings ──
    const settings = reactive({ initialized:false })
    const settingsForm = reactive({
      governance_mode:'assisted', language:'en', automation_level:'assisted',
      agent_behavior:{ expert_level:'intermediate', output_style:'explanatory',
        constraints:{ require_code_review:false, enforce_tdd:false, explain_reasoning:true, be_skeptical:false }},
      thresholds:{ max_turns_before_warning:5, auto_compact_on_turns:20, max_active_md_lines:50, stale_session_days:3, commit_suggestion_threshold:5 }
    })
    async function loadSettings() {
      try {
        const d = await api('/api/settings'); Object.assign(settings, d)
        if(d.initialized){
          settingsForm.governance_mode=d.governance_mode; settingsForm.language=d.language
          settingsForm.automation_level=d.automation_level
          if(d.agent_behavior){
            settingsForm.agent_behavior.expert_level=d.agent_behavior.expert_level
            settingsForm.agent_behavior.output_style=d.agent_behavior.output_style
            if(d.agent_behavior.constraints) Object.assign(settingsForm.agent_behavior.constraints, d.agent_behavior.constraints)
          }
          if(d.thresholds) Object.assign(settingsForm.thresholds, d.thresholds)
        }
      } catch(e){showToast('Settings load failed','error')}
    }
    async function saveSettings() {
      loading.value = true
      try {
        const d = await api('/api/settings',{method:'PUT',body:JSON.stringify(settingsForm)})
        showToast(d.message||'Saved', d.success?'success':'error')
      } catch(e){showToast('Save failed','error')} finally{loading.value=false}
    }

    // ── Scan ──
    const scanForm = reactive({ action:'analyze', include_drift:false })
    const scanResult = ref(null)
    async function runScan() {
      loading.value=true; scanResult.value=null
      try {
        const d = await api('/api/scan',{method:'POST',body:JSON.stringify(scanForm)})
        scanResult.value = d.result||d; showToast('Scan complete','success')
      } catch(e){showToast('Scan failed','error')} finally{loading.value=false}
    }

    // ══════════ SKILL CHAT WIZARD ══════════
    const skillsList = ref([])
    const skillChat = reactive({
      active: false, messages: [], step: '', typing: false,
      waitingInput: false, inputText: '', inputPlaceholder: '',
      data: { name:'', description:'', version:'1.0.0', triggers:[], content:'' },
      triggerCount: 0
    })

    async function loadSkills() {
      try { skillsList.value = (await api('/api/skills')).skills||[] }
      catch(e){ showToast('Skills load failed','error') }
    }

    function scrollSkillChat() { nextTick(()=>{ if(skillChatBox.value) skillChatBox.value.scrollTop = skillChatBox.value.scrollHeight }) }

    function sysMsg(text, options) {
      skillChat.typing = true; scrollSkillChat()
      setTimeout(()=>{
        skillChat.typing = false
        skillChat.messages.push({ from:'system', text, options: options||null })
        scrollSkillChat()
      }, 400)
    }

    function startSkillChat() {
      if(skillChat.active){ skillChat.active=false; return }
      skillChat.active=true; skillChat.messages=[]; skillChat.step='name'
      skillChat.data = { name:'', description:'', version:'1.0.0', triggers:[], content:'' }
      skillChat.triggerCount = 0
      sysMsg("Welcome! Let's create a new skill together. 🚀<br><br>What would you like to <strong>name</strong> your skill?<br><small class='text-gray-500'>Use kebab-case, e.g. my-debug-skill</small>")
      skillChat.waitingInput=true; skillChat.inputPlaceholder='Skill name (e.g. my-debug-skill)'
    }

    async function answerSkillChat(answer) {
      const val = (typeof answer === 'string' ? answer : '').trim()
      if(!val && skillChat.step !== 'trigger_more') return
      skillChat.inputText = ''
      if(val) skillChat.messages.push({ from:'user', text: val })
      scrollSkillChat()

      switch(skillChat.step) {
        case 'name':
          if(!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(val)){
            sysMsg("❌ Name must start with a letter and contain only letters, numbers, hyphens, and underscores. Try again:")
            return
          }
          skillChat.data.name = val
          skillChat.step = 'description'
          sysMsg("Great name! ✅<br><br>Now, <strong>describe</strong> what this skill does:")
          skillChat.inputPlaceholder = 'Skill description'
          break

        case 'description':
          if(val.length < 5){ sysMsg("❌ Description too short. Please provide a meaningful description:"); return }
          skillChat.data.description = val
          skillChat.step = 'version'
          sysMsg("Good. What <strong>version</strong> is this?", null)
          setTimeout(()=>{
            skillChat.messages.push({ from:'system', text:'Pick a version:', options:['1.0.0','0.1.0','Custom'] })
            scrollSkillChat()
          }, 500)
          skillChat.waitingInput = false
          break

        case 'version':
          if(val === 'Custom'){ skillChat.waitingInput=true; skillChat.inputPlaceholder='Enter version (e.g. 2.0.0)'; return }
          skillChat.data.version = val || '1.0.0'
          skillChat.step = 'trigger_ask'
          sysMsg("Version set to <strong>" + skillChat.data.version + "</strong>.<br><br>Now let's define <strong>triggers</strong> — when should this skill activate?<br><small>Enter a trigger description:</small>")
          skillChat.waitingInput = true; skillChat.inputPlaceholder = 'e.g. When agent starts a session'
          break

        case 'trigger_ask':
          skillChat.data.triggers.push(val)
          skillChat.triggerCount++
          skillChat.step = 'trigger_more'
          sysMsg("Trigger #" + skillChat.triggerCount + " added. ✅ Add another?", ['Add another trigger', 'Done with triggers'])
          skillChat.waitingInput = false
          break

        case 'trigger_more':
          if(val === 'Add another trigger'){
            skillChat.step = 'trigger_ask'
            skillChat.waitingInput = true; skillChat.inputPlaceholder = 'Another trigger condition'
            sysMsg("Enter the next trigger:")
          } else {
            skillChat.step = 'content'
            sysMsg("Triggers defined (" + skillChat.data.triggers.length + " total). 👍<br><br>Now write the <strong>skill content</strong> (Markdown instructions for the AI agent):<br><small>This is the main body of your SKILL.md</small>")
            skillChat.waitingInput = true; skillChat.inputPlaceholder = 'Skill content (Markdown)'
          }
          break

        case 'content':
          skillChat.data.content = val
          skillChat.step = 'confirm'
          skillChat.waitingInput = false
          const preview = "📄 <strong>Skill Preview:</strong><br>" +
            "<code>" + skillChat.data.name + "</code> v" + skillChat.data.version + "<br>" +
            "Description: " + skillChat.data.description + "<br>" +
            "Triggers: " + skillChat.data.triggers.length + "<br>" +
            "Content: " + val.length + " characters"
          sysMsg(preview)
          setTimeout(()=>{
            skillChat.messages.push({ from:'system', text:'Create this skill?', options:['✅ Create', '❌ Cancel'] })
            scrollSkillChat()
          }, 600)
          break

        case 'confirm':
          if(val.includes('Create')){
            loading.value = true
            try {
              const d = await api('/api/skills',{method:'POST',body:JSON.stringify(skillChat.data)})
              if(d.success){ sysMsg("🎉 Skill <strong>" + skillChat.data.name + "</strong> created successfully!<br>You can now download it from the list below.")
                loadSkills()
                setTimeout(()=>{ skillChat.waitingInput=false; skillChat.step='done' }, 500)
              } else { sysMsg("❌ Error: " + (d.error||'Unknown error')); skillChat.step='done' }
            } catch(e){ sysMsg("❌ Failed: " + e.message); skillChat.step='done' }
            finally { loading.value = false }
          } else {
            sysMsg("Cancelled. No skill was created.")
            skillChat.step = 'done'
          }
          break
      }
    }

    function downloadSkill(name) { window.open('/api/skills/' + encodeURIComponent(name) + '/download') }

    // ══════════ WORKFLOW CHAT WIZARD ══════════
    const workflowsList = ref([])
    const wfChat = reactive({
      active: false, messages: [], step: '', typing: false,
      waitingInput: false, inputText: '', inputPlaceholder: '',
      data: { name:'', description:'', version:'1', steps:[] },
      currentStep: { name:'', tool:'', args:{} }, argKey:'', stepCount: 0
    })

    async function loadWorkflows() {
      try { workflowsList.value = (await api('/api/workflows')).workflows||[] }
      catch(e){ showToast('Workflows load failed','error') }
    }

    function scrollWfChat() { nextTick(()=>{ if(wfChatBox.value) wfChatBox.value.scrollTop = wfChatBox.value.scrollHeight }) }

    function wfSys(text, options) {
      wfChat.typing = true; scrollWfChat()
      setTimeout(()=>{
        wfChat.typing = false
        wfChat.messages.push({ from:'system', text, options: options||null })
        scrollWfChat()
      }, 400)
    }

    function startWorkflowChat() {
      if(wfChat.active){ wfChat.active=false; return }
      wfChat.active=true; wfChat.messages=[]; wfChat.step='name'
      wfChat.data = { name:'', description:'', version:'1', steps:[] }
      wfChat.stepCount = 0
      wfSys("Let's build a workflow! 🔗<br><br>What would you like to <strong>name</strong> it?<br><small class='text-gray-500'>Use kebab-case, e.g. my-deploy-workflow</small>")
      wfChat.waitingInput=true; wfChat.inputPlaceholder='Workflow name'
    }

    const KNOWN_TOOLS = [
      'hivemind_session','hivemind_inspect','hivemind_memory',
      'hivemind_anchor','hivemind_hierarchy','hivemind_cycle',
      'scan_hierarchy','map_context','declare_intent',
      'save_mem','recall_mems','export_cycle','Custom...'
    ]

    async function answerWfChat(answer) {
      const val = (typeof answer === 'string' ? answer : '').trim()
      if(!val) return
      wfChat.inputText = ''
      wfChat.messages.push({ from:'user', text: val })
      scrollWfChat()

      switch(wfChat.step) {
        case 'name':
          if(!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(val)){
            wfSys("❌ Invalid name. Use letters, numbers, hyphens. Try again:"); return
          }
          wfChat.data.name = val; wfChat.step = 'description'
          wfSys("Name set to <strong>" + val + "</strong>. ✅<br><br><strong>Describe</strong> what this workflow does:")
          wfChat.inputPlaceholder = 'Workflow description'
          break

        case 'description':
          wfChat.data.description = val; wfChat.step = 'version'
          wfSys("What <strong>version</strong>?", ['1', '2', 'Custom'])
          wfChat.waitingInput = false
          break

        case 'version':
          if(val === 'Custom'){ wfChat.waitingInput=true; wfChat.inputPlaceholder='Version number'; return }
          wfChat.data.version = val || '1'
          wfChat.step = 'step_name'
          wfChat.stepCount++
          wfSys("Version: <strong>" + wfChat.data.version + "</strong>. Now let's add steps!<br><br>📍 <strong>Step " + wfChat.stepCount + "</strong> — what should it be called?")
          wfChat.waitingInput = true; wfChat.inputPlaceholder = 'Step name (e.g. analyze)'
          break

        case 'step_name':
          wfChat.currentStep = { name: val, tool: '', args: {} }
          wfChat.step = 'step_tool'
          wfSys("Step <strong>" + val + "</strong> — which <strong>tool</strong> should it use?", KNOWN_TOOLS)
          wfChat.waitingInput = false
          break

        case 'step_tool':
          if(val === 'Custom...'){ wfChat.waitingInput=true; wfChat.inputPlaceholder='Tool name'; return }
          wfChat.currentStep.tool = val
          wfChat.step = 'step_args_ask'
          wfSys("Tool: <strong>" + val + "</strong>. Does this step need arguments?", ['Yes, add args', 'No args needed'])
          wfChat.waitingInput = false
          break

        case 'step_args_ask':
          if(val.startsWith('Yes')){
            wfChat.step = 'step_arg_key'
            wfSys("Enter argument <strong>key</strong>:")
            wfChat.waitingInput = true; wfChat.inputPlaceholder = 'Arg key (e.g. action)'
          } else {
            // Finalize step
            wfChat.data.steps.push({ ...wfChat.currentStep })
            wfChat.step = 'step_more'
            wfSys("Step #" + wfChat.stepCount + " added ✅<br><code>" + wfChat.currentStep.name + "</code> → <code>" + wfChat.currentStep.tool + "</code><br><br>Add another step?", ['Add another step', 'Done adding steps'])
            wfChat.waitingInput = false
          }
          break

        case 'step_arg_key':
          wfChat.argKey = val; wfChat.step = 'step_arg_value'
          wfSys("Value for <strong>" + val + "</strong>:")
          wfChat.inputPlaceholder = 'Arg value'
          break

        case 'step_arg_value':
          wfChat.currentStep.args[wfChat.argKey] = val
          wfChat.step = 'step_arg_more'
          wfSys("Set <code>" + wfChat.argKey + " = " + val + "</code>. Add more args?", ['Add another arg', 'Done with args'])
          wfChat.waitingInput = false
          break

        case 'step_arg_more':
          if(val.startsWith('Add')){
            wfChat.step = 'step_arg_key'
            wfSys("Enter next argument <strong>key</strong>:")
            wfChat.waitingInput = true; wfChat.inputPlaceholder = 'Arg key'
          } else {
            wfChat.data.steps.push({ ...wfChat.currentStep, args: { ...wfChat.currentStep.args } })
            wfChat.step = 'step_more'
            wfSys("Step #" + wfChat.stepCount + " complete ✅<br><code>" + wfChat.currentStep.name + "</code> → <code>" + wfChat.currentStep.tool + "</code> with " + Object.keys(wfChat.currentStep.args).length + " args<br><br>Add another step?", ['Add another step', 'Done adding steps'])
            wfChat.waitingInput = false
          }
          break

        case 'step_more':
          if(val.startsWith('Add')){
            wfChat.stepCount++; wfChat.step = 'step_name'
            wfSys("📍 <strong>Step " + wfChat.stepCount + "</strong> — name?")
            wfChat.waitingInput = true; wfChat.inputPlaceholder = 'Step name'
          } else {
            wfChat.step = 'confirm'; wfChat.waitingInput = false
            const stepsPreview = wfChat.data.steps.map((s,i)=> (i+1) + ". <code>" + s.name + "</code> → " + s.tool).join('<br>')
            wfSys("📄 <strong>Workflow Preview:</strong><br><code>" + wfChat.data.name + "</code> v" + wfChat.data.version + "<br>" + wfChat.data.description + "<br><br><strong>Steps:</strong><br>" + stepsPreview)
            setTimeout(()=>{
              wfChat.messages.push({ from:'system', text:'Create this workflow?', options:['✅ Create', '❌ Cancel'] })
              scrollWfChat()
            }, 600)
          }
          break

        case 'confirm':
          if(val.includes('Create')){
            loading.value = true
            try {
              const d = await api('/api/workflows',{method:'POST',body:JSON.stringify(wfChat.data)})
              if(d.success){ wfSys("🎉 Workflow <strong>" + wfChat.data.name + "</strong> created!<br>Download it from the list below.")
                loadWorkflows()
                setTimeout(()=>{ wfChat.waitingInput=false; wfChat.step='done' }, 500)
              } else { wfSys("❌ Error: " + (d.error||'Unknown')); wfChat.step='done' }
            } catch(e){ wfSys("❌ Failed: " + e.message); wfChat.step='done' }
            finally { loading.value = false }
          } else { wfSys("Cancelled."); wfChat.step = 'done' }
          break
      }
    }

    function downloadWorkflow(name) { window.open('/api/workflows/' + encodeURIComponent(name) + '/download') }

    async function deleteSkill(name) {
      if(!confirm('Delete skill "' + name + '"?')) return
      try {
        const d = await api('/api/skills/' + encodeURIComponent(name), { method: 'DELETE' })
        showToast(d.message || 'Deleted', d.success ? 'success' : 'error')
        loadSkills()
      } catch(e){ showToast('Delete failed','error') }
    }

    async function deleteWorkflow(name) {
      if(!confirm('Delete workflow "' + name + '"?')) return
      try {
        const d = await api('/api/workflows/' + encodeURIComponent(name), { method: 'DELETE' })
        showToast(d.message || 'Deleted', d.success ? 'success' : 'error')
        loadWorkflows()
      } catch(e){ showToast('Delete failed','error') }
    }

    // ── Operations ──
    const opsForm = reactive({ syncTarget:'project', syncOverwrite:false, syncClean:false })
    const syncResult = ref(null)
    const migrateResult = ref(null)
    const compactSummary = ref('')
    const compactResult = ref(null)
    const archivesList = ref(null)

    async function runCompact() {
      loading.value=true; compactResult.value=null
      try {
        compactResult.value = await api('/api/compact',{method:'POST',body:JSON.stringify({summary:compactSummary.value||undefined})})
        showToast(compactResult.value.success ? 'Session compacted' : 'Compaction failed', compactResult.value.success?'success':'error')
        loadStatus()
      } catch(e){showToast('Compaction failed','error')} finally{loading.value=false}
    }
    async function loadArchives() {
      loading.value=true
      try { archivesList.value = await api('/api/archives') }
      catch(e){showToast('Archives load failed','error')} finally{loading.value=false}
    }

    async function runSyncAssets() {
      loading.value=true; syncResult.value=null
      try {
        syncResult.value = await api('/api/sync-assets',{method:'POST',body:JSON.stringify({target:opsForm.syncTarget,overwrite:opsForm.syncOverwrite,clean:opsForm.syncClean})})
        showToast('Sync complete','success')
      } catch(e){showToast('Sync failed','error')} finally{loading.value=false}
    }
    async function runMigrate() {
      loading.value=true; migrateResult.value=null
      try {
        migrateResult.value = await api('/api/migrate',{method:'POST'})
        showToast(migrateResult.value.message||'Done', migrateResult.value.success?'success':'error')
      } catch(e){showToast('Migration failed','error')} finally{loading.value=false}
    }
    async function confirmPurge() {
      if(!confirm('Are you sure? This removes .hivemind/ entirely!')) return
      loading.value=true
      try {
        const d = await api('/api/purge',{method:'POST'})
        showToast(d.message||'Purged', d.success?'success':'error'); loadStatus()
      } catch(e){showToast('Purge failed','error')} finally{loading.value=false}
    }

    // ── Env Config ──
    const envConfig = ref(null)
    async function loadEnvConfig() {
      try { envConfig.value = await api('/api/env-config') }
      catch(e){ showToast('Env config load failed','error') }
    }

    // ── LLM Config ──
    const showApiKey = ref(false)
    const llmTestResult = ref(null)
    const llmForm = reactive({
      api_key: '', base_url: 'https://api.openai.com/v1', model: 'gpt-3.5-turbo', enabled: false
    })
    async function loadLLMConfig() {
      try {
        const d = await api('/api/llm/config')
        llmForm.api_key = d.api_key || ''
        llmForm.base_url = d.base_url || 'https://api.openai.com/v1'
        llmForm.model = d.model || 'gpt-3.5-turbo'
        llmForm.enabled = d.enabled || false
      } catch(e){ /* ignore */ }
    }
    async function saveLLMConfig() {
      loading.value = true; llmTestResult.value = null
      try {
        const d = await api('/api/llm/config', { method: 'PUT', body: JSON.stringify(llmForm) })
        showToast(d.message || 'Saved', d.success ? 'success' : 'error')
      } catch(e){ showToast('Save failed','error') } finally { loading.value = false }
    }
    async function testLLMConnection() {
      loading.value = true; llmTestResult.value = null
      try {
        const d = await api('/api/llm/chat', {
          method: 'POST',
          body: JSON.stringify({ messages: [{ role: 'user', content: 'Hello, respond with just "OK" to confirm the connection works.' }] })
        })
        if(d.success) { llmTestResult.value = { success: true, message: '\\u2705 Connection successful! Response: ' + (d.content || '').slice(0, 100) } }
        else { llmTestResult.value = { success: false, message: '\\u274C ' + (d.error || 'Unknown error') } }
      } catch(e){ llmTestResult.value = { success: false, message: '\\u274C Connection failed: ' + e.message } }
      finally { loading.value = false }
    }

    // ── Lifecycle ──
    watch(currentView, v => {
      if(v==='dashboard') loadStatus()
      if(v==='settings') loadSettings()
      if(v==='skills') loadSkills()
      if(v==='workflows') loadWorkflows()
      if(v==='envconfig') loadEnvConfig()
      if(v==='llmconfig') loadLLMConfig()
    })
    onMounted(()=>{ loadStatus() })

    return {
      currentView, loading, toast, navItems, showToast,
      status, loadStatus,
      initForm, runInit,
      initWizard, initChatBox, toggleInitWizard, answerInitWizard, toggleInitExtra,
      settings, settingsForm, loadSettings, saveSettings,
      scanForm, scanResult, runScan,
      skillsList, skillChat, skillChatBox, startSkillChat, answerSkillChat, downloadSkill, deleteSkill, loadSkills,
      workflowsList, wfChat, wfChatBox, startWorkflowChat, answerWfChat, downloadWorkflow, deleteWorkflow, loadWorkflows,
      opsForm, syncResult, migrateResult, runSyncAssets, runMigrate, confirmPurge,
      compactSummary, compactResult, runCompact, archivesList, loadArchives,
      envConfig, loadEnvConfig,
      llmForm, showApiKey, llmTestResult, loadLLMConfig, saveLLMConfig, testLLMConnection,
    }
  }
}).mount('#app')
<\/script>
</body>
</html>`
