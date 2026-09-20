# Agent Note: model tools do not apply a guessed goal round cap

Status: implemented

English | [中文](2026-09-11-model-goal-round-cap.zh.md)

## Problem

`create_goal` and `update_goal` accepted `max_goal_rounds` and stored that number as `maxGoalRounds`. Models commonly guess 3 or 8. That stored cap later blocked resume once `roundsStarted` reached it, and it looked like a harness default rather than a model argument.

## Decision

`create_goal` and `update_goal` omit `max_goal_rounds` from their parameter schemas, so the model has no field to fill. The goal-service `defaultMaxGoalRounds` (100000) applies on create. Execute never reads a round cap: extra `max_goal_rounds` on create, edit, pause, resume, or complete is ignored, including when a model still sends 3 or 8 after the schema change. Direct `ctx.goals.create` / `edit` still accept an explicit cap for tests and non-model callers. Persisted snapshots keep their stored cap; a model edit cannot raise or lower it.

## Verification

`packages/goal/tool-goal/tests/tool-goal.spec.ts` creates with extra `max_goal_rounds: 9` and keeps `maxGoalRounds: 100000`. Edit with extra `8` on a domain-created cap-8 goal stays 8. Pause, resume, and complete with extra `2` succeed instead of returning `GOAL_TOOL_INVALID_UPDATE`.

## Alternatives considered

**Keep the schema field and ignore or floor the value.** Rejected: models still fill 3 or 8 when the field is visible, which is how the stored-8 session appeared.

**Floor every domain create and edit, including tests.** Rejected: unit tests and opt-in API callers still need small caps to exercise `round-limit`.

**Rewrite stored session logs that already contain 8 or 256.** Rejected: committed session artifacts stay unchanged.

**Auto-resume goals already blocked as `model-reported`.** Rejected: that blocker is a separate model judgment, not this cap hole.

**Reject extra `max_goal_rounds` after removing the field.** Rejected: the parameter object is open, and recorded plus live calls still send the key; rejecting it would keep those calls failing.

## Consequences

- A model create stores the harness default, not 3 or 8, as the continuation budget.
- A model cannot change `maxGoalRounds` through the tools.
- Sessions that already stored 8 stay on 8, and `model-reported` blocked goals still need an explicit resume.

## Related

[Default goal round cap is 100000](../feature/2026-09-11-goal-default-round-cap.md)
[Model-facing same-session goal tools](../feature/2026-07-19-model-facing-goal-tools.md)
