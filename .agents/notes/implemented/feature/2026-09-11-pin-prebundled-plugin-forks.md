# Agent Note: Pin remaining prebundled plugins to LunFengChen forks

Status: implemented

English | [中文](2026-09-11-pin-prebundled-plugin-forks.zh.md)

## Problem

xfdsh preinstalls community plugins. `dsh-context` already comes from `LunFengChen/dsh-context`. The other GitHub-installable plugins still pointed at upstream npm or GitHub, so a version-detection or dependency fix had to wait on someone else's release.

## Decision

Pin self-maintained preinstalls to LunFengChen GitHub tags in `packages/bundle/web-app/package.json`. The npm names now use the fork scope; see [preset plugin npm scope](2026-09-18-preset-plugin-npm-scope.md):

- `@x1a0f3n9/dshmarket` → `github:LunFengChen/dsh-market#v1.45.2`
- `@x1a0f3n9/dsh-reasoning-effort` → `github:LunFengChen/dsh-reasoning-effort#v0.7.3`
- `@x1a0f3n9/dsh-context` → `github:LunFengChen/dsh-context#v0.49.7`
- `@x1a0f3n9/dsh-better-sidebar` → `github:LunFengChen/DSH-better-sidebar#v0.19.2`
- `@x1a0f3n9/dsh-session-timeline` → `github:LunFengChen/dsh-session-timeline#v0.1.5-xfdsh.2`
- `@x1a0f3n9/hindsight-coding-agents` → `github:LunFengChen/hindsight-coding-agents#v0.5.2-xfdsh.4`
- `@x1a0f3n9/dsh-failover-queue` → `github:LunFengChen/dsh-failover-queue#v0.1.12`
- `@x1a0f3n9/dsh-skills-manager` → `github:LunFengChen/dsh-skills-manager#v0.1.53-xfdsh.1`

Catalog author and homepage follow those forks. Cordis loader `name` matches the scoped npm package.

## Alternatives considered

**Keep npm for market and sidebar.** Rejected: a fork pin is the same maintenance path as `dsh-context`, and npm still publishes the official package names.

**Vendor the plugins into this repository.** Rejected: they already have their own repos and release tags.

## Consequences

- Plugin cards link to LunFengChen repositories.
- Version and compatibility fixes can land on those forks without waiting for upstream npm.
- `xfdsh plugin --profile web add` still installs other community plugins as before.
