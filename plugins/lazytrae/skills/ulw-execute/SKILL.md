---
name: ulw-execute
description: "Implement an existing plan using evidence and recoverable progress when asked to execute, start work, or use ulw-execute."
---

# ulw-execute

Read [host conventions](../../HOST.md). Read the requested plan and local instructions. Identify already completed work and verify its evidence; resume the first incomplete task instead of starting over.

For a substantial multi-step plan, use [ulw-loop](../ulw-loop/SKILL.md). Keep acceptance criteria and dependencies aligned with the plan. Make the smallest correct change for each unit, test the changed behavior, and capture concrete results. Use available workers for independently owned scopes when delegation is authorized, applying [model routing](../../MODEL_ROUTING.md) and the user's model restrictions before spawning.

Review the final diff, run required project checks and fulfill the requested delivery (including an already-authorized commit or PR). Report any remaining blockers, never mark them complete. Stop immediately on cancellation.
