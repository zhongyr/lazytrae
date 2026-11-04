# LazyTrae host conventions

Use only tools present in the active TRAE session. Host instructions and explicit
user scope, budget, permissions and cancellation take precedence over workflows.
The plugin supplies role-to-model preferences for permitted delegation. It never
changes the parent model, host model defaults, permissions or concurrency.

For shell work use the host's shell tool. For plans use `update_plan`. For child
agents inspect the actual schema: V2 takes `task_name`, `message`, optional
`agent_type`, `fork_turns`, and on current TRAE `model_provider`, `model` and
`reasoning_effort`. Use `fork_turns: "none"` with a specialized role.
Use `send_message` for context, `followup_task` to wake an idle child, and
`wait_agent` for mailbox activity. A wait timeout is not failure. Never call
OpenCode `task`, `call_omo_agent`, `team_*`, `background_output`, or Codex V1
examples literally. When translating a skill list, include it in the message.

Delegate only when permitted by the active host instructions and useful for a
bounded independent task. Installed roles are prefixed `lazytrae-`: worker-low,
worker-medium, worker-high, explorer, librarian, plan, metis, momus, code-reviewer,
qa-executor, gate-reviewer, clone-fidelity-reviewer. Their native role files use
`model: inherit` as a compatibility fallback; model selection is carried in the
spawn call when the host supports overrides.
Check available roles before selecting one; if unavailable, do the work locally
or use an available role with a self-contained brief.

Before a permitted LazyTrae delegation, select the exact role, then run the
bundled runtime's `models route --role <agent_type>`. The default policy prefers
Flash for code/document research, GPT-6-Astra for small/standard implementation,
and GPT-6.1-Sol for complex implementation/planning/review. Read
[model routing](MODEL_ROUTING.md) for the
ordered candidates, configuration and CLI examples. This workflow explicitly
requests the policy's model override, subject to the user's model restrictions.

The ACTUAL spawn schema and its session model list are authoritative. If they
provide a model list, save those exact pairs as a JSON array of `{ "provider":
"...", "name": "..." }` and pass `--available-models <file>`; do not substitute
CLI configuration aliases. Otherwise the resolver queries `traecli models
--json`. Use the returned `spawn` fields, plus the assignment's `task_name` and
`message`, only after checking that the fields/pair exist in the active schema.
Reuse a snapshot within a wave; refresh it if the schema/catalog changes.

Explicit user provider/model choices take precedence: pass `--provider` and
`--model` to validate them. Honor a user request to keep the parent model with
`--inherit`. With no override fields, a custom-provider restriction not expressed
in the policy, or deliberate full-history forks, inherit instead. Never send
unsupported fields. Full-history forks cannot carry model/effort overrides;
conflicting explicit requests require clarification rather than silently changing
the requested model. An unavailable explicit model is an error; do not silently
replace it. Candidate exhaustion or catalog lookup failure returns inheritance.
Difficulty labels do not set `reasoning_effort`; leave it inherited unless the
user requests an effort supported by the actual schema and selected model.

The runtime is `runtime/cli.mjs` relative to this file. Invoke it with Node using
an absolute path; `lazytrae` is equivalent when this repository is installed with
`npm install -g lazytrae`. Never download an OmO/Codex executable to resolve that name.
All stateful `ulw-loop` commands require `--session-id <id>`. Use the session ID
from the hook; if unavailable create a UUID and retain it for the entire run.

The repository ledger lives in `.omo/ulw-loop/<id>` for upstream compatibility.
Its `codexGoal*` JSON fields and `--codex-goal-*` flags are legacy schema names,
not a requirement to run Codex. `--host-goal-json` and `--host-goal-mode` are
aliases. The host goal is optional: create it only on explicit user request and
honor the requested budget. Never resume a paused/limited goal automatically.

Git and LSP MCP servers are bundled; browser, computer-use, web search, ast-grep,
Python and language servers depend on the host and local installation. Do not
claim those tools exist until discovered. Use CLI alternatives when available.
LSP user configuration is under `$TRAE_HOME/lsp-client.json`; project config is
`.trae/lsp-client.json`. Install language servers only within authorized scope.
Git Bash command execution is Windows-only. On macOS/Linux its MCP exposes
diagnostics; use the host shell for Git and other commands.

The host requires hook trust. Installation never writes trust hashes. Review
the plugin hooks in `/hooks`. Stop continuation is disabled by default; an
explicit `LAZYTRAE_CONTINUE=1` opts into a single reminder (`stop_hook_active`
prevents repeated blocking). Interrupt never blocks. Remote MCP search services,
telemetry, Codex bootstrap and auto-update hooks are not included.
