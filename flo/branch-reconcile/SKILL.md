<!--
repo: byollm/skills
branch: decision-site-deep-dive
worktree: /Users/floleibert/dev/skills
origin-host: github.com
user: floleibert <floleibert@example.com>
signed: 2026-10-11T03:02:06Z
-->

# branch-reconcile

Audit the repo's loose ends — unmerged branches, stashes, dirty worktrees,
outstanding PRs — classify each as ready or WIP, and merge the ready ones in
a safe order.

## When to use

"git merge all branches into main", "what PRs are outstanding?", "are any
changes stashed?", "commit and push", or any end-of-campaign cleanup.

## Workflow

1. **Audit first, merge never blindly.** Collect:
   - `git branch --format='%(refname:short) %(objectname:short)'` — every
     local branch with its head
   - `git log main..` per branch — commits not in main
   - `git stash list`
   - `git status --short` in every worktree (`git worktree list`)
   - `gh pr list` (or the remote's PR list) for open PRs
2. **Classify each branch**:
   - **ready** — tests pass, one coherent concern, no conflicts with main
   - **WIP** — failing tests, half a slice, or a commit message that says
     "wip"
   - **stale** — fully merged already, or superseded by another branch
   Never merge a WIP branch to satisfy the request. Name the WIP branches and
   what they're missing instead.
3. **Propose the order**: stale branches deleted (after naming them and
   getting a go-ahead), ready branches merged oldest-first, one merge + test
   run + commit per branch. Conflicts stop the line — surface them, don't
   force.
4. **Execute** on go-ahead: merge one branch, run the focused test suite,
   commit, next. If a merge breaks tests, revert that merge and report.
5. Stashes: show each stash's diff summary before applying. Applying a stash
   is its own step with its own verification, never folded into a merge.
6. Finish with `git push` only after every merged branch is green. Report:
   branches merged, branches left WIP with reasons, stashes applied or left,
   final status.

## Rules

- The audit table comes before any mutation. The operator approves the plan,
  then the merges run.
- A branch with a `safety/` or `backup/` prefix is never deleted without an
  explicit instruction.
- If the shell blocks a loop over branches (dangerous-command filter), fall
  back to one command per branch — do not work around the filter.
- Never merge with uncommitted changes in the worktree. Commit or stash first.
