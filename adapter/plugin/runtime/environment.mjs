import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export function runtimeEnv(env = process.env) {
  const traeRoot = resolve(env.TRAE_HOME || join(homedir(), '.trae'));
  const data = env.PLUGIN_DATA || join(traeRoot, 'plugins/data/lazytrae');
  return { ...env, PLUGIN_ROOT: pluginRoot, PLUGIN_DATA: data,
    LAZYTRAE_RULES_ENABLED_SOURCES: env.LAZYTRAE_RULES_ENABLED_SOURCES || '.trae/rules,.omo/rules,.claude/rules,.cursor/rules,.github/instructions,.github/copilot-instructions.md,CONTEXT.md',
    OMO_LSP_DAEMON_DIR: join(data, 'lsp-daemon'),
    LSP_TOOLS_MCP_USER_CONFIG: join(traeRoot, 'lsp-client.json'),
    LSP_TOOLS_MCP_INSTALL_DECISIONS: join(traeRoot, 'lsp-install-decisions.json'),
  };
}
