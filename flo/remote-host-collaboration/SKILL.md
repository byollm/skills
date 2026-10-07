# remote-host-collaboration

Work on a remote Mac (e.g. `macbook-old` at `10.40.0.117`) over ssh for an
entire session: run commands, deploy binaries, keep services (launchd,
tmux) alive, and benchmark models — without losing turns to ssh's failure
modes.

## When to use

- Any multi-step task that drives a remote host: deploy + restart a
  launchd agent, run a model server in tmux, benchmark it, iterate.
- Any `ssh`/`scp`/`rsync` loop where a stalled transfer or a hung command
  would eat a whole turn.

## The rules that matter

### 1. Every ssh command needs a timeout and BatchMode

```bash
ssh -o ConnectTimeout=10 -o BatchMode=yes 10.40.0.117 '<cmd>'
```

- `ConnectTimeout=10` bounds the TCP connect; without it a down host hangs
  for minutes.
- `BatchMode=yes` fails fast instead of prompting for a password (which
  stalls the calling tool forever).
- Set the tool-level timeout generously (60–120s) but ALWAYS set it. An
  ssh with no timeout is a turn-killer.

### 2. Long remote commands must be detached

Never run a slow remote command (model load, benchmark, download) through
a foreground ssh — the connection stalls and you cannot tell success from
hang. Detach on the remote side and poll the output file:

```bash
# fire and forget
ssh host 'nohup sh -c "curl -s -m 120 http://127.0.0.1:8090/v1/chat/completions \
  -H \"Content-Type: application/json\" -d \"{...}\" > /tmp/result.json" \
  >/dev/null 2>&1 & echo started'

# then poll
ssh host 'cat /tmp/result.json'
```

The same applies to model downloads: `nohup python3 -c "snapshot_download(...)"`
with a log file, then poll the log and `du -sh` of the cache dir.

### 3. Verify every binary transfer by checksum, always

A truncated transfer produces a corrupt binary that fails in confusing
ways (launchd exit -9, "won't relaunch", SIGKILL loops). After every copy:

```bash
# local
shasum -a 256 /tmp/agent | cut -c1-16
# remote
ssh host 'shasum -a 256 ~/.local/bin/agent | cut -c1-16'
```

Do not install or restart anything until the prefixes match. See the
[rsync-transfer](../rsync-transfer/) skill for the copy itself — rsync
`--partial` survives a dropped link where scp restarts from zero.

### 4. launchd: bootout before bootstrap, and codesign ad-hoc after replacing a binary

```bash
cp /tmp/new-agent ~/.local/bin/agent
codesign -s - --force ~/.local/bin/agent   # macOS refuses unsigned/re-signed binaries
launchctl bootout gui/$(id -u)/com.example.agent 2>/dev/null
sleep 2
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.example.agent.plist
launchctl print gui/$(id -u)/com.example.agent | grep -E "state|pid|last exit"
```

- `bootout` first: bootstrap over a loaded service silently fails or leaves
  a stuck state.
- `codesign -s - --force` after every binary replacement — a changed binary
  invalidates the old signature and macOS kills it.
- Verify with `launchctl print` (state/pid/last exit), not just `pgrep`.

### 5. tmux is the remote service manager for interactive processes

```bash
tmux new-session -d -s fml -x 220 -y 50 "CMD 2>&1 | tee logs/server.log"
tmux capture-pane -t fml -p | tail -15   # read the screen
tmux send-keys -t fml "text" Enter        # drive a TUI
tmux kill-session -t fml                  # stop it
```

- Always `-d` (detached) with an explicit size (`-x 220 -y 50`) so TUIs
  render predictably and `capture-pane` output is stable.
- `tee` to a log file so you can `tail` the log even if the pane scrolled.
- `capture-pane -p` is how you read a TUI's state without attaching.

### 6. Poll health endpoints, don't watch processes

`pgrep` tells you a process exists, not that it works. Every service you
run should be probed over HTTP:

```bash
ssh host 'curl -s -m 5 http://127.0.0.1:8090/health'
```

Give a model server 30–60s after (re)start before declaring failure —
first load of a multi-GB model is slow; check the log tail to see load
progress vs an actual error.

### 7. Keep the local working directory anchored

A drifted shell cwd (e.g. after `cd /tmp`) breaks workspace-relative paths
and makes file tools reject valid paths. Before file operations, `pwd` and
`cd` back to the repo root. Cheap to check, expensive to forget.

## Failure signatures and what they mean

| Symptom | Cause | Fix |
|---|---|---|
| ssh "command timed out" but remote cmd succeeded | connection stalled after command ran | design commands to be idempotent; verify state instead of assuming failure |
| launchd `last exit code = 78`/`-9`, won't relaunch | corrupt/truncated binary, or invalid signature | re-verify checksum, `codesign -s - --force`, bootout+bootstrap |
| `ModuleNotFoundError` in a spawned Python child | PATH lacks the python env (miniconda) | prefix the command with `PATH=/opt/homebrew/Caskroom/miniconda/base/bin:$PATH` or set it in the plist `EnvironmentVariables` |
| scp stalls at ~0% for minutes | flaky wifi link to old hardware | use rsync `--partial --append-verify`; budget 10+ min for a 38MB binary |
| `HFValidationError: Repo id must be in the form...` | passed a path with a subdirectory where a repo id was expected | pass the repo id, or resolve the local snapshot dir explicitly |
| `LocalEntryNotFoundError` with HF_HUB_OFFLINE=1 | model not in the remote HF cache (or cache is metadata-only) | download once with `snapshot_download` (online), then serve offline |

## Session checklist (deploy-and-iterate loop)

1. Build locally, checksum the artifact.
2. rsync to remote `/tmp`, verify checksum remotely.
3. Install (cp + codesign), bootout + bootstrap the launchd agent.
4. Verify: `launchctl print` state=running, then health endpoint.
5. Long-running work (server, benchmark, download) → tmux or nohup + log.
6. Poll logs/health; never block a turn on a remote command.
7. Commit engine/repo changes locally as you go — the remote is state you
   can rebuild, the commits are the durable part.
