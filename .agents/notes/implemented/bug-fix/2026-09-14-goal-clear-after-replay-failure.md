# Agent Note: goal clear recovers a retained replay failure

Status: implemented

English | [中文](2026-09-14-goal-clear-after-replay-failure.zh.md)

## Problem

A historical `goal/change` that fails strict replay, such as a resume after the round budget is exhausted, is retained in the `goal` projection as `failure`. Host `get`, `clear`, and every other mutation then threw that failure. The client view still showed the last valid goal, so the UI offered delete, but the Host refused. `create_goal` was also blocked, so the session could not replace the stuck objective.

## Decision

Keep the strict fold. Do not admit invalid historical resumes. After a retained replay failure, `get` and `clear` use the last valid current goal. A matching `goal/change` clear tombstone applies against that last valid current, clears `failure`, and returns the projection to `null`. Pause, resume, edit, complete, block, and create stay rejected until that recovery-clear succeeds.

## Verification

`packages/goal/goal/tests/projection.spec.ts` poisons a live projection, asserts `get` still returns the last valid goal, asserts pause and create still throw, then clears and creates a replacement. The same file applies a matching recovery-clear through `applyGoalProjection` and keeps a stale clear as a no-op.

## Alternatives considered

**Skip invalid historical resumes in the fold.** Rejected: later events may assume the resume happened, and rewriting history would hide integrity failures.

**Let every mutation apply against the last valid current after failure.** Rejected: pause, resume, and create would silently ignore the invalid record and diverge from the log.

**Require repairing or rewriting the session log.** Rejected: the user-facing fix is to delete the stuck goal and start another; the invalid record can stay in the log.

## Consequences

- A stuck goal can be cleared from the Goal bar or `/goal clear`.
- After that tombstone, a new goal can be created in the same session.
- Invalid historical `goal/change` records remain in the session log.
- Other host mutations still fail loud until the recovery-clear.

## Related

[Persisted same-session goal domain](../feature/2026-07-19-persisted-same-session-goal-domain.md) still owns the compare-and-set lifecycle and the strict fold.
