# rsync-transfer

Copy files and directories between machines with `rsync` — never `scp`.

## When to use

- Any time you need to copy a file, a directory, or a tree of files to or
  from a remote host (deploy a binary, pull logs, sync a worktree).
- Replacing an `scp` habit: if you find yourself typing `scp`, stop and use
  this skill instead.

## Why rsync and not scp

- **Interruptible and resumable.** A dropped connection does not throw away
  the transferred bytes; re-running continues where it left off
  (`--partial` / `--append-verify`).
- **Efficient re-syncs.** Unchanged files are skipped by size+mtime (or
  checksum with `-c`), so re-deploying a directory after a small change
  moves only the delta.
- **Preserves what you expect.** Permissions, ownership, and timestamps with
  `-a`; sparse files with `-S`; hard links with `-H`.
- **Safe deletions are opt-in.** rsync never deletes anything on the
  destination unless you pass `--delete` — and then it can show you first
  (`-n`).
- **Progress and verification.** `--info=progress2` gives a single overall
  progress line; `-c` verifies content by checksum when it matters.

## The canonical form

```bash
rsync -av --info=progress2 SRC [SRC...] USER@HOST:DEST
```

- `-a` archive mode (recursive, preserves perms/times/symlinks/devices)
- `-v` verbose (per-file listing)
- `--info=progress2` overall progress bar

Pull instead of push by swapping the sides:

```bash
rsync -av --info=progress2 USER@HOST:SRC DEST
```

## Common variants

**Deploy a single binary (the common case):**

```bash
rsync -av --info=progress2 dist/flocode user@old-macbook:/usr/local/bin/flocode
```

**Resume a large interrupted transfer:**

```bash
rsync -av --partial --info=progress2 big-file.tar user@host:/dest/
```

**Mirror a directory exactly (make destination match source):**

```bash
rsync -av --delete --info=progress2 src/ user@host:/dest/
```

Caution: `--delete` removes files on the destination that are not in the
source. Always dry-run first when the destination matters:

```bash
rsync -avn --delete src/ user@host:/dest/   # -n = show what would happen
```

**Verify by checksum (size+mtime is not enough):**

```bash
rsync -avc --info=progress2 src/ user@host:/dest/
```

**Sparse or space-sensitive files (disk images, VMs):**

```bash
rsync -avS --info=progress2 image.img user@host:/dest/
```

**Bandwidth-limited link:**

```bash
rsync -av --bwlimit=2M --info=progress2 src/ user@host:/dest/
```

**Compress in transit (slow link, compressible data):**

```bash
rsync -avz --info=progress2 src/ user@host:/dest/
```

## Trailing-slash rule (memorize this)

- `src` → copies the `src` **directory itself** into DEST (DEST/src/...)
- `src/` → copies the **contents** of `src` into DEST

Getting this wrong is the #1 rsync mistake. When in doubt, dry-run with `-n`.

## Remote shell options (non-standard port, jump host, key)

rsync uses ssh underneath; pass ssh flags with `-e`:

```bash
rsync -av -e "ssh -p 2222" src/ user@host:/dest/
rsync -av -e "ssh -J bastion" src/ user@host:/dest/
rsync -av -e "ssh -i ~/.ssh/deploy_key" src/ user@host:/dest/
```

## Checklist before a destructive sync

1. `-n` dry-run whenever `--delete` is set or the destination is shared.
2. Confirm the trailing slash matches your intent.
3. For one-shot copies where the destination must be exact, prefer
   `--delete` over manual cleanup — but only after the dry-run looks right.

## Verify after transfer

```bash
# quick: sizes and mtimes
rsync -avn src/ user@host:/dest/          # "no-op" output = in sync
# strict: checksums
rsync -avnc src/ user@host:/dest/
```

A dry-run that lists nothing to transfer means source and destination agree.
