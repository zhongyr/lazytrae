---
name: lsp
description: "Use bundled LSP code intelligence for diagnostics, definitions, references and safe renames."
---

# lsp

Read [host conventions](../../HOST.md). Discover the `lsp` MCP tools exposed by the installed plugin. Use their actual schema and provide the target workspace where requested. Check language-server availability before claiming diagnostics ran.

Use definitions/references to understand callers before editing. For renames, preview affected symbols and inspect the diff. Rerun diagnostics after changes and distinguish pre-existing errors. Language-server installation and configuration remain explicit user-controlled actions. If the MCP is unavailable, diagnose its connection through `/mcp` or report the unavailable capability.
