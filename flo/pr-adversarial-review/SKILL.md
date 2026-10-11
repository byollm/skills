<!--
repo: byollm/skills
branch: decision-site-deep-dive
worktree: /Users/floleibert/dev/skills
origin-host: github.com
user: floleibert <floleibert@example.com>
signed: 2026-10-11T03:02:06Z
-->

# pr-adversarial-review

Review a PR through four independent tracks, then reconcile. Each track must
find new issues with file/line citations or justify soundness — "looks fine"
is rejected.

## When to use

"adversarial review of PR #N", "evaluate a pull request submitted by another
agent", or any high-stakes PR that needs more than one pair of eyes.

## The four tracks

Run all four independently — separate subagent tasks, no shared findings
until the arbiter pass:

1. **Correctness & Architecture** — logic errors, concurrency, resource leaks,
   unsafe defaults, edge cases, and designs that won't scale. Flag any
   use-case-specific coupling in code meant to be generic as a defect.
2. **Performance** — profile-driven findings only: allocations, blocking I/O,
   redundant work, hot-path latency. Numbers, not vibes.
3. **Security** — injection, auth gaps, credential handling, fail-open paths.
   Every finding comes with a fail-closed fix.
4. **UX** — responsiveness, state handling, error surfaces, platform idioms,
   everything user-facing.

## Rounds

- Each round, every track surfaces **new** issues with exact file/line
   citations, or explicitly justifies soundness with a reason.
- Cross-check the other tracks' claims skeptically — a wrong finding is worse
   than none.
- **Arbiter pass**: merge findings, resolve conflicts between tracks, and
   reject fixes that trade one track's win for another's regression.
- Converge only when all four tracks sign off. Two clean rounds in a row is
   the floor, not the target.

## Output

Findings table: track, severity, file:line, issue, proposed fix, status
(fixed / rejected-with-reason / deferred). The arbiter's reconciliation notes
go at the bottom — which findings conflicted and how they were resolved.
