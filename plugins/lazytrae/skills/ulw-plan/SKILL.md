---
name: ulw-plan
description: "Prepare an implementation plan when explicitly asked to plan before coding, use ulw-plan, or break down a project."
---

# ulw-plan

Read [host conventions](../../HOST.md). Explore the current repository and constraints. Resolve implementation questions from code and documentation before asking the user. Ask only for missing decisions that materially affect the outcome.

Write a plan under `.omo/plans/` with: original intent, acceptance criteria, affected files and interfaces, ordered tasks with dependencies, verification commands, and remaining owner decisions. Match detail to risk. Planning-only requests do not authorize product edits.

For an explicitly requested rigorous review, use available planning reviewers to challenge feasibility and gaps. Otherwise self-review the plan against the request. A later request to implement authorizes execution through ulw-execute; do not keep the user stuck in planning mode.
