---
name: comment-checker
description: "Review newly added comments for misleading, redundant or stale explanations."
---

# comment-checker

Read [host conventions](../../HOST.md). Inspect comments in the actual diff. Preserve explanations of invariants, non-obvious tradeoffs and external contracts. Remove only misleading or redundant prose within the requested scope.

The bundled checker can provide hints through PostToolUse hooks. Treat hints as review input, not automatic proof. Check behavior and tests after any edit.

Automated hints require an installed comment-checker executable selected by
`LAZYTRAE_COMMENT_CHECKER`. Without it the hook is a no-op; perform the requested
review directly. Do not install dependencies or claim an automated check ran
without verifying availability and output.
