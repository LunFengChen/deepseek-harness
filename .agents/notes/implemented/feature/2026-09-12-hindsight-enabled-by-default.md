# Agent Note: xfdsh enables Hindsight by default

Status: implemented

English | [中文](2026-09-12-hindsight-enabled-by-default.zh.md)

## Problem

After xfdsh defaulted Hindsight to a local daemon, the preinstalled row was still `disabled: true`. Users had to open Settings → Plugins to get the local memory that the fork already chose. That extra click contradicted "default local".

## Decision

The web-app catalog marks `hindsight` `defaultEnabled: true`, and the patch insert no longer sets `disabled: true`. The destination remains the local daemon from [xfdsh defaults Hindsight to a local daemon](2026-09-12-hindsight-local-daemon-default.md). Users can still disable the row from Settings → Plugins. xfdsh does not replace the plugin's embed launcher with Docker, pip, or a bundled server.

## Alternatives considered

**Keep the plugin off until a Settings click.** Rejected: the fork already chose local memory; leaving it disabled hides that.

**Default to Docker `ghcr.io/vectorize-io/hindsight` instead of the plugin's local embed.** Rejected: that is a heavier extra process and image pull. The coding-agent package already starts `hindsight-embed` in daemon mode.

**Fork the coding-agents package to drop its embed launcher.** Rejected: the monorepo is still far larger than this integration, and local memory still needs that embed.

## Consequences

- A fresh `xfdsh web` profile loads Hindsight without a Cloud account.
- A profile `pluginOverrides.hindsight: false` still wins.
- If the local embed cannot start, the plugin degrades to no memory for that turn instead of calling Cloud.
