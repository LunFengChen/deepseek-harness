# Agent Note: Hindsight git probes keep stderr

Status: implemented

English | [中文](2026-09-12-hindsight-quiet-git-stderr.zh.md)

## Problem

`xfdsh web` opens the last session after the default browser starts. Hindsight then runs `git -C <session-cwd> rev-list` / `rev-parse` through `execFileSync` with inherited stderr. A session whose cwd is not a git repository (for example a plain project directory) prints `fatal: not a git repository (or any of the parent directories): .git` once per probe. The launcher does not require a git checkout.

## Decision

Keep `@vectorize-io/hindsight-coding-agents@0.5.2` as the preinstalled package. Do not fork the Hindsight monorepo. A pnpm patch on that package sets `stdio: ["ignore", "pipe", "pipe"]` on the three `git` `execFileSync` sites in `dist/dsh.js`. Non-zero git exits still throw and stay in the existing `try/catch`; only the inherited terminal line goes away.

## Alternatives considered

**Fork `vectorize-io/hindsight` to change the git helper.** Rejected: the monorepo is far larger than this stderr leak, and [Hindsight stays cataloged but off by default](2026-09-11-hindsight-opt-in.md) already refused that fork.

**Monkey-patch `node:child_process.execFileSync` in the xfdsh bin.** Rejected: the ESM export is read-only, and a named `import { execFileSync }` in the plugin would not see a mutated default export.

**Require launching from a git repository.** Rejected: session cwd is the user's project, which may not be a git checkout.

## Consequences

- `xfdsh web` can open a non-git session cwd without printing git fatals.
- Upgrading `@vectorize-io/hindsight-coding-agents` past `0.5.2` must refresh `patches/@vectorize-io__hindsight-coding-agents@0.5.2.patch`.
- Hindsight still no-ops memory seeding when git history is absent.
