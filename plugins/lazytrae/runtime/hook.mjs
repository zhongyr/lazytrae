#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pluginRoot, runtimeEnv } from './environment.mjs';

let raw = '';
for await (const chunk of process.stdin) raw += chunk;
let payload;
try { payload = JSON.parse(raw); } catch { process.stdout.write('{}\n'); process.exit(0); }
if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
  process.stdout.write('{}\n'); process.exit(0);
}
const event = payload.hook_event_name;
const context = text => ({ hookSpecificOutput: { hookEventName: event, additionalContext: text } });
const session = typeof payload.session_id === 'string' ? payload.session_id : '';
const cwd = typeof payload.cwd === 'string' && existsSync(payload.cwd) ? payload.cwd : null;
const cli = join(pluginRoot, 'runtime/cli.mjs');
const command = `node ${JSON.stringify(cli)}`;
const mode = process.argv[2] || 'workflow';
const pauseRoot = join(runtimeEnv().PLUGIN_DATA, 'paused');
const pauseFile = join(pauseRoot, createHash('sha256').update(`${cwd}\0${session}`).digest('hex'));
const isCancellation = event === 'Interrupt' || (event === 'UserPromptSubmit' && typeof payload.prompt === 'string' && /^(?:\s*)(?:stop|pause|cancel|abort|停止|暂停|取消)(?:\b|\s|[.!。！]|$)/i.test(payload.prompt));
let output = {};
if (mode === 'workflow' && isCancellation && session && cwd) {
  mkdirSync(pauseRoot, { recursive: true });
  writeFileSync(pauseFile, 'paused\n');
} else if (mode !== 'workflow') {
  const components = { rules: 'rules', comments: 'comment-checker', lsp: 'lsp' };
  const component = components[mode];
  const events = { SessionStart: 'session-start', UserPromptSubmit: 'user-prompt-submit', PostToolUse: 'post-tool-use', PostCompact: 'post-compact' };
  if (component && events[event] && cwd) {
    const normalized = { ...payload, tool_name: payload.tool_name === 'Bash' ? 'exec_command' : payload.tool_name };
    for (const field of ['model', 'permission_mode', 'turn_id', 'tool_use_id']) {
      if (typeof normalized[field] !== 'string') normalized[field] = '';
    }
    if (typeof normalized.transcript_path !== 'string') normalized.transcript_path = null;
    if (typeof normalized.source !== 'string') normalized.source = 'startup';
    if (!['manual', 'auto'].includes(normalized.trigger)) normalized.trigger = 'auto';
    if (normalized.tool_input?.command && !normalized.tool_input.cmd) normalized.tool_input = { ...normalized.tool_input, cmd: normalized.tool_input.command };
    const child = spawnSync(process.execPath, [join(pluginRoot, 'components', component, 'dist/cli.js'), 'hook', events[event]],
      { input: JSON.stringify(normalized), cwd, env: runtimeEnv(), encoding: 'utf8', timeout: 15000, maxBuffer: 1024 * 1024 });
    if (child.error || child.status !== 0) {
      output = { systemMessage: `LazyTrae ${mode} hook did not complete; run the relevant check explicitly.` };
    } else if (child.stdout.trim()) {
      try { output = JSON.parse(child.stdout); }
      catch { output = context(child.stdout.trim()); }
    }
  }
} else if (event === 'SessionStart') {
  output = context(`LazyTrae is available. Explicit ulw requests use the lazytrae:ultrawork skill. Runtime: ${command}. Session scope: ${JSON.stringify(session)}. Read ${join(pluginRoot, 'HOST.md')} for TRAE conventions. Ordinary tasks do not start a loop.`);
} else if (event === 'UserPromptSubmit' && typeof payload.prompt === 'string' && /^(?:\s*)(?:\$|\/)?(?:lazytrae:)?(?:ulw|ultrawork|ulw-loop)(?=\s|:|$)/i.test(payload.prompt)) {
  if (session && cwd) rmSync(pauseFile, { force: true });
  output = context(`The user requested ultrawork. Read ${join(pluginRoot, 'skills/ultrawork/SKILL.md')}. Use --session-id ${JSON.stringify(session)} for this run. Preserve the user's scope, budget and cancellation. Do not create a host goal unless explicitly requested.`);
} else if (['Stop', 'PostCompact'].includes(event) && session && cwd) {
  const child = spawnSync(process.execPath, [cli, 'ulw-loop', 'status', '--session-id', session, '--json'],
    { cwd, env: runtimeEnv(), encoding: 'utf8', timeout: 5000, maxBuffer: 1024 * 1024 });
  if (child.status === 0) {
    let status;
    try { status = JSON.parse(child.stdout); } catch { /* malformed state: no continuation */ }
    const goals = status?.plan?.goals;
    const unfinished = goals?.some(goal => ['pending', 'active', 'in_progress'].includes(goal.status));
    const reason = `LazyTrae has unfinished ledger work. Read the brief and ledger, then ${command} ulw-loop status --session-id ${JSON.stringify(session)} --json. Respect user pauses, cancellation and host goal limits; report a blocker instead of inventing evidence.`;
    if (unfinished && event === 'PostCompact') output = context(reason);
    // Opt-in only: the native host goal already handles persistence. Never fight
    // an interrupt or repeatedly block the host's stopping lifecycle.
    if (unfinished && event === 'Stop' && process.env.LAZYTRAE_CONTINUE === '1' && payload.stop_hook_active === false && !existsSync(pauseFile)) output = { decision: 'block', reason };
  }
}
process.stdout.write(JSON.stringify(output) + '\n');
