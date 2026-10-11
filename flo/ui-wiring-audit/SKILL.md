<!--
repo: byollm/skills
branch: decision-site-deep-dive
worktree: /Users/floleibert/dev/skills
origin-host: github.com
user: floleibert <floleibert@example.com>
signed: 2026-10-11T03:02:06Z
-->

# ui-wiring-audit

Trace every button and action in a UI to its handler and verify the chain
actually fires. Dead wiring is the defect class this skill exists to find.

## When to use

"figure out if buttons and actions are properly working from a wiring
perspective", or a bug report shaped like "I press the button and nothing
happens" / "the buttons are greyed out and the form says incomplete".

## Workflow

1. **Inventory the interactive surface**: every button, menu item, keyboard
   shortcut, and clickable control in the target view. For a TUI, the key
   bindings and command handlers; for web, the `onclick`/`addEventListener`
   targets; for SwiftUI/AppKit, the action selectors.
2. **Trace each control end-to-end**:
   - the widget exists and is rendered
   - the event reaches a handler (name the function)
   - the handler's guard conditions (enabled/disabled state, validation
     gates) — a control disabled by a validation that can never pass is the
     classic dead-wiring bug
   - the handler's action runs and produces a visible effect
3. **Classify each break**:
   - **unwired** — no handler at all
   - **gated dead** — handler exists, a guard makes it unreachable (e.g. the
     "Invite is incomplete" validation that never clears because a field is
     read from the wrong state)
   - **fires but no-ops** — handler runs, the action silently fails or writes
     nowhere
   - **wired but stale** — handler calls a function that moved or was renamed
4. **Fix order**: unwired and stale first (they break whole flows), then
   gated-dead (confusing, blocks users), then no-ops.
5. **Regression test per fix**: a test that drives the control (or calls the
   handler with the gating state) and asserts the effect. A wiring fix
   without a test will regress on the next refactor.
6. Report as a table: control, view, status (wired / unwired / gated-dead /
   no-op / stale), handler, fix.

## Rules

- Trace the code path; do not click around and guess. The wiring is in the
  source.
- A control that works in one entry path but not another (keyboard vs mouse,
  fresh vs restored state) counts as broken — test both paths.
- Check the download/run logic for local models as its own pass when the UI
  manages local models: install buttons that don't install are this exact
  defect class.
