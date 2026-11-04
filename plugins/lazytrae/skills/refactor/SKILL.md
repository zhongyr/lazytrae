---
name: refactor
description: "Refactor an existing implementation while preserving observable behavior and platform constraints."
---

# refactor

Read [host conventions](../../HOST.md). Define the behavior to preserve, the motivating problem and the allowed scope. Inspect callers and existing tests before proposing structural changes.

Choose the smallest useful refactor. Preserve proven platform-specific behavior. Add a regression check only for a credible failure not already covered. Make changes in coherent units and run the relevant checks after each. Compare the final behavior against the original contract; report any intentional differences before claiming completion.
