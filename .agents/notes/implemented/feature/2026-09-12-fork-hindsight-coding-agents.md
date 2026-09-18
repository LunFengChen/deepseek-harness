# Agent Note: fork Hindsight coding agents

Status: implemented

English | [中文](2026-09-12-fork-hindsight-coding-agents.zh.md)

## Problem

xfdsh preinstalled Hindsight from npm `@vectorize-io/hindsight-coding-agents@0.5.2` and kept a local pnpm patch for git stderr. That left the fork without its own GitHub source, and the unused patch file drifted off `pnpm-workspace.yaml` after the upstream merge.

## Decision

Hindsight is preinstalled from [LunFengChen/hindsight-coding-agents](https://github.com/LunFengChen/hindsight-coding-agents) at `v0.5.2-xfdsh.4`. The catalog author and homepage are LunFengChen. The npm package is `@x1a0f3n9/hindsight-coding-agents` and the loader row is `@x1a0f3n9/hindsight-coding-agents/dsh`. Git stderr piping is baked into that fork. The unused pnpm patch file is gone. The later scope rename is [preset plugin npm scope](2026-09-18-preset-plugin-npm-scope.md).

## Alternatives considered

**Keep the npm package plus a pnpm patch.** Rejected: the owner wants a maintained GitHub fork, and the patch was no longer listed in `patchedDependencies`.

**Rename the npm package to a fork scope.** Rejected for this change: the dsh entry is `@vectorize-io/hindsight-coding-agents/dsh`. Renaming the package would require a matching loader rename without a user-visible gain.

## Consequences

- Settings → Plugins links Hindsight to `LunFengChen/hindsight-coding-agents`.
- A non-git session cwd no longer prints `fatal: not a git repository`.
- xfdsh still defaults Hindsight to a local daemon.
