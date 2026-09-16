# Agent Note: list directories with bounded child probes

Status: implemented

English | [中文](2026-09-16-listdir-bounded-concurrency.zh.md)

## Problem

`fs-local` `listDirectory` resolved and `stat`ed every child one after another. A directory with hundreds of entries — Host files sidebar, `view` on a folder, plugin explorer through `ctx.fs` — waited on two syscalls per name. Opening `node_modules` or a monorepo `packages/` folder stalled the Host and starved later RPC, including the sidebar jobs pane.

## Decision

Non-symlink children inherit the listed parent's already-realpath'd `targetKey` and only `stat`. Symlink children still `realpath` so a listing captured through a parent symlink keeps that identity if the link is retargeted. Child probes run 32 at a time and return in stable name order. The first child error still fails the whole listing.

## Verification

`pnpm exec vitest run packages/fs/fs-local/tests/fsio.spec.ts packages/fs/fs-local/tests/filesystem.spec.ts -t 'listDir|listDirectory'`

## Alternatives considered

**Keep serial realpath+stat.** Rejected: a 200-entry folder is four hundred sequential syscalls; the stall is the bug.

**Skip `stat` for files and trust `Dirent` type only.** Rejected: listing consumers still need file size and version, and tests pin those fields.

**Unbounded `Promise.all` per child.** Rejected: a 10k-entry directory would open thousands of concurrent stats and trip `EMFILE`.

## Consequences

- A listing of regular files is one `stat` per name instead of `realpath` then `stat`, overlapped 32-wide.
- Symlink and identity tests stay on the realpath path; a retargeted parent listing still reports the captured identity.
- Abort still throws `FS_ABORTED` between child probes; in-flight probes may finish after the first abort check.
