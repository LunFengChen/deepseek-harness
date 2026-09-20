# Agent Note: prebundle dsh-mcp-panel

Status: implemented

English | [中文](2026-09-20-prebundle-mcp-panel.zh.md)

## Problem

xfdsh web ships `@x1a0f3n9/dsh-mcp-client` but has no Settings UI for those rows. Users who want to add or trial-call MCP servers have to hand-edit `cordis.patch.yml`.

## Decision

Preinstall [LunFengChen/dsh-mcp-panel](https://github.com/LunFengChen/dsh-mcp-panel) at `v0.6.16-xfdsh.1` as `@x1a0f3n9/dsh-mcp-panel`. The web-app catalog card, GitHub pin, and cordis insert share id `mcp-panel` and `defaultEnabled: true`. The fork writes `@x1a0f3n9/dsh-mcp-client` rows and still lists `@deepseek-ai/dsh-mcp-client` rows. Pin policy is [pin remaining prebundled plugins](2026-09-11-pin-prebundled-plugin-forks.md); the npm name is [preset plugin npm scope](2026-09-18-preset-plugin-npm-scope.md).

## Alternatives considered

**Leave users installing upstream `dsh-mcp-panel` through plugin add.** Rejected: the owner asked for the same prebundle path as skills-manager.

**Prebundle Fishquito7/dsh-skill-mcp-panel.** Rejected: its skill panel overlaps the already-prebundled Skills manager.

**Prebundle duhu2000/dsh-mcp-connector.** Rejected: that package is a connector catalog, not the Settings console over the official client.

**Vendor the plugin into this repository.** Rejected: it already has its own repo and release tags.

## Consequences

- Settings → xfdsh preset plugins shows MCP panel; disabling the card unloads the plugin.
- Settings → MCP and `/mcp` appear while the card is on.
- `pnpm install` needs the GitHub tag before the pin resolves.
- web-app also depends on `@x1a0f3n9/dsh-mcp-client` so Settings → MCP can load the rows it writes.
- The plugin's `@deepseek-ai/dsh-subprocess`, `@deepseek-ai/dsh-jobs`, and `@deepseek-ai/dsh-typert-protocol` specifiers join the workspace overrides as `link:` paths to the matching `@x1a0f3n9` packages, so the lockfile does not fetch official copies.
