# Agent Note: goal rounds continue after max-token truncation

Status: implemented

English | [中文](2026-09-11-goal-continue-after-max-tokens.zh.md)

## Problem

`goal-round-driver` treated `turn/end` `max-tokens` as an abnormal stop and disarmed automatic continuation. Truncated model output stayed in the session, but the goal went idle without a blocker. Long-running goals then looked as if they had mysteriously stopped.

## Decision

A max-token `turn/end` completes the admitted round. The driver does not disarm. If the goal remains active and armed, the next idle drive queues `roundsStarted + 1`. Cancellation, durability checkpoint failures, and model-reported `blocked` still stop continuation.

## Verification

`packages/goal/goal-round-driver/tests/goal-round-driver.spec.ts` runs a max-token round then a normal round and expects `round-limit` at the configured cap, not a silent disarm after the first turn.

## Alternatives considered

**Keep disarming and require a human resume.** Rejected: truncation is a per-turn output ceiling, not a goal-level stop, and the user-visible result was an unexplained idle goal.

**Re-prompt the same round to continue the truncated text.** Rejected: round admission already consumed the number, and continuation belongs to the next goal round plus existing compact/continue UX.

**Treat max-tokens as `blocked`.** Rejected: that would freeze the goal behind a blocker the user did not ask for.

## Consequences

- Truncated rounds no longer drop automatic authority.
- Output already written in that turn remains in the session log.
- Existing sessions that already stored `activation: disarmed` stay disarmed until an explicit resume.

## Related

[Harness-level loop](../feature/2026-07-16-harness-level-loop.md) still owns the other abnormal-terminal stop rules.
