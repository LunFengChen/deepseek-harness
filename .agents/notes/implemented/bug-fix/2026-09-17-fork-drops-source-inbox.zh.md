# Agent Note: fork drops the source agent's live inbox

Status: implemented

[English](2026-09-17-fork-drops-source-inbox.md) | 中文

## Problem

Fork 会复制一段已完成的对话前缀，其中包含用于重建源 agent 待处理 `next-turn` 与 `next-step` 列表的 `agent/inbox/spliced` 事件。从已经结束的前缀创建的子会话，会把父会话排队中的提示词当成自己的实时输入。同一会话的 resume 必须保留这些列表；fork 不能带走它们。

## Decision

inbox 投影把带 `inherited` 的 `session/end-seed` 当作源 agent 实时队列的结束。折叠该标记会得到空的 `next-turn` 与 `next-step` 列表。子会话随后的 splice 会保留。未标记的 resume `session/end-seed` 不会清空列表。父会话不变。持久化的 splice 历史仍留在继承前缀里；被清空的只是子会话的实时待处理输入。inbox 重建与领取生命周期仍由 [claimed pre-step inbox lifecycle](../architecture/2026-07-31-claimed-pre-step-inbox-lifecycle.zh.md) 记录。

## Verification

`pnpm exec vitest run packages/core/agent-loop/tests/inbox.spec.ts`

## Alternatives considered

**把 `inheritedEventCount` 存进 fold 状态，从而跳过每条继承 splice。** 这需要宿主专用字段、`stateVersion` 递增，以及剥掉该字段的 wire view。继承而来的 end-seed 已经标出了这个切点。

**在 `agents.create` 之后再追加清空 splice。** 子会话会先短暂重建父会话队列，再多记一轮变更。继承标记已经在同一次 fold 里执行。

**从 fork seed 里剥掉 inbox 事件。** seq 是日志位置；丢掉这些行会留下空洞。

## Consequences

- 即使复制的前缀在轮次之间包含入队 splice，从已结束前缀 fork 出的子会话也以空 inbox 开始。
- 对 fork 子会话做 resume 仍会恢复该子会话自己随后的 splice，因为继承标记已经在那些 splice 之前清空了父会话队列。
- UI 队列帧跟随 inbox 投影，因此新子会话不会继承源会话控制流上的队列。
