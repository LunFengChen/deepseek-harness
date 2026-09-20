# Agent Note: fork drops the source agent's live inbox

Status: implemented

[English](2026-09-17-fork-drops-source-inbox.md) | 中文

## Problem

Fork 会复制一段已完成的对话前缀，其中包含用于重建源 agent 待处理 `next-turn` 与 `next-step` 列表的 `agent/inbox/spliced` 事件。从已经结束的前缀创建的子会话，会把父会话排队中的提示词当成自己的实时输入。同一会话的 resume 必须保留这些列表；fork 不能带走它们。如果 fold 把带 `inherited` 的 `session/end-seed` 当作队列切点，就无法重建那些已经按源队列坐标写下后续 splice 的子会话。

## Decision

带 seed 的 `agents.create` 会先从 prefix 重建源队列，再在继承而来的 `session/end-seed` 之后、setup 之前记下 `inbox.clear()` 的 cancel splice。inbox fold 对持久化 splice 保持无损：带 `inherited` 或未标记的 `session/end-seed` 都不会清空列表。因此，从源队列继续写下去的子会话在 resume 时仍能应用那些后续 splice。新的 fork 会因为日志里自己的 cancel splice 而以空队列开始。父会话不变。inbox 重建与领取生命周期仍由 [claimed pre-step inbox lifecycle](../architecture/2026-07-31-claimed-pre-step-inbox-lifecycle.zh.md) 记录。

## Verification

`pnpm exec vitest run packages/core/agent-loop/tests/inbox.spec.ts packages/core/agent-loop/tests/agent.spec.ts`

## Alternatives considered

**在 inbox fold 里把带 `inherited` 的 `session/end-seed` 当作队列切点。** 这能在不追加事件的情况下让全新子会话丢掉源队列，但也会在那些仍使用源队列坐标的后续 splice 之前把队列清空。重建随后会以 `invalid persisted inbox splice` 失败。

**把 `inheritedEventCount` 存进 fold 状态，从而跳过每条继承 splice。** 这需要宿主专用字段、`stateVersion` 递增，以及剥掉该字段的 wire view。它仍会在当前切点清空队列，因此从源队列继续写下去的子会话无法 resume。

**从 fork seed 里剥掉 inbox 事件。** seq 是日志位置；丢掉这些行会留下空洞。

## Consequences

- 即使复制的前缀在轮次之间包含入队 splice，从已结束前缀 fork 出的子会话也以空 inbox 开始。
- 对 fork 子会话做 resume 会恢复该子会话随后的 splice，包括那些对着继承标记之后仍存活的源队列写下的 splice。
- UI 队列帧跟随 inbox 投影，因此新子会话不会继承源会话控制流上的队列。
