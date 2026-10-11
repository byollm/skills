# decision-site

Turn a grilling session (a list of open decisions with proposed defaults) into
a killer single-file website: interactive decision cards, mockup screens with
per-screen commenting, and a generator that combines every decision and
comment into one concise, copyable prompt.

## When to use

- You have a PRD / design doc with open decisions ("the grill list") and want
  the operator to walk them in a browser instead of a wall of markdown.
- You want mockups of the proposed flows, with the ability to leave feedback
  on individual screens.
- You want the outcome (decisions + mockup selection + comments) collapsed
  into a single prompt that can drive implementation in a fresh session.

## How it works

The skill generates ONE self-contained HTML file (no build step, no
dependencies, works from `file://`). Structure:

```
<output>/index.html
```

The file contains six sections behind a sticky nav:

1. **Decisions** — one card per open decision. Each card shows the question,
   the options (the PRD's proposed default is tagged "proposed"), an
   **"Other…" freeform option** with a text input for a custom answer, and an
   OPEN/DECIDED status. Clicking an option decides it. "Accept all proposed
   defaults" and "Reset" buttons. A progress counter (n/total decided).
   An empty freeform answer counts as OPEN and falls back to the proposed
   default in the prompt (flagged in the NOTE line).
   **Every card ALWAYS carries a deep dive** (see "Deep dive" below): the
   problem with real code references, at least two before/after examples,
   a pro/con matrix over every option, and an inline SVG graphic — plus a
   **comment thread on the graphic** (name + text, timestamped, persisted,
   included in the generated prompt under GRAPHIC COMMENTS).
2. **Document** — the source doc split into paragraphs, grouped by section.
   Every paragraph is `contenteditable`: click to edit, saved on every
   keystroke, marked `edited` when it differs from the original. Edited
   paragraphs flow into the generated prompt as DOCUMENT EDITS. Reverting a
   paragraph back to the original text clears the flag.
3. **Mockups** — one mock per flow/screen in the source doc. Each mock is a
   card with a title bar (file/screen it belongs to), a visual rendering of
   the screen, and a **comment box** (name + text, appends timestamped
   comments below the mock). Mockups have a **select for prompt** toggle:
   the generated prompt only includes the selected mocks (all selected by
   default). Submitted comments on selected mocks are included in the prompt
   as indented bullets under the mock.
4. **Assistant** — an embedded chat panel wired to a local LLM via the
   OpenAI-compatible `/v1/chat/completions` API (works with vLLM, llama.cpp,
   LM Studio, Ollama's `/v1`, and GLM local servers). The model receives the
   full page state (decisions, options, current values, mocks, doc paragraphs)
   as its system prompt and can CHANGE the page via `[ACT]` action lines:
   `decide <id> <n>`, `decide-free <id> <text>`, `select-mock <id> <bool>`,
   `edit-doc <id> <text>`, `comment-mock <id> <name> <text>`,
   `comment-graphic <id> <name> <text>`. Applied actions are shown as green
   ✓ lines under the reply and mutate the live DOM/state like a user click.
   **When the skill is first initialized, ask the operator which model server
   to wire in** (e.g. the local qwen or GLM server: URL + model name) and bake
   the defaults into the site's chat config. If no server is reachable, the
   panel degrades to a clear note — the site stays fully functional without
   a model.
5. **Publish** — file the outcome straight to GitHub from the browser:
   **File issue** posts the generated prompt as an issue; **Open PR** creates a
   branch `decision-site/<timestamp>`, commits the serialized site (state baked
   in via `window.BAKED_STATE`) plus a `decisions.md` export, and opens a PR
   with the prompt as the body. Config: fine-grained PAT (Contents + Pull
   requests + Issues RW on the target repo), repo, base branch. The token is
   kept in `sessionStorage` only — per session, never in `saveState()` or the
   serialized site, with a "Forget token" button. No token → buttons degrade
   to Copy. All writes behind a confirmation dialog. Note for the operator:
   org repos may require org approval of fine-grained PATs, and a 404 on Test
   usually means the repo is not in the token's allowlist.
6. **Prompt** — a button that generates the prompt via JavaScript from the
   current state: verified facts (if the source doc has them), every decision
   (decided value, freeform text, or "OPEN — use proposed default"), graphic
   comments, document edits, the selected mockups with their comments, scope,
   and constraints. Output is a textarea with a Copy button. The prompt must
   be concise — decisions as one-liners, comments as bullets, no prose padding.

**Persistence (required).** All state — decisions, freeform text, submitted
comments, unsubmitted comment drafts, graphic comments and drafts, document
edits, mock selection, and the chat config + transcript — is saved to
`localStorage` on every change and restored on load. Nothing is lost when
navigating between tabs, re-rendering, or reloading the page. Unsubmitted
drafts survive re-renders because the render functions restore draft values
into the form inputs. Key: `decision-site:<SOURCE_DOC>`.

## Deep dive (required on every decision)

A one-line question with bare options is not enough for the operator to
decide. Each decision object carries a `dive` (rendered by `renderDive`,
checked by `validateDecisions`; the page shows a warning banner if any card
is incomplete, and the test harness fails):

```js
{ id, q, opts: [...], def,
  dive: {
    problem: "<p>…</p>",          // what goes wrong today, in plain words, with
                                  // real file:line refs and measured numbers
    examples: [                   // >= 2, concrete, from the source/codebase
      { title: "150-file rename after retrieval closes",
        before: "read pkg/f008.go  ✗ blocked (cap 8)",
        after:  "read pkg/f008.go  ✓ edited file stays readable" } ],
    matrix: {                     // one row per option, same order as opts
      criteria: ["Fixes the measured case", "Loop safety", "Complexity"],
      rows: [ { scores: ["good", "mid", "good"],   // good | mid | bad | short text
                pros: ["…"], cons: ["…"] }, … ] },
    graphic: { svg: "<svg viewBox=…>…</svg>",      // inline SVG only
               caption: "…" } } }
```

Rules for writing the deep dive:

- **Problem**: explain the mechanism, not just the symptom. Name the exact
  code location (`path:line`) and the constant or rule responsible. Quote a
  measured number when one exists ("8 of 150 readable", "stops at batch 4").
- **Examples**: at least two, ideally covering the common case and an edge
  case. Use real names, commands, paths and values from the source or the
  codebase, not placeholders. `before` is what happens today; `after` is
  what happens with the *proposed* option.
- **Pro/con matrix**: one row per option including the non-proposed ones.
  3–5 criteria that actually separate the options (e.g. fixes the measured
  case, safety/abuse resistance, complexity, latency/cost, reversibility).
  Every row needs at least one pro and one con — if an option has no con,
  say what it costs. The chosen option's cons are carried into the
  generated prompt as `accepts: …` so the implementer knows the trade-off.
- **Graphic**: one inline SVG per decision that shows the mechanism, for
  example a flow (request → guard → outcome), a timeline (iterations with
  where it stops today vs with the proposal), or a small bar chart of the
  measured numbers per option. Use the page palette (#58a6ff, #3fb950,
  #d29922, #f85149, #8b949e on #0b1016), `viewBox` sizing so it scales, text
  ≥ 11px, no external fonts/images, and a one-line caption.

## Design requirements (the "killer" part)

- Dark theme, GitHub-dark-adjacent palette (#0d1117 bg, #161b22 panels,
  #30363d borders, #58a6ff accent, #3fb950 ok, #d29922 warn, #f85149 bad).
- Monospace for codes, ids, URLs, statuses. Sans for prose.
- Sticky nav with active-tab underline. Cards with 8px radius, 1px borders.
- Mockups must look like real product screens (buttons, pills, rows, banners,
  states), not wireframe boxes. Use the source doc's actual field names,
  endpoint paths, and example values.
- Status colors: OPEN = warn yellow, DECIDED = green. Selected mock = accent
  border + check.
- No external assets, no CDN, no images. Inline SVG icons only if needed.

## Inputs

Read the source doc (usually a PRD) and extract:

- **Decisions**: id, question, options (first = proposed default unless the
  doc says otherwise).
- **Verified facts**: any claim the doc marks as verified, with dates/sources.
  These go into the prompt verbatim so the implementing session does not
  re-research.
- **Flows/screens**: each becomes a mockup. Use real names, real endpoints,
  real example data from the doc.
- **Scope/constraints**: security must-holds, patterns to follow, versioning
  rules.
- **Document paragraphs**: split the source doc into paragraphs
  (`DOC: [{id, section, html}]`) so the operator can edit them in place.

**Model wiring (autodetect, then ask).** When the skill is first initialized,
do not make the operator type a URL. Probe first, then suggest:

1. **amesh**: check `AMESH_DAEMON_URL` in the environment; if unset, try
   `http://localhost:18765`, `http://localhost:18766`, `http://localhost:17877`
   (typical amesh web/worker/local ports). An amesh daemon may expose or know
   about model runtimes — query its inventory if reachable.
2. **flocode**: check for a running flocode session (`flocode` process, or its
   local state dir) and any LLM endpoints it advertises.
3. **Common local LLM servers**: `curl -s -m 2 <url>/v1/models` against
   `http://localhost:8000` (vLLM/GLM), `:8080`, `:11434` (Ollama),
   `:1234` (LM Studio), `:56890`/`:57456`/`:61353`/`:6840` (common
   ephemeral node-server ports). A 200 with a JSON model list = found.
4. Also run `lsof -iTCP -sTCP:LISTEN -P` and probe any listener that answers
   `/v1/models` with JSON.

Then ask the operator: "Found these model servers: <list with model names>.
Wire one into the Assistant tab? (or paste another URL)". Bake the chosen
URL + model name into the site's chat config defaults. If nothing is found
or the operator declines, that is fine — the panel shows a clear note and
everything else works.

The generated site also has a **Detect** button in the Assistant tab that
re-runs this probe from the browser (same candidate list) and fills the
config — so the operator can wire a server in later without regenerating.

If the source doc lacks any of these, generate sensible ones from its content
and note it in the site header.

## Process

1. Read the source doc fully. List decisions, facts, flows, constraints.
   For every decision, gather what the deep dive needs: the exact code
   locations, measured numbers, two or more concrete examples, the trade-offs
   of each option, and what the graphic should show.
2. Write the HTML file: skeleton + CSS first, then sections, then the
  DECISIONS/MOCKS data + render/prompt logic in vanilla JS.
3. Run the functional test harness against the generated file's engine
   (see test.mjs — freeform, draft persistence, comment-to-prompt, reload
   persistence, reset, deep-dive rendering and validation). At minimum:
   syntax-check the embedded JS (extract `<script>` and `new Function(...)`),
   verify a submitted comment appears in the generated prompt, and verify
   `validateDecisions()` returns no errors for the real DECISIONS (every card
   has a problem, >= 2 examples, a full pro/con matrix and an SVG graphic).
4. Open the file in the browser for the operator.
5. Tell the operator: walk Decisions, review Mockups (comment + select), then
  Generate → Copy.

## Prompt format (generated)

```
<one-line task> per <source doc path> (read it first — it is the source of truth).

VERIFIED FACTS (do not re-research):
- ...

DECISIONS (from the grilling session):
- <id>: <chosen option>          // or "OPEN — use proposed default"
  accepts: <cons of the chosen option, from the pro/con matrix>
- ...

MOCKUPS TO BUILD (selected):
- <mock title> (<screen/file>)
  comments: - <name>: <text>     // only if commented

SCOPE: ...
CONSTRAINTS: ...
DELIVERABLES: ...
NOTE: n decision(s) still open (...). Proposed defaults used; flag in review.
```

## Writing style (anti-slop)

All prose the skill generates — dive problems, examples, captions, mockup
copy, the generated prompt — must read like a person wrote it. Banned:
delve, tapestry, pivotal, crucial, leverage, seamless, robust, testament,
underscore, moreover, furthermore, "It's worth noting", "At its core",
"Not X, but Y" parallel negation, tricolons, em-dash pileups, uniform
sentence length, hedging stacks. Prefer short direct sentences, concrete
numbers and file paths, and varied rhythm. If a sentence could appear in any
AI-generated doc, rewrite it.

## Non-goals

- No server, no persistence — state lives in the page; refreshing resets.
  (Decisions are meant to be walked once and exported as the prompt.)
- No mobile app-grade responsiveness; it must look good at ≥760px.
