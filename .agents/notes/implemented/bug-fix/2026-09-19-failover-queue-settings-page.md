# Agent Note: failover-queue settings page must not use a fixed popover

Status: implemented

English | [中文](2026-09-19-failover-queue-settings-page.zh.md)

## Problem

`dsh-failover-queue` `v0.1.4` registered the queue editor on `settings.plugins.tab`. That component reused the composer popover (`position: fixed`). The Settings modal sets `overflow: hidden`, so the tab painted as a blank page.

## Decision

Fix the plugin, then pin it. `v0.1.5` registers `settings.section` id `failover` and renders the editor in document flow. The composer chip still opens the popover through a portal. xfdsh pins `github:LunFengChen/dsh-failover-queue#v0.1.5`.

## Verification

`lib/client.js` contains `settings.section` and `dsh-fq-panel-page`, not `settings.plugins.tab`. `require` stays `react`, `react-dom`, and `react/jsx-runtime`. After `pnpm install`, Settings left nav shows Failover with the queue switch and add-row controls.

## Alternatives considered

**Keep `settings.plugins.tab` and only change CSS.** The Plugins section already has inventory, catalog, and configuration tabs. A dedicated left-nav page matches Models and Agent presets.

**Seed extra host modules so a host card can render the queue.** The editor already ships in the plugin client. Host code should not duplicate it.

## Consequences

- Settings → Failover is the queue editor. Settings → xfdsh preset plugins remains the enable/disable switch.
- `v0.1.4` stays a blank settings tab if someone pins it again.
