#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const plugin = join(root, 'plugins/lazytrae');
const qualifiedName = 'lazytrae@lazytrae-local';
function run(args) {
  const result = spawnSync('traecli', args, { stdio: 'inherit' });
  if (result.error) throw new Error(`Cannot run traecli: ${result.error.message}. Install TRAE CLI first.`);
  if (result.status !== 0) throw new Error(`traecli ${args[0]} failed (exit ${result.status ?? result.signal}).`);
}
try {
  const [command = 'help', ...args] = process.argv.slice(2);
  if (['install', 'uninstall', 'doctor'].includes(command) && args.length) {
    throw new Error(`${command} takes no arguments. Set TRAE_HOME and TRAECLI_HOME to choose an isolated installation.`);
  }
  if (command === 'install') {
    mkdirSync(resolve(process.env.TRAE_HOME || join(homedir(), '.trae')), { recursive: true });
    run(['plugin', 'validate', '--path', plugin]);
    run(['plugin', 'install', plugin, '--name', 'lazytrae', '--marketplace-name', 'lazytrae-local', '--yes']);
    console.log('LazyTrae installed. Open a new TRAE session; check /skills, /agents, /mcp and review /hooks.');
    console.log('Roles are provided by the plugin. No user role files, model defaults or hook trust hashes were written.');
  } else if (command === 'uninstall') {
    run(['plugin', 'uninstall', qualifiedName]);
    console.log('LazyTrae removed. Repository evidence and user configuration were preserved.');
  } else if (command === 'doctor') {
    run(['--version']);
    run(['plugin', 'validate', qualifiedName]);
    console.log('Check /agents, /hooks trust and /mcp connection status in a new session.');
  } else if (command === '--version') {
    console.log(JSON.parse(readFileSync(join(plugin, '.codex-plugin/plugin.json'), 'utf8')).version);
  } else if (['help', '--help', '-h'].includes(command)) {
    console.log('LazyTrae\n  lazytrae install    Install the TRAE plugin\n  lazytrae doctor     Validate the installed plugin\n  lazytrae uninstall  Remove the plugin\n  lazytrae models route --role <agent_type> | --all\n  lazytrae ulw-loop <command> --session-id <id>\n  lazytrae git mcp | lsp mcp | rules <command>\n\nRequires Node.js 20+ and TRAE CLI. No Codex installation is needed.');
  } else {
    const result = spawnSync(process.execPath, [join(plugin, 'runtime/cli.mjs'), command, ...args], { stdio: 'inherit' });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  }
} catch (error) {
  console.error(`lazytrae: ${error.message}`);
  process.exitCode = 1;
}
