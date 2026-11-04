# Durable loop procedure

## Bootstrap

Resolve the absolute path of `../../runtime/cli.mjs` from this skill directory.
The examples below use `lazytrae`; if no global binary exists, replace that prefix
with `node "/absolute/plugin/path/runtime/cli.mjs"`. Run in the target repository.
Use the current host session ID from the hook, or generate a UUID once and retain
it. Never reuse a completed session for unrelated work.

1. Inspect `ulw-loop status --session-id <id> --json`. A missing plan permits a new
   one; other errors require diagnosis. Existing plans must be resumed.
2. Write a brief containing the requested outcome and one bullet per coherent
   deliverable. Create the ledger with:

```sh
lazytrae ulw-loop create-goals --session-id <id> --brief-file brief.md --json
lazytrae ulw-loop complete-goals --session-id <id> --json
lazytrae ulw-loop status --session-id <id> --json
```

`complete-goals` selects or resumes a story; it does not certify completion.
Read `plan.activeGoalId`, the active goal's criteria, and `currentAttemptDir`.
Use `criteria --goal-id <goal-id>` to inspect individual criteria.

3. Replace placeholder scenarios and expected evidence using `steer` before
   doing implementation. For example:

```sh
lazytrae ulw-loop steer --session-id <id> --kind revise_criterion \
  --goal-id <goal-id> --criterion-id C001 \
  --scenario "CLI rejects a malformed input with exit 1" \
  --expected-evidence "captured command, exit status and stderr" \
  --evidence "public CLI contract" --rationale "make acceptance observable" --json
```

Revise every placeholder, including the edge and regression scenarios. Criteria
must describe the user's outcome rather than implementation details. Plan the
specific observations that could disprove completion.

## Execute and capture

Implement the active goal within scope. Preserve unrelated changes. Mirror
meaningful actions into the host plan and keep exactly one action in progress.
Delegate only if permitted, with explicit file ownership and a self-contained
brief. A worker's assertion is not evidence; inspect its deliverable.

Run real scenarios appropriate to the change. Save transcripts, screenshots or
data comparisons under `currentAttemptDir`, which changes on retry. Record each
criterion using the observation and artifact path:

```sh
lazytrae ulw-loop record-evidence --session-id <id> --goal-id <goal-id> \
  --criterion-id C001 --status pass --evidence "command, observed result, artifact path" --json
```

Use `fail` or `blocked` for unsuccessful observations. Never fabricate a transcript
or relabel stale artifacts. If code changes after verification, rerun the affected
checks. Track the verified revision/tree and any uncommitted changes honestly.

## Checkpoint

For intermediate goals, checkpoint with their actual status and evidence. The
last story additionally requires the upstream quality gate:

```sh
lazytrae ulw-loop checkpoint --session-id <id> --print-template --json
```

Read `qualityGateTemplate`, replace all placeholders, and write the gate JSON to
a file. The template is a schema, not passing evidence. It contains:

- `manualQa`: real surface observations, criterion references, adversarial cases
  and artifact objects with IDs, paths, kinds and descriptions.
- `gateReview`: review recommendation, real reportPath, findings and notes.
- `iteration`: commands actually rerun and their observed outcome.
- `criteriaCoverage`: counts and a reasoned assessment of original intent,
  desired outcome and user outcome, including adversarial classes.

Use `main-session` for self-review. If the user requests independent/strict
review and host delegation permits it, use installed lazytrae reviewer roles and
record their actual reports. Never invent a reviewer identity. Inspect all
artifacts before checkpointing. The gate rejects missing or empty files.

```sh
lazytrae ulw-loop checkpoint --session-id <id> --goal-id <goal-id> \
  --status complete --evidence "observed acceptance results" \
  --quality-gate-json gate.json --json
```

`--host-goal-json` is optional and accepts an actual host goal snapshot; omit it
when no host goal exists. Never submit the template's example as a real snapshot.
After checkpointing, inspect status and continue the next pending story. For a
failed attempt, record the failure and use `complete-goals --retry-failed` only
when the user still wants the work. On unresolved blockers, report them.

## Resume and stop

After compaction read the brief, goals, ledger and status. Continue from recorded
state; do not recreate the plan or use `--force` to clear a failure. Steering and
scope changes go through `steer`, preserving an audit trail.

An explicit pause/cancellation or a host budget limit stops execution immediately.
The plugin's Stop continuation is off by default. Do not enable it to evade a
host stopping condition. Mark a host goal complete only after the repository
ledger and all requested delivery work are complete. Report checks, results,
remaining limitations and the evidence location.
