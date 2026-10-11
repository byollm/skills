<!--
repo: byollm/skills
branch: decision-site-deep-dive
worktree: /Users/floleibert/dev/skills
origin-host: github.com
user: floleibert <floleibert@example.com>
signed: 2026-10-11T03:02:06Z
-->

# worktime-report

Answer "what did we actually ship" from git history and session logs, as a
single HTML report that opens from `file://`.

## When to use

"top features delivered in the last N hours", "what did we implement?",
"summarize my productivity", or any request to surface recent work across
repos.

## Workflow

1. **Collect from both sources** — neither alone is complete:
   - git: `git log --since='<window>' --pretty='%h %ad %s' --date=short` per
     repo, plus `git diff --stat` for size
   - sessions: user inputs in `~/.flocode/history/*.jsonl` (each line is
     `{"v":1,"e":"<input>"}`; skip slash-commands) and the session DB
     (`~/.flocode/session.db`, tables: sessions, messages, plans)
2. **Group by feature, not by commit.** Ten commits that land one PRD are one
   feature; the report names the feature, the PRD file if one exists, and the
   repos touched.
3. **Rank by impact**: user-visible changes first, then fixes, then chores.
   A commit message that says "fix" or "docs" is a fix or a chore — don't
   promote it.
4. **Generate a single self-contained HTML file** (no CDN, no build step,
   works from `file://`): a header with the window and repo list, one section
   per feature with its commits and a one-line outcome, and a stats strip
   (commits, features, repos, files changed). Dark theme, system fonts.
5. Write it to the requested path (default `<repo>/docs/reports/` or
   `~/dev/<name>-report/index.html`) and open it.

## Rules

- Every feature line cites its evidence: commit hashes or session ids. A
  feature with no evidence doesn't make the report.
- Distinguish "implemented" (tests pass / artifact exists) from "attempted"
  (commits exist, criteria unverified).
- The report is about work, not about the agent: no self-congratulation, no
  "the team leveraged" — name what changed and where.
- If the window spans multiple repos, say which repo each feature came from.
