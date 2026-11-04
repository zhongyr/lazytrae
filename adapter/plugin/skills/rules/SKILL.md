---
name: rules
description: "Inspect and use LazyCodex project rule matching through the TRAE adapter."
---

# rules

Read [host conventions](../../HOST.md). Inspect the project rule files and their
frontmatter directly. Hooks load rules on session start, user prompts and matching
tool activity; follow the injected rules within their scope. The bundled `rules`
CLI exposes hook handlers, not an interactive rule editor.

Diagnose missing rules by checking hook trust, rule paths, frontmatter and match conditions. Do not rewrite host instructions or claim a rule loaded without checking runtime output.
