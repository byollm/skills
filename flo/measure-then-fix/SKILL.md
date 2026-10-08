# measure-then-fix

Before choosing between candidate fixes (or rules, defaults, thresholds), measure
them against what really happened: replay recorded session logs through each
candidate and count the outcomes. Decide on the numbers, then fix with
test-first, using the replayed cases as the regression tests.

## When to use

- Two or more plausible designs disagree (a strict rule vs a loose one, two
  parsers, two thresholds, two retry policies) and the argument so far is
  opinion.
- A bug or guard fires on agent-written input: shell commands, tool arguments,
  prompts, patches, file paths. Real sessions are a free corpus of that input.
- You are about to tune a limit (iteration cap, timeout, retry budget, probe
  interval) and recorded sessions can show where it bites.

Skip it when there is one obvious correct behaviour (a spec says so), when no
recorded data exists and cannot be generated cheaply, or when the change is
trivial and reversible. Say which, in one line, and move on.

## Principles

1. **Measure before you argue.** A number from real sessions beats an opinion.
2. **Check the data has the signal before you build on it.** Grep a sample first.
   (We assumed a tool's own logs had the commands. They only had tool names, so
   the corpus had to come from the agent transcripts instead.)
3. **Deterministic first, model last.** Extract, normalise and count with scripts.
   Use an LLM only to label the residue a script cannot decide.
4. **The model labels; ground truth decides.** Every label is checked against an
   oracle (a parser, `bash -n`, a test, a compiler) or a human-checked sample.
   Report the model's agreement rate with the oracle. Never let the model pick
   the winner.
5. **Replay on a clean checkout of the base.** Build candidates on a throwaway
   worktree so results do not depend on the branch you were editing.
6. **Keep raw logs out of git.** They hold secrets and private paths. Commit only
   small, redacted, minimal fixtures.

## Process

1. **State the decision and the candidates.** One sentence each. Name the metric
   that would make you pick one (for example: false rejections of valid input,
   false acceptances of invalid input, latency, retries, wasted turns).
2. **Find the data.** Likely sources:
   - Claude Code transcripts: `~/.claude/projects/<project-path>/*.jsonl`
     (full tool inputs and results).
   - FloCode logs: `~/.flocode/logs/*.log` (JSONL; check first whether it logs
     the field you need; tool names and metrics often yes, command text no).
   - Any other agent's session store, CI logs, or test output.
   Sample 1-3 files and grep for the field before extracting anything.
3. **Extract a corpus, deterministically.**
   `scripts/extract-tool-calls.sh <tool> '<jq select on input>' <transcripts...>`
   writes JSONL of `{session, ts, id, input, is_error, result}`. Report counts
   per project and per month. Dedupe by normalised input.
4. **Define the oracle.** Examples: `bash -n` for shell syntax, the project's
   real parser, the compiler, the existing test suite, a recorded outcome
   (`is_error`). Run the oracle over the whole corpus once and store its verdict.
5. **Replay each candidate.** Write a throwaway harness (a Go test, a script) on a
   clean worktree of the base. For each corpus item record each candidate's
   verdict next to the oracle's. Output a table: candidate x {correct, false
   accept, false reject}, plus the list of disagreements between candidates.
6. **Label the residue with a model, supervised.** Only the items where the
   candidates disagree and the oracle is silent.
   - Give the model the item, the question, and a strict output schema.
   - Run a sample against the oracle or by hand; compute agreement. If it is low,
     fix the prompt or label by hand. Do not proceed on unchecked labels.
   - Record which model and route ran (a route that fails auth is a finding, not
     something to silently replace).
7. **Report.** One page: decision, candidates, corpus (sources, size, date range),
   oracle, results table, model-label agreement, what the data cannot tell you,
   recommendation. Lead with the answer.
8. **Then fix, test-first.** Turn the disagreement items into table-driven
   regression tests (redacted, minimal). Watch them fail on the base, then pass.
9. **Record the decision** in the PR description with the numbers and where the
   corpus came from (not the raw logs).

## Gotchas

- Transcripts are large (hundreds of MB). Stream with `jq`; never load whole files
  into memory or into a model context.
- Tool-result text can be truncated or reformatted. Check that the result field
  you rely on is the real one.
- A proxy corpus is still a proxy: commands written for one tool's shell may
  differ from another's. Say how close the proxy is.
- Selection bias: sessions where a tool failed may be over- or under-represented.
- `ls` on a log directory with 100k files fails ("Argument list too long"); use
  `find ... -print0 | xargs -0`.
- Headless CLI calls in agent harnesses need `< /dev/null` and `timeout -k`.
- Never put secrets, tokens or personal paths in committed fixtures.

## Output template

```
DECISION: <what is being chosen>
CANDIDATES: A=<...>  B=<...>
CORPUS: <sources, N items, date range, how extracted>
ORACLE: <what decides ground truth>
RESULTS:
            correct  false-accept  false-reject
  A            ..        ..            ..
  B            ..        ..            ..
DISAGREEMENTS: <n> (<k> labelled by model, agreement with oracle <p>%)
LIMITS: <what this data cannot show>
RECOMMENDATION: <A|B|neither> because <numbers>
```

## Worked example: two heredoc rules (2026-10-07)

**Decision.** FloCode had two heredoc-aware "unmatched closing delimiter" checks
on main that disagreed. A (executor): skip a heredoc body only when its delimiter
is quoted. B (agent preflight): skip every heredoc body. Which one should both use?

**Corpus.** 1,146 real agent-written Bash commands containing `<<`, extracted from
Claude Code transcripts of three projects (563 + 418 + 165), 25 sessions,
2026-09-08 to 2026-10-07. 0 duplicates. 921 use a quoted delimiter only, 171
unquoted only, 15 both. FloCode's own logs (76,004 files) were checked first and
could not be used: they record tool names and metrics, not command text.

**Oracle.** `bash -n` (bash 5.3 and 3.2) plus the observed outcome in the
transcript. All 1,146 commands pass `bash -n`, so every rejection is a false reject.

**Result.** A and B gave the same verdict on all 1,146 commands. The only
situation where they differ in principle (an unbalanced `}` `)` `]` inside an
*unquoted* body) occurs 0 times; 169 commands have a closing delimiter in an
unquoted body, all balanced. So the data does not separate the rules: choose on
risk, not on frequency. (A is closer to what bash does: text in an unquoted body
can run via `$(...)`.)

**What the corpus exposed instead** (worth more than the original question):
- One delimiter reject, and it has nothing to do with heredocs: an apostrophe in
  a `#` comment makes both scanners think a quote opened. Both rules share it.
- The executor's separate dangerous-command patterns rejected 35 of 1,146 valid
  commands (3.1%), mostly `\bformat\b.*[a-z]:` (27).

**Lessons.**
- The model-labelling step was not needed: with zero disagreements there was
  nothing to label. Do not run it for show.
- Check that the log you plan to mine contains the field. The tool's own logs did
  not; the agent transcripts did.
- State the proxy: these commands ran under another tool's shell, so they show what
  agents write, not what this executor rejected.
