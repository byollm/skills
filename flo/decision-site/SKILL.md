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

Skill files: `SKILL.md`, `template.html` (engine), `test.mjs` (harness),
`open-site.sh` (opens the finished site in the browser), `examples/`.

The file contains three sections behind a sticky nav:

1. **Decisions** — one card per open decision. Each card shows the question,
   the options stacked as rows with ⓘ pros/cons tooltips (the PRD's proposed default is tagged "proposed"), an "About this problem" popover, an
   **"Other…" freeform option** with a text input for a custom answer, and an
   OPEN/DECIDED status. Clicking an option decides it. "Accept all proposed
   defaults" and "Reset" buttons. A progress counter (n/total decided).
   An empty freeform answer counts as OPEN and falls back to the proposed
   default in the prompt (flagged in the NOTE line).
   **Every card ALWAYS carries a deep dive** (see "Deep dive" below): the
   problem with real code references, at least two before/after examples,
   a pro/con matrix over every option, and an inline SVG graphic.
2. **Mockups** — one mock per flow/screen in the source doc. Each mock is a
   card with a title bar (file/screen it belongs to), a visual rendering of
   the screen, and a **comment box** (name + text, appends timestamped
   comments below the mock). Mockups have a **select for prompt** toggle:
   the generated prompt only includes the selected mocks (all selected by
   default). Submitted comments on selected mocks are included in the prompt
   as indented bullets under the mock.
3. **Prompt** — a button that generates the prompt via JavaScript from the
   current state: verified facts (if the source doc has them), every decision
   (decided value, freeform text, or "OPEN — use proposed default"), the
   selected mockups with their comments, scope, and constraints. Output is a
   textarea with a Copy button. The prompt must be concise — decisions as
   one-liners, comments as bullets, no prose padding.

**Persistence (required).** All state — decisions, freeform text, submitted
comments, unsubmitted comment drafts, and mock selection — is saved to
`localStorage` on every change and restored on load. Nothing is lost when
navigating between tabs, re-rendering, or reloading the page. Unsubmitted
drafts survive re-renders because `renderMocks()` restores draft values into
the form inputs. Key: `decision-site:<SOURCE_DOC>`.

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

`dive.problem` (trusted HTML narrative) is a different field from the
`problem` popover object (plain-text what/when/why/impact, see "Explanations
are REQUIRED"); a decision carries both. `opts` entries may be strings or
`{t, tip}` objects; the matrix needs one row per option either way.

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

## Explanations are REQUIRED (tooltips + explainers)

Every decision must be explainable without leaving the page. Write in easy
English: short sentences (about 15 words max), a concrete example, no jargon
without a one-line gloss. The operator should be able to decide from the page
alone.

**Options are stacked** one under another (full-width rows), not inline chips.
Each option carries an ⓘ tooltip (hover, keyboard focus, or click/tap; Esc or
outside click closes it):

```js
opts: [
  { t: "Option label",
    tip: { what: "What this choice means, in plain words.",
           pros: ["honest upside", "another upside"],
           cons: ["real cost or risk", "another cost"] } },
  ...
]
```

Plain strings still work (no tooltip). Pros and cons must be honest trade-offs
(risk, effort, test cost, behaviour change), never marketing. The proposed
default is marked "proposed".

**Each decision has an "About this problem" popover** with four blocks:

```js
problem: {
  what:   "What went wrong, in one or two short sentences.",
  when:   "When it was found/happened (date, PR, file:line).",
  why:    "The root cause in plain words.",
  impact: "What happens to users/agents if it is not fixed.",
  // only when the problem is complex:
  link: "explain-D1.html", linkLabel: "Open the interactive explainer"
}
```

**Interactive explainers.** If a problem is complex (state machines, timelines,
dependency graphs, anything where seeing it move helps), also write a sibling
single-file page `explain-<id>.html` and set `problem.link`. It must be
self-contained (no CDN), dark palette, with real controls the reader can drive
(sliders, step buttons, toggles for each option) and a "Back to decisions"
link. See `examples/explain-example.html`. Skip the link for simple problems.

Rules: the engine hides the popover on resize/scroll by design; the link is
only rendered for http(s)/relative URLs (never `javascript:`); tooltips are
`position:fixed` and flip to stay on screen. The test harness covers
`optText`, tooltip content, and link rendering.

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

If the source doc lacks any of these, generate sensible ones from its content
and note it in the site header.

## Process

1. Read the source doc fully. List decisions, facts, flows, constraints.
   For every decision, gather what the deep dive needs: the exact code
   locations, measured numbers, two or more concrete examples, the trade-offs
   of each option, and what the graphic should show.
2. Write tooltip content (`tip`, `problem`) AND the deep dive (`dive`) for
   every decision, plus an `explain-<id>.html` for each complex one. Then write
   the HTML file: skeleton + CSS first, then sections, then the
  DECISIONS/MOCKS data + render/prompt logic in vanilla JS.
3. Run the functional test harness against the generated file's engine
   (see test.mjs — freeform, draft persistence, comment-to-prompt, reload
   persistence, reset, deep-dive rendering and validation). At minimum:
   syntax-check the embedded JS (extract `<script>` and `new Function(...)`),
   verify a submitted comment appears in the generated prompt, and verify
   `validateDecisions()` returns no errors for the real DECISIONS (every card
   has a problem, >= 2 examples, a full pro/con matrix and an SVG graphic).
4. **MANDATORY: open the site.** After the tests pass, run
   `flo/decision-site/open-site.sh <index.html>` (resolves the absolute path,
   opens the right browser opener for macOS/Linux/WSL/Git-Bash, and prints the
   absolute `file://` URL as its last line). Open it when the first working
   version passes the tests and again when the build is finished; during
   multi-iteration builds do not reopen on every iteration, tell the operator
   to refresh the tab. Skip opening only if the operator asked not to (`--no-open`)
   or the session has no GUI (the script detects this and just prints the URL).
   Either way, always report the absolute path/URL in your reply.
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

## Non-goals

- No server, no persistence — state lives in the page; refreshing resets.
  (Decisions are meant to be walked once and exported as the prompt.)
- No mobile app-grade responsiveness; it must look good at ≥760px.
