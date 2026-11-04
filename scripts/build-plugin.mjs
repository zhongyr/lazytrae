import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const upstream = join(root, 'plugins/omo');
const out = join(root, 'plugins/lazytrae');
const version = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).version;
const components = ['ulw-loop', 'rules', 'comment-checker', 'git-bash-mcp', 'lsp', 'lsp-daemon'];
const utilities = ['ast-grep', 'debugging', 'programming', 'frontend', 'data-scientist', 'git-master', 'eval-integrity'];
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

async function optionalCopy(source, target) {
  try { await cp(source, target, { recursive: true }); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
async function* files(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* files(path);
    else if (entry.isFile()) yield path;
  }
}
for (const name of components) {
  for (const item of ['dist', 'package.json', 'LICENSE', 'NOTICE', 'directive.md']) {
    await optionalCopy(join(upstream, 'components', name, item), join(out, 'components', name, item));
  }
  try { await readFile(join(out, 'components', name, 'LICENSE')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    // These runtimes are distributed under the upstream repository's MIT
    // license when no component-specific license file is supplied.
    await cp(join(root, 'LICENSE'), join(out, 'components', name, 'LICENSE'));
  }
}
// Runtime-only path/namespace adaptation. Storage keys and upstream evidence
// schemas deliberately stay stable; bootstrap, telemetry and updater are absent.
for await (const path of files(join(out, 'components'))) {
  if (!path.endsWith('.js')) continue;
  const text = await readFile(path, 'utf8');
  await writeFile(path, text
    .replaceAll('CODEX_HOME', 'TRAE_HOME')
    .replaceAll('CODEX_SESSION_ID', 'TRAE_SESSION_ID')
    .replaceAll('CODEX_THREAD_ID', 'TRAE_THREAD_ID')
    .replaceAll('".codex"', '".trae"')
    .replaceAll('.codex/lsp-', '.trae/lsp-')
    .replaceAll('lazycodex-', 'lazytrae-')
    .replaceAll('omo-agent-toolkit', 'lazytrae'));
}
// Use the modular engine through our entrypoint, never its Codex hook CLI.
await rm(join(out, 'components/ulw-loop/dist/cli.js'));
const gitEntry = join(out, 'components/git-bash-mcp/dist/cli.js');
const gitSource = await readFile(gitEntry, 'utf8');
const gitGuard = 'async function runMcpStdioServer(input, output, options = {}) {\n  if (!canRunGitBash(options))\n    return;';
if (!gitSource.includes(gitGuard)) throw new Error('Upstream Git Bash transport changed; review the adapter.');
await writeFile(gitEntry, gitSource.replace(gitGuard, 'async function runMcpStdioServer(input, output, options = {}) {'));
const actionsFile = join(out, 'components/ulw-loop/dist/status-next-actions.js');
await writeFile(actionsFile, (await readFile(actionsFile, 'utf8'))
  .replaceAll('plan.evidenceLayoutVersion !== 2 || active === undefined', 'plan.evidenceLayoutVersion !== 2')
  .replaceAll('update_goal complete, then checkpoint --print-template', 'use checkpoint --print-template')
  .replaceAll(" --codex-goal-json '<get_goal json>'", ''));
const snapshotFile = join(out, 'components/ulw-loop/dist/codex-goal-snapshot.js');
await writeFile(snapshotFile, (await readFile(snapshotFile, 'utf8'))
  .replace(/^\s*nextActions.push\(`call get_goal; if none, create_goal.*\n/m, '\n')
  .replaceAll('nextActions.push("/goal resume or raise the budget");', 'nextActions.push("Host goal is paused or limited. Stop and wait for the user to resume or change the budget.");')
  .replace(/nextActions.push\(`driver closed early: call create_goal.*?\);/, 'nextActions.push("Host goal is complete. Do not create another host goal without an explicit user request.");'));
const checkpointFile = join(out, 'components/ulw-loop/dist/checkpoint.js');
await writeFile(checkpointFile, (await readFile(checkpointFile, 'utf8'))
  .replaceAll('aggregate complete: now update_goal({status:"complete"})', 'Ledger complete. Finish any remaining requested delivery work; only then complete an existing, explicitly requested host goal.'));
const rulesFile = join(out, 'components/rules/dist/cli.js');
await writeFile(rulesFile, (await readFile(rulesFile, 'utf8'))
  .replaceAll('CODEX_RULES_', 'LAZYTRAE_RULES_')
  .replace('[".omo", "rules"],', '[".trae", "rules"],\n  [".omo", "rules"],')
  .replace('[".omo/rules", 0],', '[".trae/rules", -1],\n  [".omo/rules", 0],')
  .replaceAll('case ".omo/rules":', 'case ".trae/rules":\n    case ".omo/rules":'));
const commentsFile = join(out, 'components/comment-checker/dist/cli.js');
await writeFile(commentsFile, (await readFile(commentsFile, 'utf8'))
  .replace('function resolveCommentCheckerBinary2() {', 'function resolveCommentCheckerBinary2() {\n  const configured = process.env.LAZYTRAE_COMMENT_CHECKER;\n  if (configured) return existsSync(configured) ? configured : undefined;')
  .replaceAll('Run npm install for the codex-comment-checker plugin.', 'Set LAZYTRAE_COMMENT_CHECKER to an installed comment-checker executable.'));
const helpFile = join(out, 'components/ulw-loop/dist/cli-output.js');
await writeFile(helpFile, (await readFile(helpFile, 'utf8'))
  .replace(/^  lazytrae hook user-prompt-submit.*\n/m, '')
  .replaceAll('--codex-goal-json <...> [--quality-gate-json', '[--host-goal-json <...>] [--quality-gate-json'));
for (const name of utilities) {
  const dest = join(out, 'skills', name);
  await cp(join(upstream, 'skills', name), dest, { recursive: true });
  let text = await readFile(join(dest, 'SKILL.md'), 'utf8');
  text = text.replace(/\n## Codex Harness Tool Compatibility[\s\S]*?(?=\n# )/, '\n');
  const boundary = text.indexOf('\n---', 4);
  text = text.slice(0, boundary + 4) + '\n\nRead [TRAE host conventions](../../HOST.md) before following tool examples.\n' + text.slice(boundary + 4);
  await writeFile(join(dest, 'SKILL.md'), text);
}
await cp(join(root, 'adapter/plugin'), out, { recursive: true });
await mkdir(join(out, 'agents'), { recursive: true });
for (const file of await readdir(join(upstream, 'components/ultrawork/agents'))) {
  if (!file.endsWith('.toml')) continue;
  const source = await readFile(join(upstream, 'components/ultrawork/agents', file), 'utf8');
  const oldName = source.match(/^name = "([^"]+)"/m)?.[1];
  const description = source.match(/^description = "([^"]+)"/m)?.[1];
  const body = source.match(/developer_instructions = """\n([\s\S]*?)\n"""/)?.[1];
  if (!oldName || !description || !body) throw new Error(`Unsupported upstream agent format: ${file}`);
  const name = oldName.startsWith('lazycodex-') ? oldName.replace('lazycodex-', 'lazytrae-') : `lazytrae-${oldName}`;
  const content = `---\nname: ${name}\ndescription: ${JSON.stringify(description.replaceAll('LazyCodex', 'LazyTrae'))}\nmodel: inherit\n---\n\nFollow host instructions and the caller's explicit scope. Use only available tools.\nRead the LazyTrae HOST.md in the installed plugin before translating upstream tool examples.\n\n${body.replaceAll('lazycodex-', 'lazytrae-').replaceAll('omo-agent-toolkit', 'lazytrae')}\n`;
  await writeFile(join(out, 'agents', `${name}.md`), content);
}

const hooks = {};
function hook(event, mode, matcher) {
  (hooks[event] ??= []).push({ ...(matcher ? { matcher } : {}), hooks: [{
    type: 'command', command: `node "${'${PLUGIN_ROOT}'}/runtime/hook.mjs" ${mode}`,
    timeout: 20,
  }] });
}
for (const event of ['SessionStart', 'UserPromptSubmit', 'PostCompact', 'Stop', 'Interrupt']) hook(event, 'workflow');
for (const event of ['SessionStart', 'UserPromptSubmit', 'PostCompact']) hook(event, 'rules');
hook('PostToolUse', 'rules', '^(Bash|Read|Edit|Write|apply_patch)$');
hook('PostToolUse', 'comments', '^(Edit|Write|apply_patch)$');
// LSP checks remain explicit: starting a language server on every edit is costly.
await mkdir(join(out, 'hooks'), { recursive: true });
await writeFile(join(out, 'hooks/hooks.json'), JSON.stringify({ hooks }, null, 2) + '\n');
// Overlay replaces the host-facing handoff while retaining engine APIs.
await cp(join(root, 'adapter/engine/codex-goal-instruction.js'), join(out, 'components/ulw-loop/dist/codex-goal-instruction.js'));

const manifest = {
  name: 'lazytrae', version,
  description: 'LazyCodex workflows and evidence engine adapted for TRAE CLI.',
  author: { name: 'LazyTrae contributors' }, license: 'MIT',
  repository: 'https://github.com/zhongyr/lazytrae',
  skills: './skills/', hooks: './hooks/hooks.json', mcpServers: './.mcp.json',
};
await mkdir(join(out, '.codex-plugin'), { recursive: true });
await writeFile(join(out, '.codex-plugin/plugin.json'), JSON.stringify(manifest, null, 2) + '\n');
await cp(join(root, 'LICENSE'), join(out, 'LICENSE'));
await cp(join(root, 'NOTICE'), join(out, 'NOTICE'));
await writeFile(join(out, 'UPSTREAM.json'), JSON.stringify({
  repository: 'https://github.com/code-yeongyu/lazycodex',
  commit: '4b08788096abee8e2d728cfb122ac46a57a16c56',
  pluginVersion: '5.1.60', components, utilitySkills: utilities,
}, null, 2) + '\n');
console.log(`Built LazyTrae ${version}`);
