<!--
repo: byollm/skills
branch: decision-site-deep-dive
worktree: /Users/floleibert/dev/skills
origin-host: github.com
user: floleibert <floleibert@example.com>
signed: 2026-10-11T03:02:06Z
-->

# prd-factory

Scaffold a PRD in the house format, run the adversarial review pass, and track
it to completion. The format below is the one this operator's PRDs already
use; do not invent a different structure.

## When to use

Any request that starts a feature, a fix campaign, or a "make a PRD first".
Also when an operator asks to implement from an existing PRD: read it fully
first, it is the source of truth.

## The format

```
docs/prds/<slug>-prd-YYYY-MM-DD.md

# <Title>

## Problem        — what hurts today, with a concrete example
## Goal           — the end state, testable
## Non-goals      — what this PRD deliberately does not do
## How            — the technical approach, file:line ground truth for every
                    claim about current code
## UX             — what the operator sees and clicks
## §7 Gap table   — surface, current owner, gap, fix (one row per gap)
## Delivery plan  — TDD slices, each slice = red test → green impl → refactor
                    → focused test run → commit
## Acceptance     — every criterion checkable by a command or a file diff
```

## Workflow

1. Read the current code before writing. Every claim about existing behavior
   carries a file:line citation. If a claim can't be cited, it goes in an
   "Open questions" list instead of the body.
2. Write the PRD in the format above. Keep non-goals honest — they are what
   the reviewer attacks first.
3. **Adversarial review pass** (mandatory before implementation): re-read the
   PRD as a hostile reviewer. For each flow in "How", walk it end-to-end and
   look for: the error path nobody handled, the API contract that doesn't
   hold on the second invocation, the race, the resource limit, the security
   hole. Write findings as numbered blockers/majors with the fix folded back
   into the PRD. Record what changed.
4. Implementation runs slice by slice per the delivery plan. A slice is not
   done until its focused tests pass and it is committed with a message naming
   the slice.
5. **Wiring rule**: a feature is not done until it runs in the production
   path. The grep test: `grep -rn '<NewSymbol>' --include='*.go' | grep -v
   _test.go` must show real call sites, not just the definition plus tests.
   Type + tests with no call site is dead scaffolding.
6. On completion, mark each acceptance criterion with the command that proves
   it and its result.

## Rules

- The PRD is the source of truth during implementation. If reality disagrees
  with it, stop and amend the PRD first, then continue.
- One PRD, one concern. A PRD that merges two defects must name the shared
  root cause or split.
- No slice gets skipped because "it's small". Small slices get small commits.
