# Agent Note: goal clear recovers a retained replay failure

Status: implemented

[English](2026-09-14-goal-clear-after-replay-failure.md) | 中文

## Problem

一条无法通过严格回放的历史 `goal/change`（例如 Round 预算耗尽后的 resume）会作为 `failure` 留在 `goal` 投影里。之后宿主的 `get`、`clear` 和所有其他变更都会抛出该失败。客户端视图仍显示最后有效的 goal，所以界面提供删除，但 Host 拒绝执行。`create_goal` 也被挡住，会话无法替换这个卡住的目标。

## Decision

保持严格折叠。不要放行非法的历史 resume。保留回放失败后，`get` 和 `clear` 使用最后有效的当前 goal。匹配该当前 goal 的 `goal/change` clear tombstone 会清掉 `failure`，并把投影恢复为 `null`。pause、resume、edit、complete、block 和 create 在这次恢复性 clear 成功之前保持拒绝。

## Verification

`packages/goal/goal/tests/projection.spec.ts` 会污染一个活动投影，断言 `get` 仍返回最后有效 goal，断言 pause 和 create 仍会抛错，然后 clear 并创建替换目标。同一文件通过 `applyGoalProjection` 应用匹配的恢复性 clear，并把陈旧 clear 保持为无操作。

## Alternatives considered

**在折叠中跳过非法的历史 resume。** 否决：后续事件可能假定这次 resume 已经发生，改写历史会掩盖完整性失败。

**失败后让每一种变更都针对最后有效当前 goal 生效。** 否决：pause、resume 和 create 会静默忽略非法记录，并与日志分叉。

**要求修复或重写会话日志。** 否决：面向用户的修复是删除卡住的 goal 再开一个；非法记录可以留在日志里。

## Consequences

- 卡住的 goal 可以从 Goal 条或 `/goal clear` 清除。
- 写入该 tombstone 后，同一会话可以创建新 goal。
- 非法的历史 `goal/change` 记录仍留在会话日志中。
- 在恢复性 clear 之前，其他宿主变更仍然会大声失败。

## Related

[持久的同会话 goal 领域](../feature/2026-07-19-persisted-same-session-goal-domain.zh.md) 仍然负责比较并设置的生命周期与严格折叠。
