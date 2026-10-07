# byollm/skills — flo

Agent skills by flo. Each skill lives in `<category>/<skill-name>/` with a
`SKILL.md` (instructions) and any supporting assets.

## Skills

| Skill | Purpose |
| --- | --- |
| [`flo/decision-site`](flo/decision-site/) | Turn a grilling session (open decisions + proposed defaults) into a killer single-file website with interactive decision cards, mockup screens with per-screen commenting, and a generator that combines all decisions + selected mockups + comments into one concise copyable prompt. |
| [`flo/rsync-transfer`](flo/rsync-transfer/) | Copy files between machines with `rsync` — never `scp`. Canonical form, resume/mirror/checksum variants, the trailing-slash rule, and a pre-destructive-sync checklist. |

## Usage

Point your agent at a skill's `SKILL.md` (e.g. via a skills directory or an
explicit path) and give it the source document (usually a PRD). The skill
generates a self-contained HTML site — no build step, no dependencies.
