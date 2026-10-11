<!--
repo: byollm/skills
branch: decision-site-deep-dive
worktree: /Users/floleibert/dev/skills
origin-host: github.com
user: floleibert <floleibert@example.com>
signed: 2026-10-11T03:02:06Z
-->

# perf-hunt

Find one high-impact performance issue, fix it, and prove the delta with
numbers. One issue per hunt; converge on measurements, not opinions.

## When to use

"find one high-impact issue in tool usage, context compaction, or request
latency", "why is X slow / truncating / stalling", RedQueen-style convergence
runs, or any request to improve the agent loop itself.

## Workflow

1. **Pick one deliberately small target** — one package, one tool path, one
   latency source. A broad repo-wide hunt is the wrong shape; refuse it and
   narrow instead.
2. **Baseline before touching anything.** Record: start time, model, branch,
   session id, tool-call count, error count, retries, stalls, context size,
   total latency. A table row per run:

   | run | task | model | duration | tool calls | errors | files changed | tests | result |
   |---|---|---|---|---|---|---|---|---|
3. **Diagnose from logs and traces, not the TUI.** The visible output hides
   retries and stalls; `~/.flocode/logs/<session>.log` and the session DB
   show them. Separate model mistakes (malformed tool calls, wrong tool
   choice) from harness mistakes (probe failures, truncation, queue stalls).
4. **Fix one thing** — prefer a small harness/prompt/tool-routing fix over a
   rewrite. Re-run the same task from a fresh state. Compare against baseline
   with the same metrics.
5. **Converge**: iterate until two consecutive fresh runs show zero
   tool-format errors, no repeated no-progress tool cycle, no branch/worktree
   drift, latency ≤ baseline, tool calls ≤ baseline, and a final summary that
   separates "looked at" from "changed".
6. **Report**: baseline metrics, changes made, before/after table, remaining
   risks, and the recommended default policy going forward.

## Rules

- Do not narrow the task after the baseline to hide a failure. The baseline
  stands.
- One lucky run is not convergence. Two consecutive clean runs or a documented
  blocker.
- If no code change is needed, say why and still show the run evidence.
- No unrelated refactors ride along, even small ones.
- Do not declare success on a metric you didn't measure.
