// Real host boundary: installation must preserve user files, discover the
// packaged capabilities and uninstall without deleting user roles or evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const bin = join(root, 'bin/lazytrae.js');
test('native TRAE installs, discovers, upgrades and removes the packaged plugin in isolation', { timeout: 60000 }, async t => {
  const dir = mkdtempSync(join(tmpdir(), 'lazytrae-host-'));
  const cwd = join(dir, 'project');
  const shared = join(dir, 'trae');
  mkdirSync(cwd);
  mkdirSync(join(shared, 'agents'), { recursive: true });
  const env = { ...process.env, TRAE_HOME: shared, TRAECLI_HOME: join(shared, 'cli') };
  const config = 'model_provider = "local-probe"\nmodel = "probe"\n[model_providers.local-probe]\nname = "Local probe"\nbase_url = "http://127.0.0.1:1/v1"\nwire_api = "responses"\n';
  const role = '---\nname: personal-reviewer\ndescription: Personal read-only reviewer\nmodel: inherit\n---\nRead only.\n';
  writeFileSync(join(shared, 'traecli.toml'), config);
  writeFileSync(join(shared, 'agents/personal-reviewer.md'), role);
  mkdirSync(join(cwd, '.omo'), { recursive: true });
  writeFileSync(join(cwd, '.omo/keep.txt'), 'existing evidence');
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const run = (command, args) => {
    const p = spawnSync(command, args, { cwd, env, encoding: 'utf8', timeout: 30000 });
    assert.equal(p.status, 0, p.stderr || p.stdout);
    return p.stdout;
  };
  run(process.execPath, [bin, 'install']);
  run(process.execPath, [bin, 'install']);
  const validation = run('traecli', ['plugin', 'validate', 'lazytrae@lazytrae-local']);
  assert.match(validation, /20 skills/);
  assert.match(validation, /2 MCP servers/);
  assert.match(validation, /10 hooks/);
  const prompt = run('traecli', ['debug', 'prompt-input', 'Inspect available capabilities.']);
  assert.match(prompt, /lazytrae-worker-medium/);
  assert.match(prompt, /lazytrae-gate-reviewer/);
  assert.match(prompt, /lazytrae:ulw-loop/);
  // The host appends its plugin/marketplace registrations. Existing model and
  // provider settings must stay byte-for-byte intact.
  assert.ok(readFileSync(join(shared, 'traecli.toml'), 'utf8').startsWith(config));
  assert.equal(readFileSync(join(shared, 'agents/personal-reviewer.md'), 'utf8'), role);

  const server = spawn('traecli', ['app-server', '--listen', 'stdio://'], { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
  let nextId = 0;
  let errors = '';
  const pending = new Map();
  server.stderr.on('data', data => { errors += data; });
  const lines = createInterface({ input: server.stdout });
  lines.on('line', line => {
    const msg = JSON.parse(line);
    if (pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  });
  const rpc = (method, params) => new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out: ${errors}`)); }, 10000);
    pending.set(id, msg => { clearTimeout(timer); msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result); });
    server.stdin.write(JSON.stringify({ id, method, params }) + '\n');
  });
  try {
    await rpc('initialize', { clientInfo: { name: 'lazytrae-host-test', version: '1' }, capabilities: { experimentalApi: true } });
    server.stdin.write(JSON.stringify({ method: 'initialized' }) + '\n');
    const hooks = await rpc('hooks/list', { cwds: [cwd] });
    const installed = hooks.data.flatMap(entry => entry.hooks).filter(hook => hook.source === 'plugin' && hook.pluginId?.startsWith('lazytrae'));
    assert.equal(installed.length, 10);
    assert.ok(installed.every(hook => hook.trustStatus === 'untrusted'));
    assert.ok(installed.every(hook => hook.command.includes('runtime/hook.mjs')));
  } finally {
    lines.close();
    server.kill('SIGTERM');
    await new Promise(resolve => server.exitCode !== null ? resolve() : server.once('exit', resolve));
  }
  run(process.execPath, [bin, 'uninstall']);
  assert.ok(readFileSync(join(shared, 'traecli.toml'), 'utf8').startsWith(config));
  assert.equal(readFileSync(join(shared, 'agents/personal-reviewer.md'), 'utf8'), role);
  assert.equal(readFileSync(join(cwd, '.omo/keep.txt'), 'utf8'), 'existing evidence');
  // validate can still inspect an available marketplace entry after uninstall.
  // The model-visible prompt is the boundary for installed capabilities.
  const removed = run('traecli', ['debug', 'prompt-input', 'Inspect available capabilities.']);
  assert.ok(!removed.includes('lazytrae:ulw-loop'));
  assert.ok(!removed.includes('lazytrae-worker-medium'));
});
