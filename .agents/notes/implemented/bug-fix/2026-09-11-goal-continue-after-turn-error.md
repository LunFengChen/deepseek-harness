# Agent Note: goal rounds continue after a turn-level model error

Status: implemented

English | [中文](2026-09-11-goal-continue-after-turn-error.zh.md)

## Problem

`goal-round-driver` disarmed automatic continuation on every `agent/error`. Rate limits, provider failures, and context-window errors therefore left an active goal idle with no blocker. Long-running goals looked as if they had stopped on their own.

## Decision

A turn-level `agent/error` completes the admitted round. The driver does not disarm. If the goal remains active and armed, the next idle drive queues `roundsStarted + 1`. Cancellation, a `ctx.sessions.flush()` durability checkpoint failure, plugin unload, and model-reported `blocked` still stop continuation. Existing `model-reported` blocked goals are not auto-resumed.

## Verification

`packages/goal/goal-round-driver/tests/goal-round-driver.spec.ts` runs a rate-limit error, a generic request error, a post-turn `agent/error`, and a failed `turn/end` commit, each followed by a normal round. Each case reaches `round-limit` at the configured cap instead of a silent disarm after the first turn. A throwing downstream pre-step hook still fails closed.

## Alternatives considered

**Keep disarming on `agent/error` so a human can inspect the failure.** Rejected: the user-visible result was an unexplained idle goal, and transient provider errors are exactly what unattended rounds should retry.

**Block the goal with a new error code.** Rejected: that freezes the goal behind a blocker the user did not ask for, the same problem as treating max-tokens as `blocked`.

**Disarm only for post-turn persistence `agent/error`.** Rejected: that event is not a durability checkpoint. The driver already stops on `ctx.sessions.flush()` failure before queuing another round.

## Consequences

- Turn-level model errors no longer drop automatic authority.
- Output and error records already written in that turn remain in the session log.
- Existing sessions that already stored `activation: disarmed` stay disarmed until an explicit resume.

## Related

[Goal rounds continue after max-token truncation](2026-09-11-goal-continue-after-max-tokens.md)
