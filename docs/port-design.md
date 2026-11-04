# Port design

The fork keeps LazyCodex's generated plugin as a pinned input and generates a
separate TRAE plugin. Updating upstream is a deliberate operation: update the
input and provenance, review the adapter transformations, regenerate, and rerun
the boundary tests. Do not overwrite `plugins/lazytrae` manually.

The Node entrypoint invokes the modular goal engine, not the upstream Codex CLI.
The adapter preserves storage and quality-gate schemas while replacing the
model-facing goal handoff and optional-driver advice. Session scope remains
mandatory. State is repository-local under `.omo` to retain upstream compatibility.

TRAE's native plugin loader discovers the agent Markdown files. Each role uses
`model: inherit`; the installer delegates plugin registration to `traecli` and
does not need to merge TOML, create user roles or modify any model settings.

Hooks accept the TRAE JSON event protocol, tolerate absent optional fields, and
normalize shell payload aliases before calling upstream engines. The workflow
hook only activates on an explicit leading ultrawork request. Stop continuation
is opt-in and bounded. Cancellation markers contain no prompt content and are
scoped by a hash of workspace and session ID under plugin data.

LSP uses TRAE user/project config and a plugin-scoped daemon directory. The Git
Bash transport is kept alive on non-Windows systems so diagnostics remain
available; the upstream platform check still protects Windows-only execution.
Both servers use the real MCP protocol and retain the upstream runtime code.

The adapter excludes components that manage a different host: bootstrap, updater,
telemetry, Codex agent defaults, trust provisioning and spawn enforcement. This
also avoids chaining two independent goal continuation systems by default.

The seven imported utility skills keep their substantial upstream resources.
Their host-conventions link explains how to translate tool examples and how to
handle absent capabilities. Thirteen orchestration/integration skills have
maintained TRAE entrypoints instead of contradictory Codex/OpenCode headers.

No claim is made that this harness improves a given model. To evaluate that,
compare the same model/version, repository snapshots, task set, budgets, tools,
retry policy and grading procedure against stock TRAE. Include completion rate,
regressions, total cost, elapsed time and user interventions.
