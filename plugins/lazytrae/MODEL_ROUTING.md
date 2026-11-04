# TRAE model routing

LazyTrae resolves ordered role preferences into TRAE spawn arguments. Agent
Markdown still uses `model: inherit` so older hosts and intentional inheritance
continue to work. The orchestrating agent calls the resolver and supplies its
output to the native spawn tool; this is not a hook that rewrites tool arguments.
Delegation must already be allowed by the active host instructions.

| Profile | Roles | First candidate |
| --- | --- | --- |
| fast | explorer, librarian | DeepSeek-V4.1-Flash |
| standard | worker-low, worker-medium, qa-executor | GPT-6-Astra |
| deep | worker-high, plan, metis, momus, all reviewers | GPT-6.1-Sol |

Full ordered candidates live in [model-routing.json](model-routing.json). These
are configurable preferences, not measured claims about cost or quality. Names
are matched exactly against the available provider/model pairs; any current or
future model can be used in a configuration or explicit override.

Use `node /absolute/plugin/path/runtime/cli.mjs` in place of `lazytrae` when the
global command is absent:

```sh
lazytrae models route --role lazytrae-explorer
lazytrae models route --all
lazytrae models route --role lazytrae-worker-high --provider trae --model Kimi-K3
lazytrae models route --role lazytrae-worker-high --inherit
```

A selected model returns:

```json
{
  "reason": "role_mapping",
  "spawn": {
    "agent_type": "lazytrae-explorer",
    "fork_turns": "none",
    "model_provider": "trae",
    "model": "DeepSeek-V4.1-Flash"
  }
}
```

Pass `spawn` together with a self-contained `task_name` and `message` to the
native collaboration tool. Check the active schema first: if model overrides
are absent, omit them; if a permitted role is absent, follow HOST.md's role
fallback. A deliberate `--fork-turns all` returns inheritance. Positive partial
history counts are accepted by hosts that expose them. Effort inherits by
default; model difficulty does not imply an effort setting.

The resolver queries `traecli models --json` at invocation time. In sessions
whose spawn schema advertises its own available models, use that list instead:

```json
[
  { "provider": "trae", "name": "DeepSeek-V4.1-Flash" },
  { "provider": "trae", "name": "GPT-6.1-Sol" }
]
```

Save it to a session-local JSON file and pass `--available-models <file>`. The
TRAE CLI's `config_name` and `backend_model` fields are not spawn names. A
supplied empty list is authoritative and returns inheritance; malformed supplied
catalogs fail. A failed CLI catalog lookup returns `catalog_unavailable` without
overriding the parent model. Recheck the actual spawn schema before dispatch.

## Configuration and precedence

Use `--config <file>`, `LAZYTRAE_MODEL_CONFIG`, or plugin data's
`model-routing.json` (normally `$TRAE_HOME/plugins/data/lazytrae/model-routing.json`),
in that order. Installation never creates this file or edits TRAE model defaults.
Partial policies merge with bundled defaults; replaced candidate arrays retain
their supplied order. For example:

```json
{
  "version": 1,
  "roles": {
    "lazytrae-worker-high": [
      { "model_provider": "trae", "model": "DeepSeek-V4-Pro" },
      { "model_provider": "trae", "model": "GPT-6-Astra" }
    ],
    "lazytrae-librarian": "deep",
    "lazytrae-qa-executor": "inherit"
  }
}
```

Profiles can be replaced or added through `profiles`, with arrays of the same
provider/model pairs. Set `mode` to `inherit` for global inheritance. Explicit
CLI provider/model choices take precedence over policy mode and role preferences;
explicit `--inherit` takes precedence over policy preferences. Combining those
two requests or combining an explicit model with full history fails. Unknown
roles, invalid profiles and unavailable explicit models fail with exit 1 and a
structured error. Automatic routing tries candidates in order, then inherits.

When a selected model is rejected at actual dispatch because availability has
changed, refresh the session catalog and resolve again before a child starts.
Do not replay a task that is already running or queued. Stop on authentication
or permission failures; those are not evidence that another model is available.
