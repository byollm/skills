# PRD — GitHub publish from decision-site

## Problem

The decision-site skill ends with "Generate prompt → Copy". The operator then
pastes it into a chat or an issue by hand. The outcome of a grilling session
should land where the work happens: as a GitHub issue or a pull request on the
repo the decisions concern.

## Goal

From the generated site, in the browser, with one click each:

1. **File an issue** whose body is the generated prompt.
2. **Open a PR** that commits the updated site (state baked in) plus a
   markdown export of the decisions, with the prompt as the PR body.
3. **Copy** as offline fallback.

No backend, no build step. The site stays a single HTML file that works from
`file://`.

## Non-goals

- No OAuth flow / GitHub App. PAT entered by the operator, stored in
  localStorage only.
- No fork-based flow. Branch is created on the target repo directly.
- No reading/writing anything beyond: issues, contents, pulls, refs.

## How (technical)

GitHub's REST API supports CORS with a PAT in the `Authorization` header, so a
static page can call `api.github.com` directly. (CORS from a `file://` origin
must be smoke-tested in Chrome/Safari/Firefox before shipping; if a browser
blocks it, the Copy fallback covers that case.)

- Config: `gh = { repo, branch }` in localStorage. **The token is kept in
  `sessionStorage` only** — re-entered per session, never in `saveState()`,
  never in the exported HTML. A "forget token" button clears it. Residual
  risk (any script on the page can read it) is documented in SKILL.md.
- `ghTest()` — `GET /repos/{repo}`: validates token AND repo access (GitHub
  returns 404, not 403, for private repos the token can't see) and reads
  `default_branch` as the base-branch fallback.
- `ghCreateIssue(title, body)` — `POST /repos/{repo}/issues`. Body capped at
  65,000 chars; over that, truncated with a pointer to `decisions.md`.
- `ghCommitFile(branch, path, content, message)`:
  1. `GET /repos/{repo}/git/ref/heads/{base}` — 404 on an empty repo →
     fall back to committing straight to the default branch via
     `PUT /contents` (auto-creates the initial commit).
  2. Branch `decision-site/<yyyymmdd-hhmmss>-<rand4>`: `GET /git/ref/heads/{b}`
     first — 404 → `POST /git/refs`; existing → reuse.
  3. `GET /repos/{repo}/contents/{path}?ref={branch}` — if the file exists,
     its `sha` goes into the PUT (otherwise every re-publish 422s).
  4. `PUT /repos/{repo}/contents/{path}` with base64 content.
  - 409/422 conflicts: retry once (re-read ref, re-PUT), then surface the
    error. Files over 1MB: refuse with a clear message (Contents API limit).
- `ghOpenPR(head, title, body)` — `POST /repos/{repo}/pulls`.
- `serializeSite()` — `'<!DOCTYPE html>\n' + document.documentElement.outerHTML`
  after clearing runtime DOM (#cards, #mocks, #doc, #chatlog, #out, input
  values) and injecting `<script id="baked-state">window.BAKED_STATE={…}</script>`
  with the full state object. On load, `BAKED_STATE` seeds state when
  localStorage is empty. Round-trip fidelity is test-enforced.
- `exportMarkdown()` — the generated prompt as `decisions.md`.
- Rate limits: parse `X-RateLimit-Remaining` / `Retry-After` on 403/429 and
  show a friendly back-off message.

## UX

New **Publish** tab:

- Config row: token (session-only), repo (owner/name), base branch. "Test"
  button → `GET /repos/{repo}` shows the repo name + default branch
  (validates token AND access) — same pattern as the Assistant tab.
- **File issue** button: title = task line, body = generated prompt.
  Confirmation step shows repo + title before posting.
- **Open PR** button: branch `decision-site/<yyyymmdd-hhmmss>-<rand4>`,
  commits `index.html` (serialized) + `decisions.md`, opens PR with prompt as
  body. Confirmation shows repo, branch, files. Result shows the issue/PR URL
  as a link.
- Per-decision "file issue" link on each card: pre-filed issue for that one
  decision (deep dive as body), behind the same confirmation step.
- No token configured → buttons degrade to Copy with a note.

## Security

- Token in sessionStorage only: re-entered per session, cleared by "forget
  token", never in `saveState()` or `serializeSite()` (both test-enforced).
- Residual risk documented in SKILL.md: any script running on the page can
  read sessionStorage; the page renders some operator HTML (doc edits), so
  the doc-edit path escapes untrusted content before innerHTML.
- Fine-grained PAT, single repo, Contents RW + Pull requests RW + Issues RW.
  SKILL.md notes: org repos may require org approval of fine-grained PATs;
  404 on Test usually means the repo is not in the token's allowlist.
- All writes behind a confirmation step.

## Tests

- mock `fetch` in the vm: assert branch → commit → PR call order and payloads.
- existing-file path: PUT includes the SHA from the prior GET contents.
- branch collision: existing ref is reused, not re-created.
- empty repo: base-ref 404 → commit goes to the default branch.
- issue body contains the generated prompt.
- `serializeSite()` output contains baked state and no token.
- degradation: no token → copy path, no fetch calls.

## Open questions

- Commit both `index.html` and `decisions.md`, or only one? (Default: both.)
- PR base branch default: repo default branch, or configured? (Default:
  configured, falls back to `main`.)
