<!--
repo: byollm/skills
branch: decision-site-deep-dive
worktree: /Users/floleibert/dev/skills
origin-host: github.com
user: floleibert <floleibert@example.com>
signed: 2026-10-11T03:02:06Z
-->

# release-cut

Walk the release checklist for flocode/amesh: token, build, artifact
verification. Report the version with evidence, not a claim.

## When to use

"cut a new release", "generate a token", "generate a preauthorized token",
"did you cut a local version?", or any release/build-speed work on these
repos.

## Workflow

1. **Pre-flight**: repo clean (`git status --short` empty), on the intended
   branch, HEAD recorded. If the tree is dirty, stop and report — a release
   from a dirty tree is not reproducible.
2. **Token** (when the flow needs one): generate via the repo's token
   command. A preauthorized token skips the interactive grant. Record the
   token's scope and TTL in the report, never the token itself.
3. **Build**: run the repo's release build exactly as its docs specify
   (Makefile target or script). Capture the build string it prints
   (`<version>-flomac-local (<commit>, <date>)`).
4. **Verify the artifact actually exists**: the binary in the expected
   location, `--version` answering with the new build string, and the
   artifact's commit hash matching HEAD. A release that wasn't verified was
   not cut.
5. **Report**: version, commit, artifact path, verification command and its
   output. If anything in the chain failed, report the failing step and stop
   there — do not half-release.
6. **Build speed** (when asked): measure before changing anything
   (`time make <target>`), then change one thing, re-measure. Report both
   numbers. Never trade a check for speed without saying which check got
   dropped.

## Rules

- The build string is the evidence. "Done" without it is a claim.
- Never push a release tag on a dirty or unverified tree.
- If the release flow differs between flocode and amesh, follow each repo's
  own docs; do not assume they match.
