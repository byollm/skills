<!--
repo: byollm/skills
branch: decision-site-deep-dive
worktree: /Users/floleibert/dev/skills
origin-host: github.com
user: floleibert <floleibert@example.com>
signed: 2026-10-11T03:02:06Z
-->

# gpu-herd

Keep the GPU nodes truthful: know what is running on every GPU, make sure
every model runs with its shim and amesh registration, and kill duplicate or
stale catalog entries.

## When to use

Work on the hotaisle nodes (hydra repo, `~/dev/hydra`): inventorying models,
swapping a model onto a GPU, debugging "why is this model in the picker
twice", or checking that a node is visible in amesh with live stats.

## Workflow

1. **Inventory before acting.** For each node, run targeted commands, never
   broad scans:
   - `docker ps -a --filter name=<prefix>` for containers
   - `rocm-smi --showuse --showmemuse --showpids` for GPU state
   - the node's run recipe in its `nodes/CLAUDE.md` (this is the recorded
     source for what *should* be running)
2. Compare actual vs recipe. Every difference is a finding: model running
   without the shim, GPU idle with no documented stop reason, a container the
   recipe doesn't know, a model on the wrong GPU.
3. **The shim rule**: every model runs with its sidecar shim (healthz
   endpoint, heartbeat to amesh). A model without a shim is a defect even when
   it serves traffic fine. The port is never hardcoded — it comes from config.
4. **Catalog hygiene**: entries come from amesh heartbeats. If a model hasn't
   heartbeated within the configured TTL, its config entry is removed
   automatically. Duplicate picker entries mean two sources registered the
   same model — find both registrations and keep one.
5. **Swapping a model**: record the old container/session (name, reason,
   preserved logs, rollback) before destroying anything. Launch the new model
   with the shim, verify healthz answers, verify amesh shows the GPU with
   stats, then update the node's run recipe in `nodes/CLAUDE.md`.
6. **Every experiment run records**: command, host, GPU id, context length,
   concurrency, generated tok/sec, latency, VRAM, image/container, model
   artifact, git commit, flags, failure text if any. Append to the durable
   files (`FLASH4_RESULTS.jsonl`, `FLASH4_LANES.md`, `FLASH4_LEARNINGS.md`)
   after every action, not at the end.

## Rules

- Never trust a stale `nodes/CLAUDE.md` over live amesh state — check amesh.
- Never destroy a container or tmux session without recording it (name,
  reason, logs preserved, rollback).
- One GPU, one experiment, unless the recipe says otherwise.
- End every pass with: current state, evidence, next action. Leaving concrete
  running work behind beats a summary.
