# Agent Note: Hindsight stays cataloged but off by default

Status: implemented

English | [中文](2026-09-11-hindsight-opt-in.zh.md)

## Problem

The web-app preinstall loaded `@vectorize-io/hindsight-coding-agents` on first boot. That plugin talks to Hindsight Cloud or a local server through `~/.hindsight/coding-agent.json`. Users without that account saw a required cloud key for a feature they did not ask to turn on. Forking `vectorize-io/hindsight` is not practical: it is a large monorepo, and the coding-agent package is only one integration.

## Decision

Keep the package in the web-app catalog and patch insert so users can enable it from Settings → Plugins. Set `defaultEnabled: false` and `disabled: true` on the shipped row. Do not fork the Hindsight monorepo.

## Alternatives considered

**Fork `vectorize-io/hindsight` and strip the cloud key.** Rejected: the repository is far larger than this integration, and local memory still needs a Hindsight server.

**Remove the preinstall.** Rejected: the catalog and one-click enablement are still useful for people who already run Hindsight.

## Consequences

- First boot no longer loads Hindsight or asks for a cloud key.
- Existing profile `pluginOverrides.hindsight: true` still wins over the shipped disabled row.
- Users enable it from Settings → Plugins. xfdsh defaults `HINDSIGHT_SERVER_MODE=daemon`; Cloud remains optional in `~/.hindsight/coding-agent.json`.
