# Agent Note: Pin remaining prebundled plugins to LunFengChen forks

Status: implemented

English | [中文](2026-09-11-pin-prebundled-plugin-forks.zh.md)

## Problem

xfdsh preinstalls community plugins. `dsh-context` already comes from `LunFengChen/dsh-context`. The other GitHub-installable plugins still pointed at upstream npm or GitHub, so a version-detection or dependency fix had to wait on someone else's release. Hindsight stays upstream: `vectorize-io/hindsight` is a large monorepo and is now opt-in.

## Decision

Pin the remaining self-maintained preinstalls to LunFengChen GitHub tags:

- `dshmarket` → `github:LunFengChen/dsh-market#v1.44.0`
- `dsh-reasoning-effort` → `github:LunFengChen/dsh-reasoning-effort#v0.7.1`
- `dsh-better-sidebar` → `github:LunFengChen/DSH-better-sidebar#v0.19.0-alpha.1`

Catalog author and homepage follow those forks. Session timeline stays in-tree. Hindsight stays the upstream package, disabled by default.

## Alternatives considered

**Keep npm for market and sidebar.** Rejected: a fork pin is the same maintenance path as `dsh-context`, and npm still publishes the official package names.

**Vendor the plugins into this repository.** Rejected: they already have their own repos and release tags.

## Consequences

- Plugin cards link to LunFengChen repositories.
- Version and compatibility fixes can land on those forks without waiting for upstream npm.
- `xfdsh plugin --profile web add` still installs other community plugins as before.
