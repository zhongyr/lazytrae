---
name: lazytrae-doctor
description: "Diagnose LazyTrae installation, roles, hook trust, session state and MCP connectivity."
---

# lazytrae-doctor

Read [host conventions](../../HOST.md). Run `lazytrae doctor` if the CLI is installed, otherwise run the checkout's `node bin/lazytrae.js doctor`. Validate the installed plugin with `traecli plugin validate lazytrae@lazytrae-local` (or its actual marketplace name).

In a fresh session inspect /skills, /agents, /hooks and /mcp. A hook that is untrusted must be reviewed through the host UI; never stamp trust hashes. Inspect the reported TRAE_HOME/TRAECLI_HOME paths without dumping credentials or complete user config.

For ledger issues run the bundled runtime `ulw-loop status --session-id <id> --json`. Preserve the existing state. Report the exact failed boundary and next corrective step. Do not reinstall Codex or auto-update upstream to mask a compatibility bug.
