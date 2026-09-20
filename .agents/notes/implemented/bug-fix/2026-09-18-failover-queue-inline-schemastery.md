# Agent Note: failover-queue client must inline schemastery

Status: implemented

English | [中文](2026-09-18-failover-queue-inline-schemastery.zh.md)

## Problem

The prebundled `@x1a0f3n9/dsh-failover-queue` client factory called `require("@deepseek-ai/schemastery")`. That specifier is not a platform seed word. In-tree client bundles inline vendored schemastery. The plugin's tsdown config left peer dependencies external, so Web boot failed with `missed the module table`.

## Decision

Fix the plugin, not the host module table. `dsh-failover-queue` `v0.1.4` inlines schemastery in `lib/client.js` and keeps React as a seed-table external. xfdsh pins `github:LunFengChen/dsh-failover-queue#v0.1.4`. `@deepseek-ai/schemastery` stays off `PLATFORM_MODULES`.

## Verification

`rg 'require\\("@deepseek-ai/schemastery"\\)'` on the plugin `lib/client.js` is empty; `require("react")` remains. Restart `xfdsh web` after `pnpm install`.

## Alternatives considered

**Seed `@deepseek-ai/schemastery` in `PLATFORM_MODULES`.** That would share a library the client purity gate treats as inline-only, and it would hide every plugin that forgot to bundle a vendored library.

**Leave the pin at `v0.1.3` and patch `node_modules`.** The next install restores the broken factory.

## Consequences

- Community plugins that `require` schemastery still fail until they inline it.
- Host Node still resolves `@deepseek-ai/schemastery` as a peer of the plugin.
