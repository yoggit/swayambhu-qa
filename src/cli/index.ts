#!/usr/bin/env node
/**
 * swayambhu-qa CLI
 *
 * Usage:
 *   npx @swayambhu-qa/core init        — adds MCP server to .claude/settings.json
 *   npx @swayambhu-qa/core --mcp       — starts the MCP server (called by Claude Code)
 */

import * as fs from 'fs';
import * as path from 'path';

const args = process.argv.slice(2);

if (args[0] === '--mcp') {
  // Hand off to the MCP server entry point
  require('../mcp/index');
} else if (args[0] === 'init') {
  init(args.includes('--auto-approve'));
} else {
  console.log('swayambhu-qa');
  console.log('');
  console.log('Commands:');
  console.log('  init     Add swayambhu-qa MCP server to .claude/settings.json');
  console.log('');
  console.log('Usage:');
  console.log('  npx @swayambhu-qa/core init');
}

// ─── init ─────────────────────────────────────────────────────────────────────

function init(autoApprove = false) {
  const settingsPath = path.join(process.cwd(), '.claude', 'settings.json');
  const envExampleSrc = path.join(__dirname, '../.env.example');
  const envExampleDst = path.join(process.cwd(), '.env.example');

  // ── 1. Add MCP server entry to .claude/settings.json ──────────────────────
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });

  let settings: Record<string, any> = {};
  if (fs.existsSync(settingsPath)) {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
  }

  settings.mcpServers = settings.mcpServers || {};

  if (settings.mcpServers['swayambhu-qa']) {
    console.log('✓ swayambhu-qa MCP server already configured in .claude/settings.json');
  } else {
    settings.mcpServers['swayambhu-qa'] = {
      command: 'npx',
      args: ['@swayambhu-qa/core', '--mcp'],
    };
    console.log('✓ Added swayambhu-qa MCP server to .claude/settings.json');
  }

  if (autoApprove) {
    settings.permissions = settings.permissions || {};
    const allow: string[] = settings.permissions.allow || [];
    const needed = ['Bash(*)', 'Read(*)', 'Write(*)', 'Edit(*)'];
    for (const rule of needed) {
      if (!allow.includes(rule)) allow.push(rule);
    }
    settings.permissions.allow = allow;
    console.log('✓ Auto-approve enabled — pipeline tools will run without per-step prompts');
  }

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

  // ── 2. Copy .env.example if not already present ────────────────────────────
  if (fs.existsSync(envExampleDst)) {
    console.log('✓ .env.example already exists — skipped');
  } else if (fs.existsSync(envExampleSrc)) {
    fs.copyFileSync(envExampleSrc, envExampleDst);
    console.log('✓ Created .env.example — fill in your credentials');
  }

  // ── 3. Write 1-line shims to .claude/commands/ ───────────────────────────
  // Shims delegate to the real command files inside node_modules so agent
  // logic stays in the package and auto-updates with npm.
  const commandsSrc = path.join(__dirname, '../commands');
  const commandsDst = path.join(process.cwd(), '.claude', 'commands');

  if (fs.existsSync(commandsSrc)) {
    fs.mkdirSync(commandsDst, { recursive: true });
    for (const file of fs.readdirSync(commandsSrc)) {
      if (!file.endsWith('.md')) continue;
      const dst = path.join(commandsDst, file);
      const rel = `node_modules/@swayambhu-qa/core/commands/${file}`;
      fs.writeFileSync(dst, `Read and follow ${rel} and execute it with these arguments: $ARGUMENTS\n`);
    }
    console.log('✓ Created slash command shims in .claude/commands/');
  }

  console.log('');
  console.log('Setup complete. Next steps:');
  console.log('  1. Copy .env.example to .env and fill in your credentials');
  console.log('  2. Open this project in Claude Code');
  console.log('  3. Run: /qa-pipeline --issue TEST-22 --source jira --tool playwright --tms xray');
  if (!autoApprove) {
    console.log('');
    console.log('Tip: To skip per-step approval prompts, re-run with:');
    console.log('  npx @swayambhu-qa/core init --auto-approve');
  }
}
