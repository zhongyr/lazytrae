---
name: lsp-setup
description: "Diagnose or configure language servers for LazyTrae when the user requests LSP setup."
---

# lsp-setup

Read [host conventions](../../HOST.md). Discover the LSP MCP inventory and configuration tools. Inspect project language/toolchain and installed server versions. Use `.trae/lsp-client.json` for project configuration or `$TRAE_HOME/lsp-client.json` for user configuration.

Prefer existing servers. Before installing dependencies, determine whether the request authorizes it. Preserve unrelated configuration. Validate by opening a real project file, resolving a known symbol and producing a diagnostic for a controlled fixture. Report missing binaries or unsupported languages precisely.
