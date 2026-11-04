// Release contract: an npm tarball must contain every local skill/MCP/hook
// dependency, and run without the upstream checkout, submodule or npm install.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
test('release tarball runs independently of its source checkout', t => {
  const dir = mkdtempSync(join(tmpdir(), 'lazytrae-pack-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const pack = spawnSync('npm', ['pack', '--json', '--dry-run=false', '--pack-destination', dir], {
    cwd: root, encoding: 'utf8', env: { ...process.env, npm_config_dry_run: 'true' },
  });
  assert.equal(pack.status, 0, pack.stderr);
  const packed = JSON.parse(pack.stdout)[0];
  const unpack = spawnSync('tar', ['-xzf', join(dir, packed.filename), '-C', dir], { encoding: 'utf8' });
  assert.equal(unpack.status, 0, unpack.stderr);
  const plugin = join(dir, 'package/plugins/lazytrae');
  const manifest = JSON.parse(readFileSync(join(plugin, '.codex-plugin/plugin.json'), 'utf8'));
  assert.equal(manifest.version, packed.version, 'The bundled plugin must report the npm release version.');
  assert.ok(existsSync(join(plugin, manifest.hooks)));
  assert.ok(existsSync(join(plugin, manifest.mcpServers)));
  for (const name of ['ulw-loop', 'rules', 'comment-checker', 'git-bash-mcp', 'lsp', 'lsp-daemon']) assert.ok(existsSync(join(plugin, 'components', name, 'LICENSE')));
  assert.ok(!packed.files.some(file => /plugins\/omo|traecli\.toml|\.validation-path/.test(file.path)));
  const result = spawnSync(process.execPath, [join(dir, 'package/bin/lazytrae.js'), 'ulw-loop', 'create-goals', '--session-id', 'packed', '--brief', 'Packaged goal', '--json'], { cwd: dir, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).plan.brief.trim(), 'Packaged goal');
  const available = join(dir, 'models.json');
  writeFileSync(available, JSON.stringify([{ provider: 'trae', name: 'GPT-6-Astra' }]));
  const routingEnv = { ...process.env, PLUGIN_DATA: join(dir, 'data') };
  delete routingEnv.LAZYTRAE_MODEL_CONFIG;
  const routed = spawnSync(process.execPath, [join(dir, 'package/bin/lazytrae.js'), 'models', 'route',
    '--role', 'lazytrae-worker-medium', '--available-models', available], { cwd: dir, env: routingEnv, encoding: 'utf8' });
  assert.equal(routed.status, 0, routed.stderr);
  assert.deepEqual(JSON.parse(routed.stdout).spawn, {
    agent_type: 'lazytrae-worker-medium', fork_turns: 'none', model_provider: 'trae', model: 'GPT-6-Astra',
  });
});
