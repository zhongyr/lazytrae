# Validation for 0.1.0

Local validation used Node.js 20.19.6 and TRAE CLI 0.213.1 on macOS. All host
installation tests used temporary TRAE_HOME/TRAECLI_HOME directories; the user's
live TRAE/Codex configuration was not modified.

`npm test` covers seven integration scenarios:

1. A release tarball can create a ledger without the source checkout or npm dependencies.
2. Unscoped commands are rejected and two sessions keep separate state.
3. Hook payloads preserve ordinary tasks and explicit budgets; continuation is
   opt-in, bounded, and suppressed after interruption/cancellation.
4. TRAE project rules load, deduplicate, and recover after compaction.
5. Final checkpoints reject missing proof and accept real captured CLI
   observations and review artifacts without a host goal.
6. Git Bash MCP initializes, lists tools and returns real diagnostic output.
7. LSP MCP initializes, lists tools and returns real status output.

`npm run test:host` exercises the actual TRAE CLI: install twice, validate the
20 skills / 2 MCP servers / 10 hooks, inspect the model-visible prompt for roles
and skills, list hook definitions through the app server, verify that they remain
untrusted, uninstall, and verify the capabilities disappear. Existing user model
settings, a personal role and repository evidence are preserved. A local dummy
provider permits prompt inspection without an inference request or credentials.

All 20 skills also passed the skill frontmatter validator. A fresh agent followed
the loop skill on a separate greeting-CLI fixture, implemented the requested
behavior, exercised 11 CLI cases twice, and completed a ledger with 3 passed
criteria and a final quality gate. That pass found a runtime-path typo and two
misleading upstream status messages; the adapter and regression checks were fixed.

These checks establish integration behavior, not a model-quality benchmark.
The native host test verifies hook discovery and trust preservation; hook behavior
is exercised with protocol payloads separately. No user's hook trust was bypassed.
Actual language-server diagnostics, the optional comment-checker binary, browser
automation and native Windows execution are outside this validation.

GitHub Actions runs the build, generated-output check and runtime/package tests
on Linux and macOS with Node.js 20 and 24. The native TRAE host suite is local-only
because the public CI runner does not ship TRAE CLI.
