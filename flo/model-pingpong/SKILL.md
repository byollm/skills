<!--
repo: byollm/skills
branch: decision-site-deep-dive
worktree: /Users/floleibert/dev/skills
origin-host: github.com
user: floleibert <floleibert@example.com>
signed: 2026-10-11T03:02:06Z
-->

# model-pingpong

Run two models in alternating implementer/reviewer roles on a PRD, with the
endpoint-failure recovery protocol built in.

## When to use

"pingpong", dual-model implementation, or any run where one model implements
and a second model gates every task at review.

## Setup

- **Implementer** and **reviewer** are two different model profiles (e.g.
  GLM-5.2-fp8 implementing, Qwen-3.6-35b reviewing).
- Each run gets its own worktree and branch. Never share main.
- The PRD is the source of truth. The implementer reads it before writing
  anything.

## The loop

1. Implementer picks the next PRD slice: writes the failing test, confirms it
   fails for the right reason, writes the minimum implementation, gets the
   test green, commits with a message naming the slice.
2. Reviewer inspects the diff, runs the tests, and either fixes small issues
   itself or rejects back to the implementer with the exact file + behavior
   to change.
3. Repeat until every acceptance criterion in the PRD holds, proven by a
   command or file diff.

## Recovery protocol (endpoint down)

When the implementer or reviewer dies with `model endpoint unreachable` /
`preflight endpoint probe failed`:

1. Do not abandon the work. File changes are saved. Re-probe:
   `flocode models probe <profile> --timeout 3s`. If it returns ok, re-run —
   the failure was transient.
2. If the primary host is down, try the alternate host for the same model.
   The two GLM hosts fail independently; when one is down the other is
   usually up.
3. If both endpoints of a model are unreachable, swap roles: the reviewer
   becomes the implementer and vice versa. The work continues.
4. Three consecutive failures on the same task: stop, report the endpoint as
   down, move to the next ready task.

## Recovery protocol (wallclock kill)

`wallclock exceeded 110%` / `wallclock deadline expired` is the budget
enforcer killing the run, not a code bug. The task is requeued and committed
work is safe. Recovery: re-claim the task (fresh budget), commit after every
slice rather than at the end, and split any slice too big for the budget.

## Rules

- Always `git add -A && git commit` before a model swap or re-claim.
  Uncommitted work is lost on a wallclock kill.
- The turn boundary is idempotent: a failed turn re-sent will not duplicate
  file writes that already landed.
- The implementer's job is to write code, not read files. Eight inspect-only
  batches without an edit is a stall — name it and force the edit.
- The reviewer gates every task at needs_review; nothing merges unreviewed.
