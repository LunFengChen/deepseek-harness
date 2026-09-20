# Agent Note: prebundle dsh-skills-manager

Status: implemented

English | [中文](2026-09-18-prebundle-skills-manager.zh.md)

## Problem

xfdsh web had no preinstalled Skills manager. Users who wanted the local-agent skills UI had to `xfdsh plugin --profile web add` it, and the upstream package still publishes as `@michengai/dsh-skills-manager` with `@deepseek-ai/dsh-*` peers.

## Decision

Preinstall [LunFengChen/dsh-skills-manager](https://github.com/LunFengChen/dsh-skills-manager) at `v0.1.53-xfdsh.1` as `@x1a0f3n9/dsh-skills-manager`. The web-app catalog card, dependency pin, and cordis insert share id `skills-manager` and `defaultEnabled: true`. The fork rebases upstream `0.1.53` (Project tab restore) onto the existing `@x1a0f3n9` xfdsh adaptations. Pin policy is [pin remaining prebundled plugins](2026-09-11-pin-prebundled-plugin-forks.md); the npm name is [preset plugin npm scope](2026-09-18-preset-plugin-npm-scope.md).

## Alternatives considered

**Leave users installing `@michengai/dsh-skills-manager` through plugin add.** Rejected: the owner asked for the same prebundle path as market, timeline, and Hindsight.

**Vendor the plugin into this repository.** Rejected: it already has its own repo and release tags.

**Pin the older `v0.1.50-xfdsh.4` tag without rebasing.** Rejected: upstream `0.1.53` restores the Project tab on hosts that no longer expose a current-session field.

## Consequences

- Settings → xfdsh preset plugins shows Skills manager; disabling the card unloads the plugin.
- Settings → Skills appears while the card is on.
- `pnpm install` needs the GitHub tag before the pin resolves.
- The plugin's `@deepseek-ai/dsh-skill` and `@deepseek-ai/dsh-web-app` peers join the workspace overrides in `pnpm-workspace.yaml`, so the lockfile does not fetch official copies.
