# Agent Note: preinstalled fork-scoped plugins stay outside the workspace release

Status: implemented

English | [中文](2026-09-14-preinstalled-fork-plugin-layout.zh.md)

## Problem

`verify-npm-install-layout` treats every `@x1a0f3n9/dsh-*` name as a workspace release member that must exist at the current DSH version. `@x1a0f3n9/dsh-session-timeline` is a preinstalled GitHub plugin with its own version, so the gate fails before `dev-x1a0f3n9` can pack or publish.

## Decision

Preinstalled plugin package names, including fork-scoped `@x1a0f3n9/dsh-session-timeline`, are not workspace DSH packages. A DSH-named package that has no workspace version stays in the index unchanged. Synthetic DSH releases do not rewrite those plugin ranges onto the workspace version.

## Alternatives considered

**Move session timeline back into this workspace.** Rejected: the plugin lives in `LunFengChen/dsh-session-timeline` so it can version and publish on its own.

**Stop matching `@x1a0f3n9/dsh-*` by prefix.** Rejected: workspace members still use that prefix, and the dual-release check needs them.

**Leave the gate failing and publish only from a local pack.** Rejected: `dev-x1a0f3n9` pushes must be able to publish through CI.

## Consequences

- `pnpm run verify-npm-install-layout` accepts the GitHub-pinned session timeline plugin.
- A later fork-scoped preinstalled plugin needs the same exception until it is a workspace member.
