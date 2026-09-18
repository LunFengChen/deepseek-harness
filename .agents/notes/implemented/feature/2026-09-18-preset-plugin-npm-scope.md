# Agent Note: preset plugin npm scope

Status: implemented

English | [中文](2026-09-18-preset-plugin-npm-scope.zh.md)

## Problem

Forked xfdsh preinstalls still published under upstream npm names: `dshmarket`, `dsh-reasoning-effort`, `dsh-context`, `dsh-better-sidebar`, and `@vectorize-io/hindsight-coding-agents`. Settings cards therefore showed unscoped or upstream-scoped subtitles even though the GitHub pins were LunFengChen forks, so those packages could not be versioned or published under the fork scope.

## Decision

Each forked preinstall publishes as `@x1a0f3n9/<name>`. Catalog `packageName`, web-app dependency keys, and cordis loader `name` use that npm name. Client `__ModuleLoader__` ids follow the package name. Settings namespaces and Cordis `export const name` stay on the old short ids so existing user settings survive. Catalog `homepage` stays the LunFengChen GitHub URL; the package-name subtitle is that link.

Current pins:

- `@x1a0f3n9/dsh-reasoning-effort` → `github:LunFengChen/dsh-reasoning-effort#v0.7.3`
- `@x1a0f3n9/dsh-context` → `github:LunFengChen/dsh-context#v0.49.7`
- `@x1a0f3n9/dsh-better-sidebar` → `github:LunFengChen/DSH-better-sidebar#v0.19.2`
- `@x1a0f3n9/dshmarket` → `github:LunFengChen/dsh-market#v1.45.2`
- `@x1a0f3n9/hindsight-coding-agents` → `github:LunFengChen/hindsight-coding-agents#v0.5.2-xfdsh.4`, loader `@x1a0f3n9/hindsight-coding-agents/dsh`
- `@x1a0f3n9/dsh-skills-manager` → `github:LunFengChen/dsh-skills-manager#v0.1.53-xfdsh.1`

This reverses [fork Hindsight coding agents](2026-09-12-fork-hindsight-coding-agents.md) keeping the upstream npm name, and [pin remaining prebundled plugins](2026-09-11-pin-prebundled-plugin-forks.md) keeping the unscoped `dshmarket` loader row.

## Alternatives considered

**Map display names in the xfdsh UI.** Rejected: the card subtitle is catalog `packageName`. A display alias would hide the install name and still leave the packages unmaintainable.

**Keep upstream npm names and only fork GitHub.** Rejected: the owner cannot publish those names, and cards still look like official packages.

**Rename internal settings namespaces to the scoped ids.** Rejected: that would drop existing composer, context, and sidebar settings.

## Consequences

- Settings → xfdsh preset plugins shows `@x1a0f3n9/...` and opens the LunFengChen GitHub pin.
- GitHub tags must exist before `pnpm install` can resolve the pins.
- Official `@deepseek-ai/dsh` is unchanged.
