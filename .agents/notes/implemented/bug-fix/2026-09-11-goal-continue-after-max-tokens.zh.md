# Agent Note: goal rounds continue after max-token truncation

Status: implemented

[English](2026-09-11-goal-continue-after-max-tokens.md) | 中文

## Problem

`goal-round-driver` 把 `turn/end` 的 `max-tokens` 当成异常停止，并解除自动续行。被截断的模型输出还留在会话里，但目标会在没有 blocker 的情况下进入空闲。长时间运行的目标看起来像是莫名其妙停了。

## Decision

max-token 的 `turn/end` 结束已接纳的 Round。驱动器不会解除激活。如果目标仍是 active 且 armed，下一次 idle 驱动会排队 `roundsStarted + 1`。取消、持久性检查点失败，以及模型报告的 `blocked` 仍然会停止续行。

## Verification

`packages/goal/goal-round-driver/tests/goal-round-driver.spec.ts` 先跑一个 max-token Round，再跑一个正常 Round，并期望在配置上限处出现 `round-limit`，而不是在第一轮之后静默解除激活。

## Alternatives considered

**继续解除激活并要求人类 resume。** 否决：截断是单轮输出上限，不是目标级停止，用户看到的是没有解释的空闲目标。

**对同一 Round 再提示以续写被截断的文本。** 否决：Round 接纳已经消耗了编号，续写属于下一个 Goal Round，以及现有的 compact/continue UX。

**把 max-tokens 当成 `blocked`。** 否决：这会把目标冻在用户并未要求的 blocker 后面。

## Consequences

- 被截断的 Round 不再丢掉自动权限。
- 该轮已经写入的输出仍留在会话日志里。
- 已经存成 `activation: disarmed` 的现有会话，在显式 resume 之前保持未激活。

## Related

[Harness 级循环](../feature/2026-07-16-harness-level-loop.zh.md) 仍然负责其他异常终止停止规则。
