# Agent Note: composer compact button

Status: implemented

English | [中文](2026-09-10-composer-compact-button.zh.md)

## Problem

Long sessions can overflow the model context. Automatic compaction retries after overflow, but there was no one-click control. Users had to type `/compact`, and a stalled overflow still felt like a hard stop.

## Decision

`dsh-session-timeline` injects a compact button into `conversation.input.right`. The button runs `session.command('/compact')` on the current session. Host `command-compact` stays disabled in the Web patch; the per-session preset still owns `/compact`.

## Verification

`tests/compact-button.client.spec.tsx` in [LunFengChen/dsh-session-timeline](https://github.com/LunFengChen/dsh-session-timeline) covers the click path and the missing-session disabled state.

## Alternatives considered

**Re-enable host-plane `command-compact`.** Rejected: the Web patch disables that row because presets own the human command. Re-enabling it would duplicate compact across host and preset.

**Put the button in `dsh-client-ui-commands`.** Rejected for this fork: session-timeline already owns the extra Web controls, and the compact click is presentation only.

**Add a new compaction RPC.** Rejected: `/compact` already queues condensation through the existing command.

## Consequences

- The composer trailing slot shows a compact control next to the context meter.
- Mid-turn and empty-history outcomes stay the `/compact` command errors.
