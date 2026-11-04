// Release contract: an npm tarball must contain every local skill/MCP/hook
// dependency, and run without the upstream checkout, submodule or npm install.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
test('release tarball runs independently of its source checkout', t => {
  const dir = mkdtempSync(join(tmpdir(), 'lazytrae-pack-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const pack = spawnSync('npm', ['pack', '--json', '--pack-destination', dir], { cwd: root, encoding: 'utf8' });
  assert.equal(pack.status, 0, pack.stderr);
  const packed = JSON.parse(pack.stdout)[0];
  const unpack = spawnSync('tar', ['-xzf', join(dir, packed.filename), '-C', dir], { encoding: 'utf8' });
  assert.equal(unpack.status, 0, unpack.stderr);
  const plugin = join(dir, 'package/plugins/lazytrae');
  const manifest = JSON.parse(readFileSync(join(plugin, '.codex-plugin/plugin.json'), 'utf8'));
  assert.ok(existsSync(join(plugin, manifest.hooks)));
  assert.ok(existsSync(join(plugin, manifest.mcpServers)));
  for (const name of ['ulw-loop', 'rules', 'comment-checker', 'git-bash-mcp', 'lsp', 'lsp-daemon']) assert.ok(existsSync(join(plugin, 'components', name, 'LICENSE')));
  assert.ok(!packed.files.some(file => /plugins\/omo|traecli\.toml|\.validation-path/.test(file.path)));
  const result = spawnSync(process.execPath, [join(dir, 'package/bin/lazytrae.js'), 'ulw-loop', 'create-goals', '--session-id', 'packed', '--brief', 'Packaged goal', '--json'], { cwd: dir, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).plan.brief.trim(), 'Packaged goal');
});
