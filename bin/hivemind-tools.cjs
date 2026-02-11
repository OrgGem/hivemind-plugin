#!/usr/bin/env node

/**
 * HiveMind Tools — Centralized CLI utility for ecosystem verification, path tracing,
 * state inspection, validation, and source auditing.
 *
 * Zero dependencies (pure Node.js). Designed for agent consumption (--json for structured output).
 *
 * Usage: node bin/hivemind-tools.js <command> [args] [--json]
 *
 * Path & Install:
 *   trace-paths [dir]               Show all HiveMind paths (hivemind, opencode config, plugin)
 *   verify-install [dir]            Check plugin registration + file integrity
 *   migrate-check [dir]             Detect old structures needing migration
 *
 * Inspection:
 *   inspect brain [dir]             Pretty-print brain state
 *   inspect tree [dir]              Pretty-print hierarchy tree
 *   inspect config [dir]            Pretty-print governance config
 *   inspect sessions [dir]          List sessions with status
 *   inspect detection [dir]         Show detection state (counters, flags)
 *
 * Validation:
 *   validate [dir]                  Schema check all JSON files
 *   ecosystem-check [dir]           Full chain verification (install → init → config → brain → hooks → tools)
 *
 * Source Audit:
 *   source-audit                    Audit src/ files for responsibilities + dead code
 *   filetree [dir]                  Show .hivemind/ tree with responsibilities
 *
 * Options:
 *   --json                          Output structured JSON instead of human-readable
 *   --raw                           Minimal output (values only)
 */

const fs = require('fs');
const path = require('path');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeReadJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function safeReadFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

function exists(p) {
  return fs.existsSync(p);
}

function resolveDir(args) {
  // Find first arg that's not a flag
  for (const arg of args) {
    if (!arg.startsWith('-')) return path.resolve(arg);
  }
  return process.cwd();
}

function hasFlag(args, flag) {
  return args.includes(flag);
}

function printResult(data, args) {
  if (hasFlag(args, '--json')) {
    console.log(JSON.stringify(data, null, 2));
  } else if (typeof data === 'string') {
    console.log(data);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

// ─── Path Resolution ──────────────────────────────────────────────────────────

function getHiveMindPaths(dir) {
  const hivemindDir = path.join(dir, '.hivemind');
  const sessionsDir = path.join(hivemindDir, 'sessions');
  const archiveDir = path.join(sessionsDir, 'archive');
  const templatesDir = path.join(hivemindDir, 'templates');

  // OpenCode config — check both .json and .jsonc
  let opencodeConfigPath = path.join(dir, 'opencode.json');
  let opencodeConfigType = 'json';
  if (!exists(opencodeConfigPath)) {
    const jsoncPath = path.join(dir, 'opencode.jsonc');
    if (exists(jsoncPath)) {
      opencodeConfigPath = jsoncPath;
      opencodeConfigType = 'jsonc';
    }
  }

  // Global opencode config
  const homeDir = require('os').homedir();
  let globalOpencodeConfig = path.join(homeDir, '.config', 'opencode', 'opencode.json');
  let globalConfigType = 'json';
  if (!exists(globalOpencodeConfig)) {
    const gJsonc = path.join(homeDir, '.config', 'opencode', 'opencode.jsonc');
    if (exists(gJsonc)) {
      globalOpencodeConfig = gJsonc;
      globalConfigType = 'jsonc';
    }
  }

  return {
    project: dir,
    hivemind: hivemindDir,
    brain: path.join(hivemindDir, 'brain.json'),
    config: path.join(hivemindDir, 'config.json'),
    hierarchy: path.join(hivemindDir, 'hierarchy.json'),
    manifest: path.join(sessionsDir, 'manifest.json'),
    indexMd: path.join(sessionsDir, 'index.md'),
    activeMd: path.join(sessionsDir, 'active.md'),
    archive: archiveDir,
    templates: templatesDir,
    sessionTemplate: path.join(templatesDir, 'session.md'),
    commandments: path.join(hivemindDir, '10-commandments.md'),
    anchors: path.join(hivemindDir, 'anchors.json'),
    mems: path.join(hivemindDir, 'mems.json'),
    sessions: sessionsDir,
    opencode: { path: opencodeConfigPath, type: opencodeConfigType },
    globalOpencode: { path: globalOpencodeConfig, type: globalConfigType },
  };
}

// ─── Commands ─────────────────────────────────────────────────────────────────

function cmdTracePaths(args) {
  const dir = resolveDir(args);
  const paths = getHiveMindPaths(dir);

  if (hasFlag(args, '--json')) {
    const result = {};
    for (const [key, val] of Object.entries(paths)) {
      if (typeof val === 'string') {
        result[key] = { path: val, exists: exists(val) };
      } else if (val && typeof val === 'object' && val.path) {
        result[key] = { path: val.path, type: val.type, exists: exists(val.path) };
      }
    }
    printResult(result, args);
    return;
  }

  console.log('HiveMind Path Trace');
  console.log('='.repeat(60));
  console.log(`Project: ${dir}`);
  console.log('');

  for (const [key, val] of Object.entries(paths)) {
    if (typeof val === 'string') {
      const status = exists(val) ? '  ✓' : '  ✗';
      const relative = path.relative(dir, val);
      console.log(`${status} ${key}: ${relative}`);
    } else if (val && typeof val === 'object' && val.path) {
      const status = exists(val.path) ? '  ✓' : '  ✗';
      const relative = path.relative(dir, val.path);
      console.log(`${status} ${key}: ${relative} (${val.type})`);
    }
  }
}

function cmdVerifyInstall(args) {
  const dir = resolveDir(args);
  const paths = getHiveMindPaths(dir);
  const issues = [];
  const checks = [];

  // 1. Check .hivemind directory
  if (exists(paths.hivemind)) {
    checks.push({ name: '.hivemind/', status: 'pass' });
  } else {
    issues.push('.hivemind/ directory missing — run `hivemind init`');
    checks.push({ name: '.hivemind/', status: 'fail', issue: 'Missing' });
  }

  // 2. Check core files
  const coreFiles = [
    ['brain.json', paths.brain],
    ['config.json', paths.config],
    ['index.md', paths.indexMd],
    ['active.md', paths.activeMd],
    ['10-commandments.md', paths.commandments],
  ];

  for (const [name, filePath] of coreFiles) {
    if (exists(filePath)) {
      checks.push({ name, status: 'pass' });
    } else {
      issues.push(`${name} missing`);
      checks.push({ name, status: 'fail', issue: 'Missing' });
    }
  }

  // 3. Check opencode.json plugin registration
  const opcConfig = safeReadJSON(paths.opencode.path);
  if (opcConfig) {
    const plugins = Array.isArray(opcConfig.plugin) ? opcConfig.plugin : [];
    const registered = plugins.some(p => p === 'hivemind-context-governance' || (typeof p === 'string' && p.startsWith('hivemind-context-governance')));
    if (registered) {
      checks.push({ name: 'plugin-registered', status: 'pass' });
    } else {
      issues.push('Plugin not registered in opencode config');
      checks.push({ name: 'plugin-registered', status: 'fail', issue: 'Not in plugin array' });
    }
  } else {
    issues.push('No opencode.json found');
    checks.push({ name: 'opencode-config', status: 'fail', issue: 'File missing' });
  }

  // 4. Check archive dir
  if (exists(paths.archive)) {
    checks.push({ name: 'archive/', status: 'pass' });
  } else {
    issues.push('archive/ directory missing');
    checks.push({ name: 'archive/', status: 'fail', issue: 'Missing' });
  }

  // 5. Validate brain.json schema
  const brain = safeReadJSON(paths.brain);
  if (brain) {
    const requiredKeys = ['session', 'hierarchy', 'metrics', 'version'];
    const missing = requiredKeys.filter(k => !(k in brain));
    if (missing.length === 0) {
      checks.push({ name: 'brain-schema', status: 'pass' });
    } else {
      issues.push(`brain.json missing keys: ${missing.join(', ')}`);
      checks.push({ name: 'brain-schema', status: 'fail', issue: `Missing: ${missing.join(', ')}` });
    }
  }

  // 6. Validate config.json schema
  const config = safeReadJSON(paths.config);
  if (config) {
    const requiredKeys = ['governance_mode', 'language', 'max_turns_before_warning'];
    const missing = requiredKeys.filter(k => !(k in config));
    if (missing.length === 0) {
      checks.push({ name: 'config-schema', status: 'pass' });
    } else {
      issues.push(`config.json missing keys: ${missing.join(', ')}`);
      checks.push({ name: 'config-schema', status: 'fail', issue: `Missing: ${missing.join(', ')}` });
    }
  }

  if (hasFlag(args, '--json')) {
    printResult({ checks, issues, healthy: issues.length === 0 }, args);
    return;
  }

  console.log('HiveMind Install Verification');
  console.log('='.repeat(60));
  for (const check of checks) {
    const icon = check.status === 'pass' ? '  ✓' : '  ✗';
    const detail = check.issue ? ` — ${check.issue}` : '';
    console.log(`${icon} ${check.name}${detail}`);
  }
  console.log('');
  if (issues.length === 0) {
    console.log('✅ All checks passed');
  } else {
    console.log(`❌ ${issues.length} issue(s) found`);
    issues.forEach(i => console.log(`  → ${i}`));
  }
}

function cmdMigrateCheck(args) {
  const dir = resolveDir(args);
  const paths = getHiveMindPaths(dir);
  const migrations = [];

  // 1. Old .opencode/planning/ structure
  const oldPlanningDir = path.join(dir, '.opencode', 'planning');
  if (exists(oldPlanningDir)) {
    migrations.push({
      type: 'legacy_planning_dir',
      location: oldPlanningDir,
      action: 'Migrate to .hivemind/ — run hivemind init',
    });
  }

  // 2. Flat hierarchy (no hierarchy.json)
  if (exists(paths.brain) && !exists(paths.hierarchy)) {
    const brain = safeReadJSON(paths.brain);
    if (brain && brain.hierarchy && (brain.hierarchy.trajectory || brain.hierarchy.tactic)) {
      migrations.push({
        type: 'flat_hierarchy',
        location: paths.brain,
        action: 'Run hierarchy_migrate to convert flat brain.hierarchy to tree',
      });
    }
  }

  // 3. No manifest.json (old singleton active.md)
  if (exists(paths.activeMd) && !exists(paths.manifest)) {
    migrations.push({
      type: 'no_manifest',
      location: paths.sessions,
      action: 'Sessions use singleton active.md — manifest.json not yet created',
    });
  }

  // 4. No templates/ dir
  if (exists(paths.hivemind) && !exists(paths.templates)) {
    migrations.push({
      type: 'no_templates',
      location: paths.hivemind,
      action: 'No templates/ directory — will be created on next init',
    });
  }

  // 5. Old opencode.jsonc needs handling
  if (paths.opencode.type === 'jsonc') {
    migrations.push({
      type: 'jsonc_config',
      location: paths.opencode.path,
      action: 'Using opencode.jsonc — ensure plugin registration handles comments',
    });
  }

  if (hasFlag(args, '--json')) {
    printResult({ migrations, count: migrations.length }, args);
    return;
  }

  console.log('Migration Check');
  console.log('='.repeat(60));
  if (migrations.length === 0) {
    console.log('✅ No migrations needed');
  } else {
    for (const m of migrations) {
      console.log(`⚠ ${m.type}`);
      console.log(`  Location: ${m.location}`);
      console.log(`  Action: ${m.action}`);
      console.log('');
    }
  }
}

function cmdInspect(args) {
  const subCmd = args[0];
  const restArgs = args.slice(1);
  const dir = resolveDir(restArgs);
  const paths = getHiveMindPaths(dir);

  switch (subCmd) {
    case 'brain': {
      const brain = safeReadJSON(paths.brain);
      if (!brain) { console.log('ERROR: brain.json not found'); return; }
      if (hasFlag(restArgs, '--json')) { printResult(brain, restArgs); return; }
      console.log('Brain State');
      console.log('='.repeat(60));
      console.log(`Session ID:  ${brain.session?.id ?? '(none)'}`);
      console.log(`Status:      ${brain.session?.governance_status ?? '?'}`);
      console.log(`Mode:        ${brain.session?.mode ?? '?'}`);
      console.log(`Gov. Mode:   ${brain.session?.governance_mode ?? '?'}`);
      console.log(`Start:       ${brain.session?.start_time ? new Date(brain.session.start_time).toISOString() : '?'}`);
      console.log(`Last Active: ${brain.session?.last_activity ? new Date(brain.session.last_activity).toISOString() : '?'}`);
      console.log('');
      console.log('Hierarchy:');
      console.log(`  Trajectory: ${brain.hierarchy?.trajectory || '(not set)'}`);
      console.log(`  Tactic:     ${brain.hierarchy?.tactic || '(not set)'}`);
      console.log(`  Action:     ${brain.hierarchy?.action || '(not set)'}`);
      console.log('');
      console.log('Metrics:');
      console.log(`  Turns:      ${brain.metrics?.turn_count ?? 0}`);
      console.log(`  Drift:      ${brain.metrics?.drift_score ?? 100}/100`);
      console.log(`  Files:      ${(brain.metrics?.files_touched ?? []).length}`);
      console.log(`  Updates:    ${brain.metrics?.context_updates ?? 0}`);
      console.log(`  Violations: ${brain.metrics?.violation_count ?? 0}`);
      console.log(`  Health:     ${brain.metrics?.auto_health_score ?? 100}%`);
      // Detection state (if present)
      if (brain.metrics?.tool_type_counts) {
        const ttc = brain.metrics.tool_type_counts;
        console.log('');
        console.log('Detection:');
        console.log(`  Tool types: R=${ttc.read ?? 0} W=${ttc.write ?? 0} Q=${ttc.query ?? 0} G=${ttc.governance ?? 0}`);
        console.log(`  Failures:   ${brain.metrics?.consecutive_failures ?? 0} consecutive`);
        console.log(`  Repetition: ${brain.metrics?.consecutive_same_section ?? 0} same-section`);
        console.log(`  Keywords:   ${(brain.metrics?.keyword_flags ?? []).join(', ') || '(none)'}`);
      }
      break;
    }

    case 'tree': {
      const tree = safeReadJSON(paths.hierarchy);
      if (!tree) { console.log('No hierarchy.json found (flat mode)'); return; }
      if (hasFlag(restArgs, '--json')) { printResult(tree, restArgs); return; }
      console.log('Hierarchy Tree');
      console.log('='.repeat(60));
      console.log(`Version: ${tree.version ?? '?'}`);
      console.log(`Cursor:  ${tree.cursor ?? '(none)'}`);
      console.log('');
      if (tree.root) {
        printTreeNode(tree.root, '', true, true, tree.cursor);
      } else {
        console.log('(empty tree)');
      }
      break;
    }

    case 'config': {
      const config = safeReadJSON(paths.config);
      if (!config) { console.log('ERROR: config.json not found'); return; }
      if (hasFlag(restArgs, '--json')) { printResult(config, restArgs); return; }
      console.log('HiveMind Config');
      console.log('='.repeat(60));
      console.log(`Governance:  ${config.governance_mode}`);
      console.log(`Language:    ${config.language}`);
      console.log(`Max Turns:   ${config.max_turns_before_warning}`);
      console.log(`Max Lines:   ${config.max_active_md_lines}`);
      console.log(`Auto-compact:${config.auto_compact_on_turns} turns`);
      console.log(`Stale days:  ${config.stale_session_days}`);
      console.log(`Commit threshold: ${config.commit_suggestion_threshold}`);
      if (config.agent_behavior) {
        const ab = config.agent_behavior;
        console.log('');
        console.log('Agent Behavior:');
        console.log(`  Expert:    ${ab.expert_level}`);
        console.log(`  Style:     ${ab.output_style}`);
        console.log(`  TDD:       ${ab.constraints?.enforce_tdd ? 'yes' : 'no'}`);
        console.log(`  Review:    ${ab.constraints?.require_code_review ? 'yes' : 'no'}`);
        console.log(`  Skeptical: ${ab.constraints?.be_skeptical ? 'yes' : 'no'}`);
      }
      break;
    }

    case 'sessions': {
      if (hasFlag(restArgs, '--json')) {
        const manifest = safeReadJSON(paths.manifest);
        const archives = exists(paths.archive) ? fs.readdirSync(paths.archive).filter(f => f.endsWith('.md')) : [];
        printResult({ manifest, archiveCount: archives.length, archives: archives.slice(0, 20) }, restArgs);
        return;
      }
      console.log('Sessions');
      console.log('='.repeat(60));
      // Manifest
      const manifest = safeReadJSON(paths.manifest);
      if (manifest) {
        console.log(`Active stamp: ${manifest.active_stamp || '(none)'}`);
        console.log(`Sessions: ${(manifest.sessions || []).length}`);
        for (const s of (manifest.sessions || [])) {
          console.log(`  ${s.stamp} → ${s.status} (${s.file})`);
        }
      } else {
        console.log('No manifest.json (using legacy singleton active.md)');
      }
      // Archives
      if (exists(paths.archive)) {
        const archives = fs.readdirSync(paths.archive).filter(f => f.endsWith('.md'));
        console.log(`\nArchives: ${archives.length}`);
        for (const a of archives.slice(0, 10)) {
          console.log(`  ${a}`);
        }
        if (archives.length > 10) console.log(`  ... and ${archives.length - 10} more`);
      }
      break;
    }

    case 'detection': {
      const brain = safeReadJSON(paths.brain);
      if (!brain) { console.log('ERROR: brain.json not found'); return; }
      const det = {
        consecutive_failures: brain.metrics?.consecutive_failures ?? 0,
        consecutive_same_section: brain.metrics?.consecutive_same_section ?? 0,
        last_section_content: brain.metrics?.last_section_content ?? '',
        tool_type_counts: brain.metrics?.tool_type_counts ?? { read: 0, write: 0, query: 0, governance: 0 },
        keyword_flags: brain.metrics?.keyword_flags ?? [],
      };
      if (hasFlag(restArgs, '--json')) { printResult(det, restArgs); return; }
      console.log('Detection State');
      console.log('='.repeat(60));
      console.log(`Failures:    ${det.consecutive_failures} consecutive`);
      console.log(`Repetition:  ${det.consecutive_same_section} same-section`);
      console.log(`Last content:${det.last_section_content ? ` "${det.last_section_content.slice(0, 60)}"` : ' (none)'}`);
      const ttc = det.tool_type_counts;
      console.log(`Tool types:  R=${ttc.read} W=${ttc.write} Q=${ttc.query} G=${ttc.governance}`);
      console.log(`Keywords:    ${det.keyword_flags.length > 0 ? det.keyword_flags.join(', ') : '(none)'}`);
      break;
    }

    default:
      console.log(`Unknown inspect command: ${subCmd}`);
      console.log('Valid: brain, tree, config, sessions, detection');
  }
}

function printTreeNode(node, prefix, isLast, isRoot, cursor) {
  const connector = isRoot ? '' : isLast ? '\\-- ' : '|-- ';
  const markers = { pending: '..', active: '>>', complete: 'OK', blocked: '!!' };
  const marker = markers[node.status] || '??';
  const cursorMark = cursor === node.id ? ' <-- cursor' : '';
  const level = (node.level || '').charAt(0).toUpperCase() + (node.level || '').slice(1);
  const content = (node.content || '').length > 55
    ? node.content.slice(0, 52) + '...'
    : node.content || '';
  console.log(`${prefix}${connector}[${marker}] ${level}: ${content} (${node.stamp || '?'})${cursorMark}`);

  const childPrefix = isRoot ? '' : prefix + (isLast ? '    ' : '|   ');
  const children = node.children || [];
  for (let i = 0; i < children.length; i++) {
    printTreeNode(children[i], childPrefix, i === children.length - 1, false, cursor);
  }
}

function cmdValidate(args) {
  const dir = resolveDir(args);
  const paths = getHiveMindPaths(dir);
  const results = [];

  // Validate each JSON file
  const jsonFiles = [
    ['brain.json', paths.brain, ['session', 'hierarchy', 'metrics', 'version']],
    ['config.json', paths.config, ['governance_mode', 'language']],
    ['hierarchy.json', paths.hierarchy, ['version', 'root', 'cursor']],
    ['manifest.json', paths.manifest, ['sessions']],
    ['anchors.json', paths.anchors, ['anchors']],
    ['mems.json', paths.mems, ['mems']],
  ];

  for (const [name, filePath, requiredKeys] of jsonFiles) {
    if (!exists(filePath)) {
      results.push({ file: name, status: 'missing', issues: [] });
      continue;
    }
    const data = safeReadJSON(filePath);
    if (!data) {
      results.push({ file: name, status: 'invalid_json', issues: ['Failed to parse'] });
      continue;
    }
    const missing = requiredKeys.filter(k => !(k in data));
    if (missing.length > 0) {
      results.push({ file: name, status: 'incomplete', issues: missing.map(k => `Missing key: ${k}`) });
    } else {
      results.push({ file: name, status: 'valid', issues: [] });
    }
  }

  if (hasFlag(args, '--json')) {
    printResult({ results, valid: results.every(r => r.status === 'valid' || r.status === 'missing') }, args);
    return;
  }

  console.log('JSON Validation');
  console.log('='.repeat(60));
  for (const r of results) {
    const icon = r.status === 'valid' ? '✓' : r.status === 'missing' ? '○' : '✗';
    console.log(`  ${icon} ${r.file}: ${r.status}`);
    r.issues.forEach(i => console.log(`    → ${i}`));
  }
}

function cmdEcosystemCheck(args) {
  const dir = resolveDir(args);
  const paths = getHiveMindPaths(dir);
  const chain = [];
  let healthy = true;

  // 1. INSTALL: Plugin file exists on disk
  const pkgJson = safeReadJSON(path.join(dir, 'node_modules', 'hivemind-context-governance', 'package.json'));
  if (pkgJson) {
    chain.push({ step: 'install', status: 'pass', detail: `v${pkgJson.version}` });
  } else {
    // Check if running from source (we're IN the plugin project)
    const localPkg = safeReadJSON(path.join(dir, 'package.json'));
    if (localPkg && localPkg.name === 'hivemind-context-governance') {
      chain.push({ step: 'install', status: 'pass', detail: `source (v${localPkg.version})` });
    } else {
      chain.push({ step: 'install', status: 'warn', detail: 'Not in node_modules (may be source project)' });
    }
  }

  // 2. INIT: .hivemind/ exists with core files
  const coreFiles = [paths.brain, paths.config, paths.indexMd, paths.activeMd, paths.commandments];
  const existingCore = coreFiles.filter(f => exists(f));
  if (existingCore.length === coreFiles.length) {
    chain.push({ step: 'init', status: 'pass', detail: `${existingCore.length}/${coreFiles.length} files` });
  } else {
    chain.push({ step: 'init', status: 'fail', detail: `${existingCore.length}/${coreFiles.length} files` });
    healthy = false;
  }

  // 3. CONFIG: Valid config.json
  const config = safeReadJSON(paths.config);
  if (config && config.governance_mode && config.language) {
    chain.push({ step: 'config', status: 'pass', detail: `${config.governance_mode}/${config.language}` });
  } else {
    chain.push({ step: 'config', status: 'fail', detail: 'Invalid or missing config' });
    healthy = false;
  }

  // 4. BRAIN: Valid brain.json with session
  const brain = safeReadJSON(paths.brain);
  if (brain && brain.session && brain.hierarchy && brain.metrics) {
    chain.push({ step: 'brain', status: 'pass', detail: `${brain.session.governance_status}/${brain.session.mode}` });
  } else {
    chain.push({ step: 'brain', status: 'fail', detail: 'Invalid or missing brain state' });
    healthy = false;
  }

  // 5. HIERARCHY: tree vs flat
  if (exists(paths.hierarchy)) {
    const tree = safeReadJSON(paths.hierarchy);
    if (tree && 'root' in tree) {
      chain.push({ step: 'hierarchy', status: 'pass', detail: `tree (root: ${tree.root ? 'set' : 'empty'})` });
    } else {
      chain.push({ step: 'hierarchy', status: 'warn', detail: 'Invalid hierarchy.json' });
    }
  } else if (brain && (brain.hierarchy.trajectory || brain.hierarchy.tactic)) {
    chain.push({ step: 'hierarchy', status: 'warn', detail: 'Flat mode (no hierarchy.json)' });
  } else {
    chain.push({ step: 'hierarchy', status: 'pass', detail: 'Empty (fresh session)' });
  }

  // 6. PLUGIN REGISTRATION
  const opc = safeReadJSON(paths.opencode.path);
  if (opc) {
    const plugins = Array.isArray(opc.plugin) ? opc.plugin : [];
    const registered = plugins.some(p => typeof p === 'string' && p.includes('hivemind'));
    chain.push({ step: 'plugin-reg', status: registered ? 'pass' : 'fail', detail: registered ? 'Registered' : 'Not in plugin array' });
    if (!registered) healthy = false;
  } else {
    chain.push({ step: 'plugin-reg', status: 'fail', detail: 'No opencode config found' });
    healthy = false;
  }

  // 7. HOOKS: Check src/hooks/ exist
  const hooksDir = path.join(dir, 'src', 'hooks');
  const hookFiles = ['tool-gate.ts', 'soft-governance.ts', 'session-lifecycle.ts', 'compaction.ts'];
  if (exists(hooksDir)) {
    const existing = hookFiles.filter(h => exists(path.join(hooksDir, h)));
    chain.push({ step: 'hooks', status: existing.length === hookFiles.length ? 'pass' : 'warn', detail: `${existing.length}/${hookFiles.length}` });
  } else {
    chain.push({ step: 'hooks', status: 'warn', detail: 'No src/hooks/ (may be installed package)' });
  }

  // 8. TOOLS: Count registered tools
  const indexTs = safeReadFile(path.join(dir, 'src', 'index.ts'));
  if (indexTs) {
    const toolMatches = indexTs.match(/tool:\s*{/g);
    const toolEntries = indexTs.match(/\w+:\s*create\w+Tool/g);
    chain.push({ step: 'tools', status: 'pass', detail: `${toolEntries ? toolEntries.length : '?'} tools registered` });
  } else {
    chain.push({ step: 'tools', status: 'warn', detail: 'No src/index.ts (may be installed package)' });
  }

  if (hasFlag(args, '--json')) {
    printResult({ chain, healthy }, args);
    return;
  }

  console.log('Ecosystem Health Check');
  console.log('='.repeat(60));
  for (const step of chain) {
    const icon = step.status === 'pass' ? '✓' : step.status === 'warn' ? '⚠' : '✗';
    console.log(`  ${icon} ${step.step}: ${step.detail}`);
  }
  console.log('');
  console.log(healthy ? '✅ Ecosystem healthy' : '❌ Issues found — see above');
}

function cmdSourceAudit(args) {
  const dir = resolveDir(args.length > 0 && !args[0].startsWith('-') ? args : []);
  const srcDir = path.join(dir, 'src');
  if (!exists(srcDir)) {
    console.log('ERROR: src/ not found');
    return;
  }

  // Map of every src file to its responsibility
  const responsibilities = {
    // Tools
    'tools/declare-intent.ts': { group: 'tool', role: 'Start session, create tree root, set trajectory' },
    'tools/map-context.ts': { group: 'tool', role: 'Update hierarchy level, append tree node, project to brain' },
    'tools/compact-session.ts': { group: 'tool', role: 'Archive session, reset tree, auto-export, auto-mem' },
    'tools/scan-hierarchy.ts': { group: 'tool', role: 'Quick snapshot: tree + metrics + anchors + mems' },
    'tools/think-back.ts': { group: 'tool', role: 'Deep refocus: tree + cursor path + gaps + anchors + plan' },
    'tools/check-drift.ts': { group: 'tool', role: 'Drift report: score + chain integrity' },
    'tools/self-rate.ts': { group: 'tool', role: 'Agent self-assessment (1-10 score)' },
    'tools/save-anchor.ts': { group: 'tool', role: 'Persist immutable key-value across sessions' },
    'tools/save-mem.ts': { group: 'tool', role: 'Save memory to shelf' },
    'tools/list-shelves.ts': { group: 'tool', role: 'Show mem shelf overview' },
    'tools/recall-mems.ts': { group: 'tool', role: 'Search memories by query + shelf' },
    'tools/hierarchy.ts': { group: 'tool', role: 'Prune completed branches + migrate flat→tree' },
    'tools/index.ts': { group: 'barrel', role: 'Tool factory exports' },
    // Hooks
    'hooks/tool-gate.ts': { group: 'hook', role: 'tool.execute.before — governance enforcement (warn, not block)' },
    'hooks/soft-governance.ts': { group: 'hook', role: 'tool.execute.after — turn tracking, drift, violations, detection counters' },
    'hooks/session-lifecycle.ts': { group: 'hook', role: 'system.transform — <hivemind> prompt injection, stale archive' },
    'hooks/compaction.ts': { group: 'hook', role: 'session.compacting — hierarchy context preservation' },
    'hooks/index.ts': { group: 'barrel', role: 'Hook factory exports' },
    // Lib
    'lib/hierarchy-tree.ts': { group: 'engine', role: 'Tree CRUD, stamps, queries, staleness, rendering, janitor, I/O, migration' },
    'lib/detection.ts': { group: 'engine', role: 'Tool classification, counters, keyword scanning, signal compilation' },
    'lib/planning-fs.ts': { group: 'engine', role: 'Session files, template, manifest, archive, FileGuard' },
    'lib/persistence.ts': { group: 'engine', role: 'Brain state I/O, config I/O' },
    'lib/chain-analysis.ts': { group: 'engine', role: 'Hierarchy chain break detection (flat brain.json)' },
    'lib/anchors.ts': { group: 'engine', role: 'Anchor CRUD and prompt formatting' },
    'lib/mems.ts': { group: 'engine', role: 'Mems CRUD, search, shelf summary' },
    'lib/session-export.ts': { group: 'engine', role: 'JSON + markdown export on compaction' },
    'lib/staleness.ts': { group: 'engine', role: 'Session stale detection (days idle)' },
    'lib/long-session.ts': { group: 'engine', role: 'Turn threshold for compact suggestion' },
    'lib/commit-advisor.ts': { group: 'engine', role: 'Files touched → commit suggestion' },
    'lib/complexity.ts': { group: 'engine', role: 'Session complexity assessment' },
    'lib/tool-activation.ts': { group: 'engine', role: 'Suggest which tool to use based on state' },
    'lib/sentiment.ts': { group: 'engine', role: 'User sentiment regex for rage/frustration detection' },
    'lib/logging.ts': { group: 'engine', role: 'Logger interface' },
    'lib/index.ts': { group: 'barrel', role: 'Lib barrel exports' },
    // Schemas
    'schemas/brain-state.ts': { group: 'schema', role: 'BrainState, MetricsState, session ops, hierarchy ops' },
    'schemas/hierarchy.ts': { group: 'schema', role: 'HierarchyLevel, ContextStatus types' },
    'schemas/config.ts': { group: 'schema', role: 'HiveMindConfig, AgentBehavior, prompt generation' },
    'schemas/index.ts': { group: 'barrel', role: 'Schema barrel exports' },
    // CLI
    'cli/init.ts': { group: 'cli', role: 'hivemind init — create .hivemind/, register plugin' },
    'cli.ts': { group: 'cli', role: 'CLI entry point (init, status, help)' },
    // Entry
    'index.ts': { group: 'entry', role: 'Plugin entry — register all tools + hooks' },
    // Dashboard
    'dashboard/server.ts': { group: 'dashboard', role: 'Optional dashboard server (unused?)' },
  };

  // Walk src/ and check against map
  const allFiles = walkSync(srcDir, f => f.endsWith('.ts'));
  const srcRelative = allFiles.map(f => path.relative(srcDir, f));
  const mapped = [];
  const unmapped = [];
  const missingOnDisk = [];

  for (const relPath of srcRelative) {
    const normalizedPath = relPath.replace(/\\/g, '/');
    if (responsibilities[normalizedPath]) {
      mapped.push({ file: normalizedPath, ...responsibilities[normalizedPath] });
    } else {
      unmapped.push(normalizedPath);
    }
  }

  // Check for entries in map that don't exist on disk
  for (const relPath of Object.keys(responsibilities)) {
    const normalizedPaths = srcRelative.map(p => p.replace(/\\/g, '/'));
    if (!normalizedPaths.includes(relPath)) {
      missingOnDisk.push({ file: relPath, ...responsibilities[relPath] });
    }
  }

  if (hasFlag(args, '--json')) {
    printResult({ mapped, unmapped, missingOnDisk }, args);
    return;
  }

  console.log('Source Audit');
  console.log('='.repeat(60));

  // Group by group
  const groups = {};
  for (const item of mapped) {
    if (!groups[item.group]) groups[item.group] = [];
    groups[item.group].push(item);
  }

  for (const [group, items] of Object.entries(groups)) {
    console.log(`\n[${group.toUpperCase()}]`);
    for (const item of items) {
      console.log(`  ✓ ${item.file}`);
      console.log(`    ${item.role}`);
    }
  }

  if (unmapped.length > 0) {
    console.log('\n[UNMAPPED — no responsibility assigned]');
    for (const f of unmapped) {
      console.log(`  ? ${f}`);
    }
  }

  if (missingOnDisk.length > 0) {
    console.log('\n[EXPECTED BUT MISSING on disk]');
    for (const item of missingOnDisk) {
      console.log(`  ✗ ${item.file} — ${item.role}`);
    }
  }

  console.log(`\n${mapped.length} mapped | ${unmapped.length} unmapped | ${missingOnDisk.length} missing`);
}

function cmdFiletree(args) {
  const dir = resolveDir(args);
  const paths = getHiveMindPaths(dir);

  if (!exists(paths.hivemind)) {
    console.log('ERROR: .hivemind/ not found');
    return;
  }

  const files = walkSync(paths.hivemind, () => true);
  const relative = files.map(f => path.relative(paths.hivemind, f));

  if (hasFlag(args, '--json')) {
    printResult({ root: paths.hivemind, files: relative }, args);
    return;
  }

  console.log(`.hivemind/ (${files.length} files)`);
  console.log('='.repeat(60));
  for (const f of relative.sort()) {
    console.log(`  ${f}`);
  }
}

function walkSync(dir, filter) {
  const results = [];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      if (entry.isDirectory()) results.push(...walkSync(full, filter));
      else if (filter(full)) results.push(full);
    }
  } catch {
    // permission denied or other
  }
  return results;
}

// ─── Main Dispatch ────────────────────────────────────────────────────────────

const HELP = `
HiveMind Tools — Ecosystem verification & inspection CLI

Usage: node bin/hivemind-tools.js <command> [args] [--json]

Commands:
  trace-paths [dir]           Show all HiveMind paths
  verify-install [dir]        Check plugin registration + integrity
  migrate-check [dir]         Detect old structures needing migration
  inspect <sub> [dir]         Inspect state (brain|tree|config|sessions|detection)
  validate [dir]              Schema check all JSON files
  ecosystem-check [dir]       Full chain verification
  source-audit [dir]          Audit src/ for responsibilities
  filetree [dir]              Show .hivemind/ file tree
  help                        This message

Options:
  --json                      Structured JSON output
  --raw                       Minimal output
`;

const [cmd, ...args] = process.argv.slice(2);

switch (cmd) {
  case 'trace-paths':      cmdTracePaths(args); break;
  case 'verify-install':   cmdVerifyInstall(args); break;
  case 'migrate-check':    cmdMigrateCheck(args); break;
  case 'inspect':          cmdInspect(args); break;
  case 'validate':         cmdValidate(args); break;
  case 'ecosystem-check':  cmdEcosystemCheck(args); break;
  case 'source-audit':     cmdSourceAudit(args); break;
  case 'filetree':         cmdFiletree(args); break;
  case 'help': default:    console.log(HELP); break;
}
