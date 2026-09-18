# Agent Note: Pin remaining prebundled plugins to LunFengChen forks

Status: implemented

English | [中文](2026-09-11-pin-prebundled-plugin-forks.zh.md)

## Problem

xfdsh preinstalls community plugins. `dsh-context` already comes from `LunFengChen/dsh-context`. The other GitHub-installable plugins still pointed at upstream npm or GitHub, so a version-detection or dependency fix had to wait on someone else's release.

## Decision

Pin self-maintained preinstalls to LunFengChen GitHub tags in `packages/bundle/web-app/package.json`:

- `dshmarket` → `github:LunFengChen/dsh-market#v1.44.2`
- `dsh-reasoning-effort` → `github:LunFengChen/dsh-reasoning-effort#v0.7.1`
- `dsh-context` → `github:LunFengChen/dsh-context#v0.49.6`
- `dsh-better-sidebar` → `github:LunFengChen/DSH-better-sidebar#v0.19.0-alpha.1-xfdsh.7`
- `@x1a0f3n9/dsh-session-timeline` → `github:LunFengChen/dsh-session-timeline#v0.1.0`
- `@vectorize-io/hindsight-coding-agents` → `github:LunFengChen/hindsight-coding-agents#v0.5.2-xfdsh.1`
- `@x1a0f3n9/dsh-failover-queue` → `github:LunFengChen/dsh-failover-queue#v0.1.4`

Catalog author and homepage follow those forks. Keep the cordis row `name: dshmarket`; do not retarget the pin at a package renamed to `@x1a0f3n9/dshmarket`.

## Alternatives considered

**Keep npm for market and sidebar.** Rejected: a fork pin is the same maintenance path as `dsh-context`, and npm still publishes the official package names.

**Vendor the plugins into this repository.** Rejected: they already have their own repos and release tags.

## Consequences

- Plugin cards link to LunFengChen repositories.
- Version and compatibility fixes can land on those forks without waiting for upstream npm.
- `xfdsh plugin --profile web add` still installs other community plugins as before.
