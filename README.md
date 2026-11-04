# LazyTrae

[LazyCodex](https://github.com/code-yeongyu/lazycodex) workflows and evidence loops,
adapted for **TRAE CLI**. Independent fork; no Codex installation required.

LazyTrae adds 20 skills, 12 agent roles, configurable role-to-model routing,
project-rule and workflow hooks, the upstream durable goal/evidence engine, and
bundled LSP/Git Bash MCP servers. It preserves your parent model and permissions;
permitted child tasks can use available models selected by the routing policy.

The **0.1.1** release includes the complete plugin runtime. It is not a benchmarked performance improvement
over stock TRAE, Codex, Claude Code or OmO.

## Install

Requires Node.js 20+ and a working `traecli` command. Tested with TRAE CLI 0.213.1
on macOS. Linux runtime tests run in CI; Windows support is not yet validated.

```sh
npm install -g lazytrae --registry=https://registry.npmjs.org/
lazytrae install
lazytrae doctor
```

The npm package bundles the generated plugin and its runtime dependencies.
Installing it requires no repository clone, source build or upstream submodule
checkout. Plugin registration happens when you run `lazytrae install`.

Open a **new TRAE session** and inspect `/skills`, `/agents`, `/mcp` and `/hooks`.
Review and trust the plugin's hooks through `/hooks` before expecting automatic
triggers. The installer never writes trust hashes, user agent files, model
defaults or concurrency settings. Skills remain usable before hooks are trusted.

Alternatively use the native marketplace:

```sh
traecli plugin marketplace add https://github.com/zhongyr/lazytrae.git --name lazytrae
traecli plugin install lazytrae@lazytrae
traecli plugin validate lazytrae@lazytrae
```

The npm/source installer uses `lazytrae@lazytrae-local`; the marketplace route uses
`lazytrae@lazytrae`. Use the corresponding name for native validation/removal.

## Use

Examples to give TRAE:

```text
ulw: fix the parser bug and verify the public CLI behavior.
Use lazytrae:ulw-plan to plan this migration before changing code.
Use lazytrae:ulw-execute to implement .omo/plans/migration.md.
Use lazytrae:review-work to review this diff for regressions.
Use lazytrae:lsp to find the callers of this symbol.
```

Ordinary tasks do not automatically start a loop. For substantial work,
`ulw-loop` maintains a brief, goals, acceptance criteria and append-only evidence
ledger in `.omo/ulw-loop/<session-id>/`. Its final checkpoint verifies the supplied
QA/review artifacts and criterion coverage. A host goal is optional and only
created on explicit user request; user budgets remain authoritative.

Use the installed `lazytrae` command, or `node bin/lazytrae.js` from the checkout:

```sh
lazytrae ulw-loop help
lazytrae ulw-loop status --session-id YOUR_SESSION_ID --json
lazytrae ulw-loop checkpoint --session-id YOUR_SESSION_ID --print-template --json
```

The plugin skills resolve their bundled Node runtime directly, so a global npm
installation is optional. Legacy `codexGoal*` JSON keys remain for upstream state
compatibility; they do not launch Codex. `--host-goal-json` and `--host-goal-mode`
are aliases for the corresponding legacy CLI flags.

## What is ported

| Capability | LazyTrae behavior |
| --- | --- |
| Ultrawork, plan, execute, research | TRAE-native workflows with explicit scope and evidence |
| Durable goal loop | Upstream engine: session isolation, steering, criteria, retries and quality gates |
| Worker/explorer/planner/reviewer roles | 12 plugin-contained roles; available-model routing with inheritance fallback |
| Project rules and comment checking | TRAE event adapters; automated comment checking requires an optional binary |
| LSP | Bundled MCP daemon; config under `.trae`, existing language servers required |
| Git Bash | Windows execution; diagnostic tools on macOS/Linux, where the host shell handles commands |
| Frontend, programming, debugging, data science, ast-grep, Git, evaluation integrity | Upstream skills/resources with TRAE host conventions |
| Review, refactor, repository guidance, installation diagnostics | Adapted skill entrypoints |

Browser automation, dedicated team mode, coding-session history tools, the
upstream slop-removal workflow and upstream bug-report/contribution automation
are not currently ported. Browser/ast-grep/Python/language-server binaries are
not bundled. Remote search MCPs, telemetry, auto-update, Codex bootstrap, forced
model-default changes, spawn enforcement and the unlimited-budget hook are excluded.
Automatic per-edit LSP checks are omitted; use the LSP tools explicitly.

## Model routing

For permitted delegation, the orchestrator resolves the selected role before
calling TRAE's native spawn tool. The quality-first default prefers
`DeepSeek-V4.1-Flash` for code/document research, `GPT-6-Astra` for
small/standard implementation, and `GPT-6.1-Sol` for complex implementation/planning/review.
It tries available candidates in order and inherits when none is available.
These are configurable preferences, not benchmark results.

```sh
lazytrae models route --all
lazytrae models route --role lazytrae-worker-high --provider trae --model Kimi-K3
lazytrae models route --role lazytrae-worker-high --inherit
```

Explicit user model choices take precedence and are validated. Native role
files retain `model: inherit`; older hosts and full-history forks use inheritance.
The parent model, host defaults and effort are preserved. The active spawn
schema's model list is authoritative; use `--available-models <json-file>` for
that snapshot, otherwise the resolver queries `traecli models --json`.

Read [model routing](plugins/lazytrae/MODEL_ROUTING.md) for ordered candidates,
custom providers, configuration precedence and dispatch integration.

Project rules load from `.trae/rules`, `.omo/rules`, `.claude/rules`,
`.cursor/rules`, `.github/instructions`, `CONTEXT.md` and Copilot instructions.
Global rules and bundled model personas are not injected by default. For automated
comment hints, set `LAZYTRAE_COMMENT_CHECKER` to an installed
[`comment-checker`](https://github.com/code-yeongyu/go-claude-code-comment-checker)
executable before starting TRAE. Without it, the comment skill remains available
for manual review and the hook is a no-op.

Stop continuation is off by default. Set `LAZYTRAE_CONTINUE=1` when starting TRAE
to opt into a bounded reminder for unfinished ledger work. It honors
`stop_hook_active` and records interruptions/cancellation to suppress reminders.
Use explicit `ulw:` again to resume. Host goals are the preferred persistence
mechanism when explicitly requested. The plugin never extends a user budget.

## Update and remove

```sh
npm install -g lazytrae@latest --registry=https://registry.npmjs.org/
lazytrae install
lazytrae uninstall
npm uninstall -g lazytrae
```

Reinstallation refreshes the local plugin. Removal delegates to TRAE and keeps
repository evidence and user configuration. For a marketplace installation use
`traecli plugin marketplace upgrade lazytrae`, `traecli plugin upgrade lazytrae@lazytrae`
and `traecli plugin uninstall lazytrae@lazytrae` instead.

## Development and validation

To work on the source or install a development build:

```sh
git clone https://github.com/zhongyr/lazytrae.git
cd lazytrae
node bin/lazytrae.js install
```

```sh
npm ci
npm run build
npm test
npm run test:host  # requires traecli; isolated homes and a local dummy provider
npm run pack:dry-run
```

- `plugins/omo/`: unchanged input pinned to LazyCodex commit
  `4b08788096abee8e2d728cfb122ac46a57a16c56` (OmO 5.1.60).
- `adapter/`: maintained TRAE runtime, skills and host handoff.
- `scripts/build-plugin.mjs`: explicit reproducible transformations.
- `plugins/lazytrae/`: generated, installable plugin and release payload.
- `test/`: real CLI, evidence-gate, MCP transport, tarball and native-host tests.
- `upstream/` and `test/upstream/`: archived upstream documentation/workflows and
  alias tests. Upstream publishing and website deployment are disabled here.

See [port design](docs/port-design.md) and [validation](docs/validation.md).
Keep the upstream input unchanged and regenerate the port after adapter edits.
Runtime dependencies are bundled; the root package has no npm dependencies.
See the [release procedure](docs/releasing.md) for publishing to npm.

## License

MIT, with original LazyCodex/OmO attribution retained. Bundled resources may have
their own accompanying licenses; see [NOTICE](NOTICE) and the component files.
