// Boundary contracts: host payloads, isolation, evidence gates and real MCP
// transport. Upstream tests do not cover this adapter; no production test seams.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cli = join(root, 'plugins/lazytrae/runtime/cli.mjs');
const hook = join(root, 'plugins/lazytrae/runtime/hook.mjs');
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'lazytrae-test-'));
  const cwd = join(dir, 'project with spaces');
  mkdirSync(cwd);
  const env = { ...process.env, TRAE_HOME: join(dir, 'trae'), TRAECLI_HOME: join(dir, 'trae/cli'), PLUGIN_DATA: join(dir, 'data') };
  for (const key of ['OMO_ULW_LOOP_SESSION_ID', 'TRAE_SESSION_ID', 'TRAE_THREAD_ID', 'PI_SESSION_ID', 'LAZYTRAE_CONTINUE']) delete env[key];
  const cleanup = [];
  t.after(async () => { for (const close of cleanup.reverse()) await close(); rmSync(dir, { recursive: true, force: true }); });
  const run = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd, env, encoding: 'utf8', timeout: 10000 });
  const loop = (...args) => {
    const result = run('ulw-loop', ...args, '--session-id', 'session-a', '--json');
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return JSON.parse(result.stdout);
  };
  const emit = (payload, extra = {}) => {
    const result = spawnSync(process.execPath, [hook], { cwd, env: { ...env, ...extra }, input: JSON.stringify({ cwd, session_id: 'session-a', ...payload }), encoding: 'utf8', timeout: 10000 });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };
  return { dir, cwd, env, run, loop, emit, cleanup };
}

test('ledger refuses unscoped state and keeps simultaneous sessions separate', t => {
  const { run, loop } = fixture(t);
  const missing = run('ulw-loop', 'status', '--json');
  assert.equal(missing.status, 1);
  assert.match(missing.stdout, /ULW_LOOP_SESSION_SCOPE_REQUIRED/);
  loop('create-goals', '--brief', 'First session deliverable');
  const other = run('ulw-loop', 'create-goals', '--brief', 'Second session deliverable', '--session-id', 'session-b', '--json');
  assert.equal(other.status, 0, other.stderr);
  assert.equal(loop('status').plan.brief.trim(), 'First session deliverable');
  assert.equal(JSON.parse(other.stdout).plan.brief.trim(), 'Second session deliverable');
});

test('TRAE hook protocol preserves normal tasks, budgets, cancellation and bounded continuation', t => {
  const { emit, loop } = fixture(t);
  assert.deepEqual(emit({ hook_event_name: 'UserPromptSubmit', prompt: 'What does ulw mean?' }), {});
  assert.deepEqual(emit({ hook_event_name: 'PreToolUse', tool_name: 'create_goal', tool_input: { objective: 'work', token_budget: 500 } }), {});
  const triggered = emit({ hook_event_name: 'UserPromptSubmit', prompt: 'ulw: fix the greeting' });
  assert.equal(triggered.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
  assert.match(triggered.hookSpecificOutput.additionalContext, /session-a/);
  loop('create-goals', '--brief', 'Fix the greeting');
  loop('complete-goals');
  assert.deepEqual(emit({ hook_event_name: 'Stop', stop_hook_active: false }), {});
  const optIn = { LAZYTRAE_CONTINUE: '1' };
  assert.equal(emit({ hook_event_name: 'Stop', stop_hook_active: false }, optIn).decision, 'block');
  assert.deepEqual(emit({ hook_event_name: 'Stop', stop_hook_active: true }, optIn), {});
  assert.deepEqual(emit({ hook_event_name: 'Interrupt' }, optIn), {});
  assert.deepEqual(emit({ hook_event_name: 'Stop', stop_hook_active: false }, optIn), {});
  emit({ hook_event_name: 'UserPromptSubmit', prompt: 'ulw: resume the greeting' });
  assert.equal(emit({ hook_event_name: 'Stop', stop_hook_active: false }, optIn).decision, 'block');
  emit({ hook_event_name: 'UserPromptSubmit', prompt: 'cancel this task' });
  assert.deepEqual(emit({ hook_event_name: 'Stop', stop_hook_active: false }, optIn), {});
  assert.match(emit({ hook_event_name: 'PostCompact' }).hookSpecificOutput.additionalContext, /unfinished ledger/);
});

test('project rules hook loads TRAE rules and deduplicates them per session', t => {
  const { cwd, env } = fixture(t);
  mkdirSync(join(cwd, '.trae/rules'), { recursive: true });
  writeFileSync(join(cwd, 'package.json'), '{"name":"rule-fixture"}');
  writeFileSync(join(cwd, '.trae/rules/contract.md'), '---\nalwaysApply: true\n---\nPreserve the public greeting CLI contract.\n');
  const payload = { hook_event_name: 'SessionStart', session_id: 'rules-fixture', cwd, model: null };
  const invoke = () => {
    const result = spawnSync(process.execPath, [hook, 'rules'], { cwd, env, input: JSON.stringify(payload), encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };
  const first = invoke();
  assert.match(first.hookSpecificOutput.additionalContext, /Preserve the public greeting CLI contract/);
  payload.hook_event_name = 'UserPromptSubmit';
  payload.prompt = 'Continue the task';
  assert.deepEqual(invoke(), {});
  payload.hook_event_name = 'PostCompact';
  assert.deepEqual(invoke(), {});
  payload.hook_event_name = 'UserPromptSubmit';
  assert.match(invoke().hookSpecificOutput.additionalContext, /\.trae\/rules\/contract\.md/);
});

test('final checkpoint rejects missing proof and accepts captured CLI evidence without a host goal', t => {
  const { cwd, run, loop } = fixture(t);
  writeFileSync(join(cwd, 'greet.mjs'), 'if(process.argv.length>3){console.error("one name only");process.exit(2)}console.log(`Hello, ${process.argv[2] || "world"}!`);\n');
  loop('create-goals', '--brief', 'Validate the greeting CLI');
  const active = loop('complete-goals').goal;
  const goal = active.id;
  const attempt = loop('status').currentAttemptDir;
  assert.ok(attempt.includes('/session-a/'));
  const early = run('ulw-loop', 'checkpoint', '--goal-id', goal, '--status', 'complete', '--evidence', 'claim', '--session-id', 'session-a', '--json');
  assert.equal(early.status, 1);
  const scenarios = [
    { id: 'C001', args: ['Ada'], status: 0, stdout: 'Hello, Ada!\n', stderr: '', scenario: 'Named greeting', model: 'happy' },
    { id: 'C002', args: ['Ada', 'Bob'], status: 2, stdout: '', stderr: 'one name only\n', scenario: 'Extra names rejected', model: 'edge' },
    { id: 'C003', args: [], status: 0, stdout: 'Hello, world!\n', stderr: '', scenario: 'Default greeting preserved', model: 'regression' },
  ];
  mkdirSync(join(cwd, attempt), { recursive: true });
  const artifacts = [];
  for (const scenario of scenarios) {
    loop('steer', '--kind', 'revise_criterion', '--goal-id', goal, '--criterion-id', scenario.id, '--scenario', scenario.scenario,
      '--expected-evidence', 'Captured stdout, stderr and exit status match the CLI contract', '--evidence', 'CLI contract', '--rationale', 'Observable acceptance');
    const observed = spawnSync(process.execPath, ['greet.mjs', ...scenario.args], { cwd, encoding: 'utf8' });
    assert.equal(observed.status, scenario.status);
    assert.equal(observed.stdout, scenario.stdout);
    assert.equal(observed.stderr, scenario.stderr);
    const path = `${attempt}/${scenario.id}.json`;
    writeFileSync(join(cwd, path), JSON.stringify({ command: ['node', 'greet.mjs', ...scenario.args], status: observed.status, stdout: observed.stdout, stderr: observed.stderr }));
    artifacts.push({ id: scenario.id, kind: 'cli-transcript', description: scenario.scenario, path });
    loop('record-evidence', '--goal-id', goal, '--criterion-id', scenario.id, '--status', 'pass', '--evidence', `Observed exit ${observed.status}; ${path}`);
  }
  const template = loop('checkpoint', '--print-template').qualityGateTemplate;
  assert.ok(template.manualQa && template.gateReview);
  const gate = {
    manualQa: { by: 'main-session', status: 'passed', evidence: 'All three CLI contracts executed and asserted', artifactRefs: artifacts,
      surfaceEvidence: scenarios.map(s => ({ id: `surface-${s.id}`, criterionRef: s.id, surface: 'cli', invocation: `node greet.mjs ${s.args.join(' ')}`, verdict: 'passed', artifactRefs: [s.id] })),
      adversarialCases: [{ id: 'extra-args', criterionRef: 'C002', scenario: 'two supplied names', expectedBehavior: 'exit 2 and stderr', verdict: 'passed', artifactRefs: ['C002'] }] },
    gateReview: { by: 'main-session', recommendation: 'APPROVE', reportPath: `${attempt}/review.md`, evidence: 'CLI observations checked against acceptance contract', blockers: [], notes: [] },
    iteration: { fullRerun: true, status: 'passed', rerunCommands: scenarios.map(s => `node greet.mjs ${s.args.join(' ')}`), evidence: 'Exit status, stdout and stderr asserted for every scenario' },
    criteriaCoverage: { totalCriteria: 3, passCount: 3, originalIntent: 'Validate greeting CLI', desiredOutcome: 'Correct greeting and clear invalid-input handling', userOutcomeReview: 'Named/default greetings and extra-argument errors all observed', adversarialClassesCovered: ['extra arguments'] },
  };
  // A plausible JSON gate is insufficient when its report does not exist.
  const missing = run('ulw-loop', 'checkpoint', '--goal-id', goal, '--status', 'complete', '--evidence', 'CLI scenarios passed', '--quality-gate-json', JSON.stringify(gate), '--session-id', 'session-a', '--json');
  assert.equal(missing.status, 1);
  assert.match(missing.stdout, /artifact|report|file/i);
  writeFileSync(join(cwd, attempt, 'review.md'), 'Reviewed observed CLI output: named and default greetings pass; extra arguments exit 2 with stderr. All three observations are captured beside this report.\n');
  const checkpoint = loop('checkpoint', '--goal-id', goal, '--status', 'complete', '--evidence', 'CLI scenarios passed', '--quality-gate-json', JSON.stringify(gate));
  assert.ok(!checkpoint.nextActions?.some(action => /call get_goal|call create_goal|now update_goal/.test(action)), 'Optional host goals must not become mandatory in checkpoint advice');
  const completed = loop('status');
  assert.equal(completed.plan.goals[0].status, 'complete');
  assert.ok(!completed.nextActions.some(action => /evidence-layout v1/.test(action)), 'Completed v2 plans retain their evidence layout');
  const ledger = readFileSync(join(cwd, completed.plan.ledgerPath), 'utf8');
  const entries = ledger.trim().split('\n').map(line => JSON.parse(line));
  assert.equal(entries.at(-1).status, 'complete');
  assert.equal(entries.at(-1).qualityGate.criteriaCoverage.passCount, 3);
});

async function mcpClient(t, component, config) {
  const child = spawn(process.execPath, [cli, component, 'mcp'], { cwd: config.cwd, env: config.env, stdio: ['pipe', 'pipe', 'pipe'] });
  const pending = new Map();
  let nextId = 0;
  let stderr = '';
  child.stderr.on('data', chunk => { stderr += chunk; });
  const lines = createInterface({ input: child.stdout });
  lines.on('line', line => {
    const message = JSON.parse(line);
    pending.get(message.id)?.resolve(message);
    pending.delete(message.id);
  });
  child.on('exit', code => { for (const item of pending.values()) item.reject(new Error(`${component} exited ${code}: ${stderr}`)); });
  config.cleanup.push(async () => {
    lines.close();
    child.kill('SIGTERM');
    await new Promise(resolve => child.exitCode !== null ? resolve() : child.once('exit', resolve));
    // LSP daemon is intentionally persistent; stop only this fixture's daemon.
    const version = JSON.parse(readFileSync(join(root, 'plugins/lazytrae/components/lsp-daemon/dist/package.json'), 'utf8')).version;
    const pidFile = join(config.dir, `data/lsp-daemon/v${version}/daemon.pid`);
    try { process.kill(Number(readFileSync(pidFile, 'utf8')), 'SIGTERM'); } catch (error) { if (!['ENOENT', 'ESRCH'].includes(error.code)) throw error; }
  });
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${component} timed out: ${stderr}`)); }, 15000);
    pending.set(id, { resolve: message => { clearTimeout(timer); resolve(message); }, reject: error => { clearTimeout(timer); reject(error); } });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
  const initialized = await call('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'lazytrae-test', version: '1' } });
  assert.ok(initialized.result.capabilities.tools);
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  return call;
}

for (const component of ['git', 'lsp']) test(`${component} MCP serves real JSON-RPC requests`, { timeout: 30000 }, async t => {
  const config = fixture(t);
  const call = await mcpClient(t, component, config);
  const listed = await call('tools/list');
  const name = component === 'git' ? 'diagnose' : 'status';
  assert.ok(listed.result.tools.some(tool => tool.name === name));
  const result = await call('tools/call', { name, arguments: {} });
  assert.ok(result.result.content.length > 0);
  assert.ok(!result.result.isError, JSON.stringify(result));
});
