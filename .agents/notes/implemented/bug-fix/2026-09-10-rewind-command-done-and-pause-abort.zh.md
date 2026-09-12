# Agent Note: rewind command/done walk-back and pause abort

Status: implemented

[English](2026-09-10-rewind-command-done-and-pause-abort.md) | 中文

## Problem

当选中的 seq 是 `command/done`（或除 `assistant/message` 以外的非 human 事件）时，rewind 会失败，报 `session event at seq N is not a human user message (command/done)`。回退执行中点暂停只会取消正在跑的 Agent 轮次，不会中止斜杠命令的 execute，处理器仍可能把 `command/run` 截掉，UI 就会停在“执行中”的命令卡片上。

## Decision

`planRewind` 会把任意非 human 目标往回走到最近的 human `user/message`。会话暂停会调用 `commands.abortInflight(agent)`，让 rewind 处理器看到 `invocation.signal` 中止，返回 cancelled，并且不再恢复文件或截断日志。

## Verification

[LunFengChen/dsh-session-timeline](https://github.com/LunFengChen/dsh-session-timeline) 里的 `tests/rewind.spec.ts` 覆盖 `command/done` 回走。`pnpm exec vitest run packages/interaction/commands/tests/commands.spec.ts` 覆盖 `abortInflight` 结算 `command/done`。

## Alternatives considered

**继续拒绝所有非 assistant 目标。** 否决：UI 按钮和 `/rewind @seq` 会落在命令卡片上，失败后会话就没法用。

**暂停只取消 Agent 轮次。** 否决：rewind 是斜杠命令，日志被截断后不成对的 `command/run` 还会留下。

**在会话日志里清洗或改写历史 rewind 脏数据。** 此前已否决：脏事件从本地产物里剥掉，这次改动是阻止再产生不成对的 `command/run`。

## Consequences

- 从命令卡片或助手回答回退时，会从打开该轮的 human 提问开始截断。
- 回退执行中暂停会把命令结算为 cancelled，并且不截断日志。
