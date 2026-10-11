<!--
repo: byollm/skills
branch: decision-site-deep-dive
worktree: /Users/floleibert/dev/skills
origin-host: github.com
user: floleibert <floleibert@example.com>
signed: 2026-10-11T03:02:06Z
-->

# remote-inspect

Inspect remote GPU nodes over ssh without hanging the session. Targeted reads
only; the ssh flags that seem helpful are the ones that bite.

## When to use

Any "what's running on node X" question against the hotaisle hosts, or ssh
work in the hydra repo. A PRD for this exists:
`docs/PRD-REMOTE-INSPECTION-HEARTBEAT.md` — read it first when doing
heartbeat work.

## The ssh rules

- **Never pass `ControlPersist` on the command line.** It makes ssh fork a
  background master that inherits the stdout fd. When the command runs inside
  `$(...)` (command substitution), the shell waits for EOF on the pipe, the
  master holds it open, and the session hangs forever. Multiplexing comes
  from `~/.ssh/config` (`ControlMaster auto`, `ControlPath`, `ControlPersist
  10m`), which is already configured for the hotaisle hosts.
- **No `BatchMode`, no `ConnectTimeout` on the command line either** — same
  class of surprise. Config file only.
- Always bound output: `head -N`, `tail -N`, or a grep. Never stream a broad
  scan (`find /`, `grep -R`, `ls -R` over big trees) — it floods the session
  and the remote-inspection timeout budget.

## Workflow

1. Read the node's run recipe in `nodes/CLAUDE.md` first — it records what
   should be running. Then verify against live state; the recipe can be stale.
2. Targeted commands per question:
   - containers: `docker ps -a --filter name=<prefix>`
   - GPU state: `rocm-smi --showuse --showmemuse --showpids`
   - a service: `curl -s -m 2 http://<host>:<port>/healthz`
   - logs: `tail -50 <logfile>` or `grep -c <pattern> <logfile>`
3. Prefer `sed -n '10,40p' file` / `jq` over catting whole files.
4. Record what you find in the node's run recipe if it drifted — the recipe
   is the durable memory, the chat is not.

## Rules

- One question, one command, one answer. Batch independent questions in one
  ssh call only when each command's output is bounded.
- If a command can produce many lines, redirect to a file on the remote host
  and summarize the evidence.
- Never destroy a container or tmux session without recording name, reason,
  preserved logs, and rollback.
