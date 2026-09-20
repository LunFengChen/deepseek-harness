# Agent Note: port xfdsh onto upstream master

Status: implemented

English | [中文](2026-09-10-port-fork-onto-upstream.zh.md)

## Problem

The fork `master` had mixed upstream and xfdsh commits. Rebasing that history onto current upstream produced a 3-way tree with stale files and hundreds of type errors. Users still need the fork features, but `master` must stay a pure upstream mirror.

## Decision

Reset `master` to `upstream/master`. Port fork behavior onto a feature branch as a rescope plus keep-file overlay, then merge `--no-ff` into `dev-x1a0f3n9`. Do not replay the old 80-commit fork stack onto the new master.

Product rules stay: `xfdsh` uses `~/.xfdsh` for plugins/profiles, `DSH_SESSION_HOME=~/.dsh` for history, and port `7777`. Official plugins keep their import names and resolve through `@x1a0f3n9/dsh-*`. Conversation delete/rewind/regenerate stays in `dsh-session-timeline`. Preinstalled timeline and `dshmarket` entries are cataloged so Settings can disable them. A stale `danger-full-access` escalation request is treated as already satisfied.

## Verification

`master` is `upstream/master` at `dsh-v0.1.5-alpha.2`. Feature work lives on `features/port-fork-onto-upstream` and merges into `dev-x1a0f3n9` only. Unit tests cover fork defaults, session-home resolution, standing-mode escalation, and official/fork client-module aliases. `node --import tsx/esm apps/cli/src/bin.ts web --no-open` listened on `http://127.0.0.1:7777`, served `@x1a0f3n9/dsh-client-modules`, `dsh-session-timeline`, and `dshmarket` client modules, and left `~/.dsh/profiles` mtimes unchanged.

## Alternatives considered

**Rebase the old fork commit stack onto new master.** Rejected because the common ancestor was hundreds of commits behind and the replay restored deleted upstream files.

**Keep fork commits on master.** Rejected because the user requires master to track upstream and fork work to land through `dev-x1a0f3n9`.

## Consequences

- New fork work still uses `features/*` or `fix/*` branches and `--no-ff` merges into `dev-x1a0f3n9`.
- Official plugin client inject lists that name `@x1a0f3n9/dsh-*` resolve to the fork module table.
- `dshmarket` remains a preinstalled, disableable web-app catalog entry.
