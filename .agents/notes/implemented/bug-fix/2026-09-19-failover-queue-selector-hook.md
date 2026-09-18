# Agent Note: failover-queue slot renderer must receive a selector hook

Status: implemented

English | [中文](2026-09-19-failover-queue-selector-hook.zh.md)

## Problem

`dsh-failover-queue` `v0.1.5` registered Settings → Failover as `settings.section`, but the page stayed blank. The composer chip also crashed under SlotErrorBoundary. `useFailover()` was called with no selector, and `client.sessions` was read without inject.

## Decision

Fix the plugin, then pin it. `v0.1.6` calls `useFailover(snapshot => snapshot)` to match the slot renderer selector hook. Session id is read with `ctx.get('sessions')`, which does not require inject. xfdsh pins `github:LunFengChen/dsh-failover-queue#v0.1.6`.

## Verification

Live Settings → Failover shows the intro, switch, empty-queue copy, and add-row. The composer chip shows failover off. `lib/client.js` contains `useFailover((snapshot` and `get("sessions")`, not `client.sessions`.

## Alternatives considered

**Add `sessions` to the plugin inject list.** The Settings page must render with no current session. Injecting `sessions` would delay or fail the plugin when that service is absent.

**Seed extra host modules so a host card can render the queue.** The crash is in the plugin client. Host code should not duplicate the editor.

## Consequences

- Settings → Failover renders without a current session. Candidate loading stays a no-op until a session id exists.
- `v0.1.5` still blanks the page if someone pins it again.
