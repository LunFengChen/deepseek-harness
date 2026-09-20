# Agent Note: default goal round cap is 100000

Status: implemented

English | [中文](2026-09-11-goal-default-round-cap.zh.md)

## Problem

Long-running same-session goals hit the previous default cap of 256 rounds and blocked with `round-limit`. Some tasks need tens of thousands of autonomous rounds. A hard 256 default stopped work the user still wanted to continue.

## Decision

`defaultMaxGoalRounds` remains a positive safe integer and still applies only when a create request omits its own cap. The deployment default is `100000`. `0` stays invalid for domain create/edit. Model-facing `create_goal` and `update_goal` omit `max_goal_rounds`; extra arguments of that name are ignored. Existing persisted goals keep the cap stored in their `goal/change` snapshots.

## Verification

`packages/goal/goal/tests/goal.spec.ts` asserts the default create cap is 100000 and still rejects `0`. `packages/goal/command-goal/tests/command-goal.spec.ts` asserts `/goal` status renders `Rounds: 0/100000`.

## Alternatives considered

**Treat `0` as unlimited.** Rejected: `hasRoundCap` already treats `0` as an unprovided tool field, so pause/resume and edit would not round-trip an explicit unlimited cap.

**Default to `Number.MAX_SAFE_INTEGER`.** Rejected: round prompts would render `Round: n/9007199254740991`.

**Remove `maxGoalRounds` from the snapshot.** Rejected: the projection invariant still requires a positive cap, and callers can still set a smaller opt-in limit.

## Consequences

- New goals without an explicit cap can run 100000 admitted rounds before `round-limit`.
- A domain create or edit that names its own cap still overrides the default. Model-facing `create_goal` and `update_goal` omit `max_goal_rounds` and ignore extra arguments of that name.
- Sessions that already stored 256, 8, or another cap stay on that stored value until an authorized edit.

## Related

[Harness-level loop](2026-07-16-harness-level-loop.md) and [persisted same-session goal domain](2026-07-19-persisted-same-session-goal-domain.md) keep the current default as a shipped fact.
