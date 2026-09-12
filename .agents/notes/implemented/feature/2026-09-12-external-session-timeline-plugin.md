# Agent Note: extract session timeline into its own repository

Status: implemented

English | [中文](2026-09-12-external-session-timeline-plugin.zh.md)

## Problem

Session timeline lived inside the harness workspace. That mixed plugin maintenance with harness packages and left no independent GitHub repository for the rewind UI.

## Decision

`@x1a0f3n9/dsh-session-timeline` is a standalone plugin at [LunFengChen/dsh-session-timeline](https://github.com/LunFengChen/dsh-session-timeline). The package name stays `@x1a0f3n9/dsh-session-timeline`. The Web bundle preinstalls `github:LunFengChen/dsh-session-timeline#v0.1.0` and no longer contains `packages/session/session-timeline`.

## Alternatives considered

**Rename the package to `@deepseek-ai/dsh-session-timeline`.** Rejected: this plugin belongs to the fork. Official naming would hide the owner and break the current client module id.

**Keep the plugin in the monorepo.** Rejected: the owner wants a separate repository so the plugin can be maintained without a harness checkout.

**Publish only an npm tarball and drop the GitHub pin.** Rejected for this change: the other prebundled plugins already pin GitHub tags.

## Consequences

- Timeline source and tests live in `LunFengChen/dsh-session-timeline`.
- Settings → Plugins links the catalog card to that repository.
- Workspace Client/Host dependency policy no longer lists the plugin.
