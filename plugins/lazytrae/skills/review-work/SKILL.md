---
name: review-work
description: "Review a diff or completed implementation for correctness, regressions, scope and evidence."
---

# review-work

Read [host conventions](../../HOST.md). Establish the target revision, base revision and user criteria. Read repository instructions and the relevant code around the diff. Trace behavior across interfaces and identify realistic failure cases.

Run targeted checks when useful. Distinguish a reproduced failure from a hypothesis. For each finding give severity, file/line, concrete trigger, impact and a repair direction. Do not invent issues to fill a quota. For an explicitly requested independent review, delegate a bounded review when host rules allow it.

Save review artifacts in currentAttemptDir for an active loop. Otherwise present findings directly. Do not edit code or approve an external PR unless requested.
