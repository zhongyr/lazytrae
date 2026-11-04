// Public CLI contract: model choices must be available pairs and obey user
// overrides, history constraints and inheritance without changing host config.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../plugins/lazytrae/runtime/cli.mjs', import.meta.url));
function fixture(t, catalog) {
  const dir = mkdtempSync(join(tmpdir(), 'lazytrae-models-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const available = join(dir, 'available models.json');
  writeFileSync(available, JSON.stringify(catalog));
  const env = { ...process.env, PLUGIN_DATA: join(dir, 'data') };
  delete env.LAZYTRAE_MODEL_CONFIG;
  const run = (...args) => {
    const result = spawnSync(process.execPath, [cli, 'models', 'route', '--available-models', available, ...args],
      { cwd: dir, env, encoding: 'utf8', timeout: 10000 });
    assert.ok(result.stdout.trim(), result.stderr);
    return { ...result, json: JSON.parse(result.stdout) };
  };
  let policyId = 0;
  const policy = value => {
    const config = join(dir, `policy-${++policyId}.json`);
    writeFileSync(config, JSON.stringify(value));
    return ['--config', config];
  };
  return { dir, env, run, policy };
}

test('default task tiers choose available display names rather than backend or config aliases', t => {
  const { run } = fixture(t, [
    { provider: 'trae', name: 'DeepSeek-V4.1-Flash', config_name: 'deepseek-v4.1-flash' },
    { provider: 'trae', name: 'GPT-6-Astra', config_name: 'gpt-6-astra' },
    { provider: 'trae', name: 'GPT-6.1-Sol', backend_model: 'gpt-6.1-sol__dev' },
  ]);
  for (const [role, model] of [
    ['lazytrae-explorer', 'DeepSeek-V4.1-Flash'],
    ['lazytrae-worker-low', 'GPT-6-Astra'],
    ['lazytrae-worker-medium', 'GPT-6-Astra'],
    ['lazytrae-worker-high', 'GPT-6.1-Sol'],
  ]) {
    const result = run('--role', role);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(result.json.spawn, { agent_type: role, fork_turns: 'none', model_provider: 'trae', model });
  }
});

test('candidate order skips unavailable provider/model pairs and falls back to inheritance', t => {
  for (const [catalog, expected] of [
    [[{ provider: 'other', name: 'DeepSeek-V4.1-Flash' }, { provider: 'trae', name: 'GLM-5.3-Flash' }], 'GLM-5.3-Flash'],
    [[], undefined],
  ]) {
    const { run } = fixture(t, catalog);
    const result = run('--role', 'lazytrae-explorer');
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(result.json.spawn, expected
      ? { agent_type: 'lazytrae-explorer', fork_turns: 'none', model_provider: 'trae', model: expected }
      : { agent_type: 'lazytrae-explorer', fork_turns: 'none' });
    assert.equal(result.json.reason, expected ? 'role_mapping' : 'no_available_candidate');
  }
});

test('explicit model overrides role configuration while partial configuration preserves other roles', t => {
  const { run, policy } = fixture(t, [
    { provider: 'local', name: 'Custom-Model' },
    { provider: 'trae', name: 'Kimi-K3' },
    { provider: 'trae', name: 'DeepSeek-V4.1-Flash' },
  ]);
  const args = policy({ roles: { 'lazytrae-worker-high': [{ model_provider: 'local', model: 'Custom-Model' }] } });
  for (const [options, provider, model] of [
    [['--role', 'lazytrae-worker-high', ...args], 'local', 'Custom-Model'],
    [['--role', 'lazytrae-worker-high', ...args, '--provider', 'trae', '--model', 'Kimi-K3'], 'trae', 'Kimi-K3'],
    [['--role', 'lazytrae-explorer', ...args], 'trae', 'DeepSeek-V4.1-Flash'],
  ]) {
    const result = run(...options);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.json.spawn.model_provider, provider);
    assert.equal(result.json.spawn.model, model);
  }
});

test('implementation prefers an available GPT fallback before non-GPT candidates', t => {
  const { run } = fixture(t, [
    { provider: 'trae', name: 'Doubao-Seed-2.1-Pro' },
    { provider: 'trae', name: 'GPT-5.5' },
  ]);
  const result = run('--role', 'lazytrae-worker-low');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.json.spawn.model, 'GPT-5.5');
});

test('configuration precedence is explicit file then environment then plugin data', t => {
  const { env, run, policy } = fixture(t, ['Data', 'Environment', 'Explicit'].map(name => ({ provider: 'local', name })));
  const config = model => ({ roles: { 'lazytrae-worker-high': [{ model_provider: 'local', model }] } });
  mkdirSync(env.PLUGIN_DATA);
  writeFileSync(join(env.PLUGIN_DATA, 'model-routing.json'), JSON.stringify(config('Data')));
  const data = run('--role', 'lazytrae-worker-high');
  assert.equal(data.status, 0);
  assert.equal(data.json.spawn.model, 'Data');
  env.LAZYTRAE_MODEL_CONFIG = policy(config('Environment'))[1];
  const environment = run('--role', 'lazytrae-worker-high');
  assert.equal(environment.status, 0);
  assert.equal(environment.json.spawn.model, 'Environment');
  const explicit = run('--role', 'lazytrae-worker-high', ...policy(config('Explicit')));
  assert.equal(explicit.status, 0);
  assert.equal(explicit.json.spawn.model, 'Explicit');
});

test('inheritance opt-outs and full history omit model overrides', t => {
  const { run, policy } = fixture(t, [{ provider: 'trae', name: 'GPT-6.1-Sol' }]);
  for (const [args, fork, reason] of [
    [['--inherit'], 'none', 'explicit_inherit'],
    [policy({ mode: 'inherit' }), 'none', 'policy_inherit'],
    [policy({ roles: { 'lazytrae-worker-high': 'inherit' } }), 'none', 'role_inherit'],
    [['--fork-turns', 'all'], 'all', 'full_history'],
  ]) {
    const result = run('--role', 'lazytrae-worker-high', ...args);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(result.json.spawn, { agent_type: 'lazytrae-worker-high', fork_turns: fork });
    assert.equal(result.json.reason, reason);
  }
});

test('unavailable explicit models, full-history conflicts and malformed inputs fail before spawning', t => {
  const { run, policy } = fixture(t, [{ provider: 'trae', name: 'GPT-6.1-Sol', config_name: 'gpt-6.1-sol' }]);
  for (const [args, code] of [
    [['--model', 'gpt-6.1-sol', '--provider', 'trae'], 'MODEL_UNAVAILABLE'],
    [['--model', 'GPT-6.1-Sol'], 'INVALID_ARGUMENTS'],
    [['--model', 'GPT-6.1-Sol', '--provider', 'trae', '--fork-turns', 'all'], 'HISTORY_OVERRIDE_CONFLICT'],
    [['--role', 'default'], 'UNKNOWN_ROLE'],
    [policy({ mode: 'typo' }), 'INVALID_POLICY'],
    [policy({ mode: null }), 'INVALID_POLICY'],
    [policy({ roles: null }), 'INVALID_POLICY'],
    [policy({ roles: { 'lazytrae-workr-high': 'deep' } }), 'UNKNOWN_ROLE'],
    [policy({ roles: { 'lazytrae-worker-high': 'missing-profile' } }), 'INVALID_POLICY'],
    [policy({ profiles: { deep: [{ model: 'GPT-6.1-Sol' }] } }), 'INVALID_POLICY'],
  ]) {
    const result = run('--role', 'lazytrae-worker-high', ...args);
    assert.equal(result.status, 1, result.stderr);
    assert.equal(result.json.error.code, code);
    assert.equal(result.json.spawn, undefined);
  }
});

test('missing model-list command inherits while malformed supplied catalogs are rejected', t => {
  const { dir, env, run } = fixture(t, [{ name: 'GPT-6.1-Sol' }]);
  const malformed = run('--role', 'lazytrae-worker-high');
  assert.equal(malformed.status, 1);
  assert.equal(malformed.json.error.code, 'INVALID_CATALOG');
  const unavailable = spawnSync(process.execPath, [cli, 'models', 'route', '--role', 'lazytrae-worker-high'],
    { cwd: dir, env: { ...env, PATH: dir }, encoding: 'utf8', timeout: 10000 });
  assert.equal(unavailable.status, 0, unavailable.stderr);
  const output = JSON.parse(unavailable.stdout);
  assert.equal(output.reason, 'catalog_unavailable');
  assert.deepEqual(output.spawn, { agent_type: 'lazytrae-worker-high', fork_turns: 'none' });
});
