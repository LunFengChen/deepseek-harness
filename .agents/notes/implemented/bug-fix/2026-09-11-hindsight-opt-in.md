# Agent Note: Hindsight stays cataloged but off by default

Status: implemented

English | [中文](2026-09-11-hindsight-opt-in.zh.md)

## Problem

The web-app preinstall loaded `@vectorize-io/hindsight-coding-agents` on first boot. That plugin talks to Hindsight Cloud or a local server through `~/.hindsight/coding-agent.json`. Users without that account saw a required cloud key for a feature they did not ask to turn on. Forking `vectorize-io/hindsight` is not practical: it is a large monorepo, and the coding-agent package is only one integration.

## Decision

Keep the package in the web-app catalog and patch insert. Do not fork the Hindsight monorepo. The shipped on/off default is owned by [xfdsh enables Hindsight by default](../feature/2026-09-12-hindsight-enabled-by-default.md).

## Alternatives considered

**Fork `vectorize-io/hindsight` and strip the cloud key.** Rejected: the repository is far larger than this integration, and local memory still needs a Hindsight server.

**Remove the preinstall.** Rejected: the catalog and one-click enablement are still useful for people who already run Hindsight.

## Consequences

- xfdsh does not fork `vectorize-io/hindsight`.
- Cloud is not required because [xfdsh defaults Hindsight to a local daemon](../feature/2026-09-12-hindsight-local-daemon-default.md).
- Existing profile `pluginOverrides.hindsight` still wins over the shipped row.
