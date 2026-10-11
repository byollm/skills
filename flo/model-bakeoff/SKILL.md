<!--
repo: byollm/skills
branch: decision-site-deep-dive
worktree: /Users/floleibert/dev/skills
origin-host: github.com
user: floleibert <floleibert@example.com>
signed: 2026-10-11T03:02:06Z
-->

# model-bakeoff

Run the same task on multiple models or harnesses and produce a judging
report. Same task, fresh state per contender, numbers in the report.

## When to use

"build X with flocode and opencode and compare", "run glm vs qwen vs a local
model on this task", "why did flocode take 5m vs 1m for codex", or any
head-to-head model/harness comparison.

## Workflow

1. **Fix the task** in writing before any run: the exact prompt, the target
   directory, the acceptance criteria. Every contender gets the identical
   prompt — a comparison with different prompts measures nothing.
2. **Fresh state per contender**: its own worktree/branch, clean environment,
   same model config where the model is the variable (or same harness where
   the harness is the variable — vary exactly one axis per bakeoff).
3. **Record per run**: start/end time, model + profile, harness + version,
   tool-call count, error count, retries, files changed, tests run and their
   result, and the final artifact.
4. **Judge on the artifact, not the transcript.** Score each contender on:
   does the artifact meet the acceptance criteria, do its tests pass, how
   much rework would a reviewer request. When a trajectory scorer is
   available (the judge repo's `cmd/score`), run it and include the quality
   and utility scores.
5. **Explain the deltas**: when one contender is faster, find where the time
   went (fewer tool calls? fewer retries? shorter reasoning?). When one
   fails, name the failing step. "Model A was faster" is the observation;
   the mechanism is the finding.
6. **Report**: one table (contender × metrics), the winner per criterion, the
   mechanism explanation, and the recommendation. Write it to a file, not just
   chat.

## Rules

- One variable per bakeoff. Model, harness, or prompt — never two at once.
- Never reuse a worktree between contenders.
- A contender that failed to produce an artifact still gets a row: failure
  mode is data.
- Do not rerun a contender because it lost. Rerun only on a harness fault
  that invalidated the run, and say so.
