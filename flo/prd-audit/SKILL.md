<!--
repo: byollm/skills
branch: decision-site-deep-dive
worktree: /Users/floleibert/dev/skills
origin-host: github.com
user: floleibert <floleibert@example.com>
signed: 2026-10-11T03:02:06Z
-->

# prd-audit

Score PRDs for completeness and correctness, and produce a completion matrix
with concrete evidence. This is the audit half of prd-factory — it judges
existing PRDs, it does not write them.

## When to use

"Audit the PRDs from the last N days", "score the last N PRDs", "find the
top N PRDs and calculate completion percentage", or any request to check
whether PRD work actually landed.

## Workflow

1. **Collect the corpus**: every PRD file under `docs/prds/` (or the named
   directory) inside the window. List them with dates before scoring.
2. **Score each PRD on two axes**:
   - **Completeness** — does the PRD have: a testable goal, non-goals,
     file:line ground truth for claims about current code, a delivery plan,
     acceptance criteria checkable by command or diff.
   - **Correctness** — do its claims about current code still hold? Spot-check
     the file:line citations against the checkout. A PRD whose citations have
     drifted is marked regressed, not wrong.
3. **Produce the completion matrix**, one row per PRD:

   | PRD | Status | Evidence |
   |---|---|---|
   | <file> | implemented / partial / untouched / regressed | commands run, files changed, tests passing |

   Status definitions:
   - **implemented** — every acceptance criterion holds, proven by command
   - **partial** — some criteria hold; name the ones that don't
   - **untouched** — no code references the PRD's symbols
   - **regressed** — held once, now fails; cite the failing check
4. **Evidence is concrete or it doesn't count**: a test name and its result,
   a grep showing call sites, a file diff. "Looks done" is not evidence.
5. **Rank the gaps**: order the non-implemented PRDs by impact (users touched,
   severity of the defect, blockers unblocked). For the top gaps, propose the
   next action per gap (one slice of work, a PRD amendment, or a close-out).
6. Write the matrix to a durable location (the repo's `docs/reports/` or the
   requested path), not just the chat.

## Rules

- Read the PRD fully before scoring it. A skim produces a wrong status.
- The wiring rule applies: a PRD whose symbols exist but have no production
   call sites is partial at best (dead scaffolding).
- Never mark implemented on the PRD's own claims — run the checks.
- If two PRDs overlap, name the overlap; one may absorb the other.
