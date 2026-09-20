# Agent Note: default goal round cap is 100000

Status: implemented

[English](2026-09-11-goal-default-round-cap.md) | 中文

## Problem

长时间运行的同会话目标会撞上原先默认的 256 轮上限，并以 `round-limit` 阻塞。有些任务需要上万轮自治 Round。硬编码的 256 默认值会在用户仍希望继续时停掉工作。

## Decision

`defaultMaxGoalRounds` 仍然是正的安全整数，并且只在 create 请求省略自身上限时生效。部署默认值是 `100000`。领域层 create/edit 仍然拒绝 `0`。面向模型的 `create_goal` 和 `update_goal` 不暴露 `max_goal_rounds`；同名额外参数会被忽略。已经持久化的目标继续使用其 `goal/change` 快照里保存的上限。

## Verification

`packages/goal/goal/tests/goal.spec.ts` 断言默认 create 上限是 100000，并且仍然拒绝 `0`。`packages/goal/command-goal/tests/command-goal.spec.ts` 断言 `/goal` 状态渲染 `Rounds: 0/100000`。

## Alternatives considered

**把 `0` 当作无限。** 否决：`hasRoundCap` 已经把 `0` 当作未提供的工具字段，pause/resume 和 edit 无法把显式无限上限来回传递。

**默认使用 `Number.MAX_SAFE_INTEGER`。** 否决：Round 提示会渲染 `Round: n/9007199254740991`。

**从快照里删除 `maxGoalRounds`。** 否决：投影不变量仍然要求正数上限，而且调用方仍可设置更小的可选上限。

## Consequences

- 未显式指定上限的新目标可以在 `round-limit` 之前运行 100000 个已接纳 Round。
- 领域层自行指定上限的 create 或 edit 仍然覆盖默认值。面向模型的 `create_goal` 和 `update_goal` 不暴露 `max_goal_rounds`，并忽略同名额外参数。
- 已经存成 256、8 或其他上限的会话，在授权编辑之前保持该存储值。

## Related

[Harness 级循环](2026-07-16-harness-level-loop.zh.md) 和 [持久化的同会话目标领域](2026-07-19-persisted-same-session-goal-domain.zh.md) 把当前默认值保持为已交付事实。
