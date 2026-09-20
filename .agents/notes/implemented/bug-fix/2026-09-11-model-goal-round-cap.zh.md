# Agent Note: model tools do not apply a guessed goal round cap

Status: implemented

[English](2026-09-11-model-goal-round-cap.md) | 中文

## Problem

`create_goal` 和 `update_goal` 会接受 `max_goal_rounds` 并把它存成 `maxGoalRounds`。模型经常随手填 3 或 8。这个存下来的上限会在 `roundsStarted` 达到后挡住 resume，看起来像 harness 默认值，而不是模型参数。

## Decision

`create_goal` 和 `update_goal` 从参数 schema 中省略 `max_goal_rounds`，因此模型没有可填的字段。创建时使用 goal 服务的 `defaultMaxGoalRounds`（100000）。执行路径从不读取轮次上限：create、edit、pause、resume 或 complete 上的额外 `max_goal_rounds` 都会被忽略，包括 schema 变更后模型仍发送 3 或 8 的情况。直接的 `ctx.goals.create` / `edit` 仍接受显式上限，供测试和非模型调用方使用。已经持久化的快照保持原上限；模型 edit 不能抬高或降低它。

## Verification

`packages/goal/tool-goal/tests/tool-goal.spec.ts` 会用额外的 `max_goal_rounds: 9` 创建，并保持 `maxGoalRounds: 100000`。对领域层创建的上限为 8 的 goal 再带额外 `8` 做 edit，上限仍是 8。pause、resume 和 complete 带额外 `2` 会成功，而不是返回 `GOAL_TOOL_INVALID_UPDATE`。

## Alternatives considered

**保留 schema 字段，只忽略或抬高取值。** 否决：字段仍可见时，模型还是会填 3 或 8，这正是存成 8 的会话出现的原因。

**对所有领域 create 和 edit 都抬高，包括测试。** 否决：单元测试和可选 API 调用方仍需要小上限来覆盖 `round-limit`。

**改写已经存成 8 或 256 的会话日志。** 否决：已提交的会话产物保持不变。

**自动恢复已经因 `model-reported` 被挡住的 goal。** 否决：那是另一项模型判断，不是这个上限漏洞。

**删掉字段后拒绝额外的 `max_goal_rounds`。** 否决：参数对象是开放的，已录制和线上调用仍会发送该键；拒绝它会让那些调用继续失败。

## Consequences

- 模型创建时把 harness 默认值而不是 3 或 8 存成续行预算。
- 模型不能通过工具改 `maxGoalRounds`。
- 已经存成 8 的会话仍是 8，并且 `model-reported` 挡住的 goal 仍需要显式 resume。

## Related

[默认 Goal Round 上限为 100000](../feature/2026-09-11-goal-default-round-cap.zh.md)
[面向模型的同会话 goal 工具](../feature/2026-07-19-model-facing-goal-tools.zh.md)
