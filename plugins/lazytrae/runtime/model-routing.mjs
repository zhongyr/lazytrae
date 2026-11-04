import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pluginRoot } from './environment.mjs';

export class ModelRoutingError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ModelRoutingError';
    this.code = code;
  }
}

function object(value, code) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ModelRoutingError(code, 'Expected a JSON object.');
  }
  return value;
}

function keys(value, allowed) {
  if (Object.keys(value).some(key => !allowed.includes(key))) {
    throw new ModelRoutingError('INVALID_POLICY', 'Unrecognized policy field.');
  }
}

function nonempty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function candidates(value) {
  if (!Array.isArray(value)) throw new ModelRoutingError('INVALID_POLICY', 'Candidates must be an array.');
  return value.map(item => {
    const pair = object(item, 'INVALID_POLICY');
    keys(pair, ['model_provider', 'model']);
    if (!nonempty(pair.model_provider) || !nonempty(pair.model)) {
      throw new ModelRoutingError('INVALID_POLICY', 'Each candidate requires model_provider and model.');
    }
    return { model_provider: pair.model_provider, model: pair.model };
  });
}

function readJson(path, code) {
  let raw;
  try { raw = readFileSync(path, 'utf8'); }
  catch (error) {
    if (!(error instanceof Error)) throw error;
    throw new ModelRoutingError(code, `Cannot read JSON file: ${path}`);
  }
  try { return JSON.parse(raw); }
  catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    throw new ModelRoutingError(code, `Invalid JSON file: ${path}`);
  }
}

function policy(configPath) {
  const defaults = readJson(join(pluginRoot, 'model-routing.json'), 'INVALID_POLICY');
  const custom = configPath ? object(readJson(configPath, 'INVALID_POLICY'), 'INVALID_POLICY') : {};
  keys(custom, ['version', 'mode', 'profiles', 'roles']);
  if (custom.version !== undefined && custom.version !== 1) {
    throw new ModelRoutingError('INVALID_POLICY', 'Only policy version 1 is supported.');
  }
  const mode = custom.mode === undefined ? defaults.mode : custom.mode;
  if (!['auto', 'inherit'].includes(mode)) throw new ModelRoutingError('INVALID_POLICY', 'Mode must be auto or inherit.');
  const profiles = Object.fromEntries(Object.entries({ ...defaults.profiles, ...object(custom.profiles === undefined ? {} : custom.profiles, 'INVALID_POLICY') })
    .map(([name, value]) => [name, candidates(value)]));
  const overrides = object(custom.roles === undefined ? {} : custom.roles, 'INVALID_POLICY');
  for (const role of Object.keys(overrides)) {
    if (!Object.hasOwn(defaults.roles, role)) throw new ModelRoutingError('UNKNOWN_ROLE', `Unknown LazyTrae role: ${role}`);
  }
  const roles = Object.fromEntries(Object.entries({ ...defaults.roles, ...overrides }).map(([role, selection]) => {
    if (selection === 'inherit') return [role, selection];
    if (typeof selection === 'string' && Object.hasOwn(profiles, selection)) return [role, profiles[selection]];
    if (Array.isArray(selection)) return [role, candidates(selection)];
    throw new ModelRoutingError('INVALID_POLICY', `Unknown profile or invalid candidates for ${role}.`);
  }));
  return { mode, roles };
}

function catalog(value) {
  if (!Array.isArray(value)) throw new ModelRoutingError('INVALID_CATALOG', 'Available models must be a JSON array.');
  return value.map(item => {
    const entry = object(item, 'INVALID_CATALOG');
    if (!nonempty(entry.provider) || !nonempty(entry.name)) {
      throw new ModelRoutingError('INVALID_CATALOG', 'Each available model requires provider and name.');
    }
    return { model_provider: entry.provider, model: entry.name };
  });
}

function availableModels(path) {
  if (path) return catalog(readJson(path, 'INVALID_CATALOG'));
  const result = spawnSync('traecli', ['models', '--json'], { encoding: 'utf8', timeout: 15000, maxBuffer: 2 * 1024 * 1024 });
  if (result.error || result.status !== 0) return null;
  try { return catalog(JSON.parse(result.stdout)); }
  catch (error) {
    if (error instanceof SyntaxError || error instanceof ModelRoutingError) return null;
    throw error;
  }
}

export function routeModels(options) {
  const configured = policy(options.config);
  const roles = options.all ? Object.keys(configured.roles) : [options.role];
  for (const role of roles) {
    if (!Object.hasOwn(configured.roles, role)) throw new ModelRoutingError('UNKNOWN_ROLE', `Unknown LazyTrae role: ${role}`);
  }
  const fork = options.forkTurns ?? 'none';
  if (!['none', 'all'].includes(fork) && !/^[1-9]\d*$/.test(fork)) {
    throw new ModelRoutingError('INVALID_ARGUMENTS', 'fork-turns must be none, all or a positive integer.');
  }
  const explicit = options.model !== undefined || options.provider !== undefined;
  if (explicit && (!nonempty(options.model) || !nonempty(options.provider))) {
    throw new ModelRoutingError('INVALID_ARGUMENTS', 'Explicit models require both --provider and --model.');
  }
  if (explicit && (fork === 'all' || options.inherit)) {
    throw new ModelRoutingError('HISTORY_OVERRIDE_CONFLICT', 'Explicit models cannot be combined with inheritance or full-history forks.');
  }
  const needsCatalog = explicit || (!options.inherit && fork !== 'all' && configured.mode === 'auto'
    && roles.some(role => configured.roles[role] !== 'inherit'));
  const available = needsCatalog ? availableModels(options.availableModels) : [];
  const matches = pair => available?.some(entry => entry.model_provider === pair.model_provider && entry.model === pair.model);
  const override = { model_provider: options.provider, model: options.model };
  if (explicit && !matches(override)) {
    throw new ModelRoutingError('MODEL_UNAVAILABLE', 'The explicit provider/model pair is absent from the available catalog.');
  }
  const result = roles.map(role => {
    const spawn = { agent_type: role, fork_turns: fork };
    if (explicit) return { reason: 'explicit_model', spawn: { ...spawn, ...override } };
    if (options.inherit) return { reason: 'explicit_inherit', spawn };
    if (fork === 'all') return { reason: 'full_history', spawn };
    if (configured.mode === 'inherit') return { reason: 'policy_inherit', spawn };
    if (configured.roles[role] === 'inherit') return { reason: 'role_inherit', spawn };
    if (available === null) return { reason: 'catalog_unavailable', spawn };
    const selected = configured.roles[role].find(matches);
    return selected ? { reason: 'role_mapping', spawn: { ...spawn, ...selected } } : { reason: 'no_available_candidate', spawn };
  });
  return options.all ? result : result[0];
}
