#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { pluginRoot, runtimeEnv } from './environment.mjs';

Object.assign(process.env, runtimeEnv());
const [command = 'help', ...args] = process.argv.slice(2);
if (command === 'models') {
  const { modelsCommand } = await import('./models.mjs');
  process.exitCode = modelsCommand(args);
} else if (command === 'ulw-loop') {
  // Preserve upstream file/schema compatibility, expose host-neutral flag aliases.
  const mapped = args.map(a => a.replace(/^--host-goal-json(?==|$)/, '--codex-goal-json').replace(/^--host-goal-mode(?==|$)/, '--codex-goal-mode'));
  const { ulwLoopCommand } = await import('../components/ulw-loop/dist/cli-commands.js');
  process.exitCode = await ulwLoopCommand(mapped);
} else if (['git', 'lsp', 'rules', 'comment-checker'].includes(command)) {
  const component = { git: 'git-bash-mcp', lsp: 'lsp-daemon', rules: 'rules', 'comment-checker': 'comment-checker' }[command];
  const child = spawn(process.execPath, [join(pluginRoot, 'components', component, 'dist/cli.js'), ...args], { stdio: 'inherit', env: runtimeEnv() });
  child.on('error', error => { console.error(error.message); process.exitCode = 1; });
  child.on('exit', (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
} else if (command === 'help' || command === '--help' || command === '-h') {
  console.log('LazyTrae runtime\n  lazytrae models route --role <agent_type> | --all\n  lazytrae ulw-loop <command> --session-id <id>\n  lazytrae git mcp\n  lazytrae lsp mcp\n  lazytrae rules <command>\n  lazytrae comment-checker <command>\n\nUse `ulw-loop help` for ledger commands. Legacy --codex-goal-* flags are also accepted.');
} else {
  console.error(`Unknown command: ${command}`);
  process.exitCode = 1;
}
