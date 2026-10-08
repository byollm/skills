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

The file contains three sections behind a sticky nav:

1. **Decisions** — one card per open decision. Each card shows the question,
   the options stacked as rows with ⓘ pros/cons tooltips (the PRD's proposed default is tagged "proposed"), an "About this problem" popover, an
   **"Other…" freeform option** with a text input for a custom answer, and an
   OPEN/DECIDED status. Clicking an option decides it. "Accept all proposed
   defaults" and "Reset" buttons. A progress counter (n/total decided).
   An empty freeform answer counts as OPEN and falls back to the proposed
   default in the prompt (flagged in the NOTE line).
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
2. Write tooltip content (`tip`, `problem`) for every decision, and an `explain-<id>.html` for each complex one. Write the HTML file: skeleton + CSS first, then sections, then the
  DECISIONS/MOCKS data + render/prompt logic in vanilla JS.
3. Run the functional test harness against the generated file's engine
   (see test.mjs — freeform, draft persistence, comment-to-prompt, reload
   persistence, reset). At minimum: syntax-check the embedded JS
   (extract `<script>` and `new Function(...)`) and verify a submitted
   comment appears in the generated prompt.
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
