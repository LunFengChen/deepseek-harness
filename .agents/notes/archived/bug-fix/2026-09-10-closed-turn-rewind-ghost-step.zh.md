# Agent Note: 关闭 turn 后的 rewind ghost step

Status: implemented
Archived: 2026-09-10

[English](2026-09-10-closed-turn-rewind-ghost-step.md) | 中文

## Problem

Released v0-to-v3 restore 会在 `turn/end` 之后出现 `step/start` 时拒绝整个 Session。历史 rewind marker 会把这个 ghost step 写到已经关闭的 turn 上，好让后面的空 `assistant/message` 替换一段 surface。共用的 `~/.dsh` 会话因此打不开，包括 marker 之后又继续过的会话。

## Decision

当 `legacyClosedTurnGhostStep` 打开时，承认 turn 等于最后一个已关闭 turn、step 等于 next step 的 `step/start`，并且不重新打开该 turn。Ghost step 内的事件匹配这个 `(turn, step)`。`step/end` 清掉 ghost。随后的 `turn/start` 仍然使用已经前进过的 next-turn 编号。在 [残留的 v1 provenance](2026-09-10-v1-leftover-message-provenance.zh.md) 被丢掉之后，ghost replace 可以没有 `sourceEventSeqs`；replace 范围仍然会从当前 surface 上阴影掉对应节点。当前 rewind 写入仍然截断，不再追加 marker。

## Alternatives considered

**打开时截掉尾巴。** marker 之后的 turn 会消失。

**丢掉 marker 事件。** replace 会消失，被阴影掉的 user message 会回到模型上下文。

**为 ghost step 重新打开 `openTurn`。** 后面的 `turn/start` 会因为 turn 仍打开而失败。

**改写已存储的 v0 文件。** Adjacent migration 禁止覆盖已提交 generation。

## Consequences

带有历史 rewind ghost step 的会话可以 restore。原始 v0 artifact 保持不变。成功打开后，persistence 仍可能发布后继 generation。[关系测试](../../../../packages/session/session-format-v0-to-v1/tests/relationships.spec.ts) 覆盖该例外及其拒绝路径。[V3 restore](../../../../packages/session/session-format-v2-to-v3/tests/admission.spec.ts) 覆盖生产 restore 路径。
