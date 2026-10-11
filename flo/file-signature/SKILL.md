<!--
repo: byollm/skills
branch: decision-site-deep-dive
worktree: /Users/floleibert/dev/skills
origin-host: github.com
user: floleibert <floleibert@example.com>
signed: 2026-10-10T23:45:44Z
-->

# file-signature

Stamp every file with a provenance signature comment at the top: git repo,
branch, worktree, origin host, and user. Keep signatures current as files
change. The signature answers one question anywhere a file is found: **where
does this file stem from?**

## When to use

ALWAYS. This skill triggers on every session and every file-touching task.
There is no "off" case: any file you create or modify gets a signature, and
any file whose signature is stale gets it refreshed.

## The signature

A comment block at the very top of the file, before any other content:

```
repo: <repo>
branch: <branch>
worktree: <worktree path>
origin-host: <host>
user: <git user.name> <<git user.email>>
signed: <ISO-8601 UTC timestamp>
```

Comment syntax per file type:

| Type | Syntax |
|---|---|
| Python, JS, TS, Go, Rust, C, Java, shell, YAML, TOML | `#` lines |
| HTML, XML, Markdown | `<!-- ... -->` |
| CSS, JS-in-HTML | `/* ... */` |
| JSON | JSON has no comments — do not sign JSON files; note this in your reply |
| Files with a required first line (shebang, `<!DOCTYPE html>`, XML prolog) | Signature goes on the line immediately after the required first line |

## How to sign

1. Collect the facts with one shell call:
   ```sh
   git rev-parse --show-toplevel && git branch --show-current \
     && git remote get-url origin && git config user.name && git config user.email
   ```
   - repo: the `owner/name` parsed from the origin URL (fall back to the
     top-level directory name if no origin).
   - origin-host: the hostname parsed from the origin URL (e.g. `github.com`,
     `gitlab.mycompany.com`). `github:...` shorthand → host `github.com`.
   - worktree: absolute path of the git worktree root (`git rev-parse --show-toplevel`).
   - branch: current branch; `(detached)` if HEAD is detached.
   - user: `git config user.name` + `user.email` (worktree config first, then global).
   - If the file is outside any git repo: sign with `repo: (none)`, `branch: (none)`,
     `origin-host: (none)`, `worktree: (parent dir)`, and the user from global
     git config if set.
2. Insert or refresh the signature:
   - **New file:** signature first, then content.
   - **Existing signed file:** replace the old signature block in place. Never
     duplicate signatures; one block per file, always at the top.
   - **Existing unsigned file:** insert the signature at the top, above existing
     content (after a required first line). Do not otherwise modify the file.
3. **Update on change:** whenever you modify a file that carries a signature,
     refresh its `signed:` timestamp (and repo/branch/worktree/origin-host/user
     if the file moved or the repo changed) as part of the same edit.
4. Never let a signature touch code semantics: it is a comment, nothing more.
   Do not sign generated files, lockfiles, `node_modules`, or binary files.

## Rules

- One signature per file, at the top, as a comment.
- Refresh on every modification — a stale signature is a bug.
- The signature must never be the only change you make to a file; it rides
  along with real edits (or a deliberate re-sign when facts changed).
- When a task says "don't touch file X", don't re-sign X either.
- If signing would break a consumer (e.g. a strict parser that rejects leading
  comments), skip the signature and say so in your reply.

## Verification

After signing, `head -8 <file>` must show the signature block. In a session,
spot-check at least one signed file this way before reporting done.
