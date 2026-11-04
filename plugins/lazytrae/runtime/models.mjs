import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { runtimeEnv } from './environment.mjs';
import { ModelRoutingError, routeModels } from './model-routing.mjs';

export function modelsCommand(args) {
  try {
    const { values, positionals } = parseArgs({ args, allowPositionals: true, options: {
      role: { type: 'string' }, all: { type: 'boolean' }, config: { type: 'string' },
      'available-models': { type: 'string' }, provider: { type: 'string' }, model: { type: 'string' },
      inherit: { type: 'boolean' }, 'fork-turns': { type: 'string' }, help: { type: 'boolean' }, json: { type: 'boolean' },
    } });
    if (values.help || positionals[0] === 'help') {
      console.log('lazytrae models route (--role <agent_type> | --all) [--available-models <json-file>] [--config <json-file>] [--provider <provider> --model <name>] [--inherit] [--fork-turns none|all|N]\nOutputs JSON spawn fields. Catalog defaults to traecli models --json.');
      return 0;
    }
    if (positionals.length !== 1 || positionals[0] !== 'route' || Boolean(values.role) === Boolean(values.all)) {
      throw new ModelRoutingError('INVALID_ARGUMENTS', 'Use models route with exactly one of --role or --all.');
    }
    const defaultConfig = join(runtimeEnv().PLUGIN_DATA, 'model-routing.json');
    const result = routeModels({ role: values.role, all: values.all,
      config: values.config ?? process.env.LAZYTRAE_MODEL_CONFIG ?? (existsSync(defaultConfig) ? defaultConfig : undefined),
      availableModels: values['available-models'], provider: values.provider, model: values.model,
      inherit: values.inherit, forkTurns: values['fork-turns'],
    });
    console.log(JSON.stringify(result, null, 2));
    return 0;
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    if (!(error instanceof ModelRoutingError) && !String(error.code).startsWith('ERR_PARSE_ARGS')) throw error;
    const code = error instanceof ModelRoutingError ? error.code : 'INVALID_ARGUMENTS';
    console.log(JSON.stringify({ error: { code, message: error.message } }));
    return 1;
  }
}
