# Agent Note: goal rounds continue after a turn-level model error

Status: implemented

[English](2026-09-11-goal-continue-after-turn-error.md) | 中文

## Problem

`goal-round-driver` 会在每次 `agent/error` 时停用自动续行。速率限制、提供方失败和上下文窗口错误因此会让仍处于 active 的目标在没有 blocker 的情况下进入空闲。长时间运行的目标看起来像是自己停了。

## Decision

一轮中的 `agent/error` 结束已接纳的 Round。驱动器不会停用续行。如果目标仍是 active 且 armed，下一次 idle 驱动会排队 `roundsStarted + 1`。取消、`ctx.sessions.flush()` 持久性检查点失败、插件卸载，以及模型报告的 `blocked` 仍然会停止续行。已经因 `model-reported` 被挡住的目标不会自动恢复。

## Verification

`packages/goal/goal-round-driver/tests/goal-round-driver.spec.ts` 会跑速率限制错误、普通请求错误、turn 结束后的 `agent/error`，以及失败的 `turn/end` 提交，每种后面再跟一个正常 Round。每种情况都在配置上限处到达 `round-limit`，而不是在第一轮之后静默停用续行。下游 pre-step hook 抛错仍然会失败关闭。

## Alternatives considered

**继续在 `agent/error` 时停用续行，好让人检查失败。** 否决：用户看到的是没有解释的空闲目标，而瞬时提供方错误正是无人值守 Round 应该重试的情况。

**用新的错误码把目标挡住。** 否决：这会把目标冻在用户并未要求的 blocker 后面，和把 max-tokens 当成 `blocked` 是同一个问题。

**只对 turn 结束后的持久性 `agent/error` 停用续行。** 否决：那不是持久性检查点。驱动器已经会在 `ctx.sessions.flush()` 失败时停止，避免再排下一轮。

## Consequences

- 一轮中的模型错误不再丢掉自动权限。
- 该轮已经写入的输出和错误记录仍留在会话日志里。
- 已经存成 `activation: disarmed` 的现有会话，在显式 resume 之前保持未激活。

## Related

[max-token 截断后 Goal Round 仍继续](2026-09-11-goal-continue-after-max-tokens.zh.md)
