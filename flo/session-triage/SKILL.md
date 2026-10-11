<!--
repo: byollm/skills
branch: decision-site-deep-dive
worktree: /Users/floleibert/dev/skills
origin-host: github.com
user: floleibert <floleibert@example.com>
signed: 2026-10-11T03:02:06Z
-->

# session-triage

Turn a pasted crash, stack trace, stuck-session report, or garbled-screenshot
description into a diagnosis: what broke, why, and what stops it from
happening again.

## When to use

The operator pastes a panic, a stack trace, a TUI screenshot description, a
session id, or asks "why did this session die / why is it stuck / what caused
the crash". Also when a session id is named and its outcome is unknown.

## Workflow

1. Read the pasted material before touching anything. Extract every concrete
   anchor: session id, goroutine stack, file:line pairs, build string, error
   class, timestamps.
2. Map stack frames to source. For each `file.go:NNN` in the trace, open that
   file around that line in the matching repo checkout. Name the function and
   what it was doing. If the line numbers don't match the checkout (different
   build), say so and use the build string from the trace to find the right
   commit.
3. Pull the session's own records:
   - `sqlite3 ~/.flocode/session.db "select * from sessions where id='<id>'"`
   - the session log: `~/.flocode/logs/<id>.log` (gzip; `zcat`)
   - `~/.config/flocode/tui.log` for TUI-side failures
4. Classify the failure into exactly one of:
   - **model** — endpoint unreachable, 400/429 from the provider, tool-choice
     config errors
   - **harness** — nil deref in flocode/amesh code, deadlock, output-limit
     truncation, wallclock kill
   - **environment** — port conflicts, fd exhaustion, missing socket, stale
     process holding a worktree
   State which class and the evidence line that puts it there.
5. Write the diagnosis in three parts, in this order:
   - **Cause** — one paragraph, named functions and file:line.
   - **Fix** — the smallest change that stops this failure. If it needs a PRD,
     say so and offer to draft it.
   - **Prevention** — the guard, test, or check that would have caught it
     (e.g. a nil check, a regression test name, a preflight probe).
6. If the evidence is incomplete, list exactly what's missing and where it
   would come from. Do not guess a cause to fill the gap.

## Rules

- Quote the exact error lines you base claims on. No paraphrasing that drops
  detail.
- Separate what you verified (you opened the file, ran the query) from what
  you inferred.
- A stuck session often has two causes stacked (e.g. an endpoint down plus a
  retry loop that never exits). Name both if both are present.
- Never end at "the session died." End at the file:line and the fix.
- If the operator asked for a PRD only ("PRD only no code changes"), write the
  diagnosis into a PRD and change no code.
