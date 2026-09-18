# Agent Note: session-timeline client must not require dsh-session/types

Status: implemented

English | [中文](2026-09-18-session-timeline-client-session-seq.zh.md)

## Problem

The prebundled `@x1a0f3n9/dsh-session-timeline` client factory called `require("@x1a0f3n9/dsh-session/types")` at `#v0.1.0`. The later `0.1.5-xfdsh.1` build still called `require("@deepseek-ai/dsh-session/types")`. Neither specifier is a platform seed word. Web boot failed with `missed the module table`.

## Decision

Fix the plugin, not the host module table. `dsh-session-timeline` `0.1.5-xfdsh.2` brands chat-node seqs with a local helper, keeps only platform/inject client externals, and refuses a `dsh-session` value import at build time. xfdsh pins `github:LunFengChen/dsh-session-timeline#v0.1.5-xfdsh.2`. `pnpm-workspace.yaml` maps the remaining official peer names this plugin still declares onto workspace `@x1a0f3n9/dsh-*`. `@deepseek-ai/dsh-session` and `@x1a0f3n9/dsh-session` stay off `PLATFORM_MODULES`.

## Verification

`rg 'require\("@.+/dsh-session'` on the plugin `lib/client.js` is empty. Remaining requires are `react`, `react-dom`, `react/jsx-runtime`, and `@deepseek-ai/dsh-client-ui-primitives`. Restart `xfdsh web` after `pnpm install`.

## Alternatives considered

**Seed `dsh-session/types` in `PLATFORM_MODULES`.** That would publish a Host session factory into the browser module table and hide every plugin that forgot to keep session types type-only.

**Leave the pin at `v0.1.0` and patch `node_modules`.** The next install restores the broken factory.

**Rewrite the plugin peer ranges to `npm:@x1a0f3n9/dsh-*@workspace:*`.** Rejected: other LunFengChen forks keep official `@deepseek-ai/dsh-*` names and let `pnpm-workspace.yaml` remap them.

## Consequences

- Host Node still resolves `@deepseek-ai/dsh-session` as a peer of the plugin.
- Community plugins that `require` session types still fail until they brand locally or type-only import.
