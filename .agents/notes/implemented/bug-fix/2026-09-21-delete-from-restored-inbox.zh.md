# Agent Note: drain restored inbox splices after conversation truncation

Status: implemented

[English](2026-09-21-delete-from-restored-inbox.md) | 中文

## Problem

重新生成会从用户消息 seq 截断，再把原文作为新一轮 prompt。`deletionStart` 按轮切割，会回溯到 `turn/start`。把该用户消息送进 inbox 的 `agent/inbox/spliced` 记在 `turn/start` 之前。截断因此留下 splice、丢掉 claim。重放前缀会把原问题放回 inbox。随后 regenerate 的 `prompt('queue')` 再追加一份。先被认领的是恢复出来的那份，变成新的用户轮；第二份留在 `next-turn`，或在轮中被当成插话，于是 UI 先重发问题，再出现 interrupt。

同一条活 Agent 仍带着 `requestHeaderLogged`。截断也丢掉了 `request/header`，下一次 `prepareRequest` 会对 `undefined` 折叠，新一轮在 `user/message` 之前就失败。

## Decision

`deleteFrom` 截断持久化和内存日志之后调用 `agent.inbox.clear()`。空列表是 no-op splice。被恢复的 turn 前 splice 属于被删的那一轮，不是之后排队的工作（运行中排队的 next-turn 记在 `turn/start` 之后，已经被截掉）。

`prepareRequest` 若看到 `requestHeaderLogged` 但 `session.requestHeader()` 已经不在，就清掉该标记并用声明的路由做 seed。空前缀上的下一条 header 是 `initial`。归属功能记录是 [会话轮次尾部的真实删除](../feature/2026-09-10-destructive-session-tail-deletion.zh.md)。

## Verification

`packages/api/session-controller/tests/commands-delete.host.spec.ts` 跑一轮真实 AgentLoop，从用户消息删除，断言 inbox 为空。再用同一文本 followup，日志里只有一条用户消息，没有第二条，也不是 steering。

`packages/core/agent-loop/tests/agent.spec.ts` 截掉已记录的 header，清掉被恢复的 splice，followup 仍能写入用户消息。

## Alternatives considered

**让 `deletionStart` 连带着往回吃掉连续的 inbox splice。** 不能当唯一修复：常见的 wake 然后 `turn/start` 好认，inject/cancel 噪声就脆。重放后再清空才是稳定不变量。

**只改 timeline 插件的 regenerate。** 否决：截断再 prompt 是 Host 契约。任何客户端截断后重提都会碰到恢复出来的 splice。

**用 `keepInbox: false` 的 cancel 代替截断后清空。** 否决：cancel 发生在截断前。那时清掉了，保留前缀里的 turn 前 splice 仍在，重放还是会恢复。

**只靠监听 `session/truncated` 重置 driver 标记。** 不能当唯一的 header 修复：`prepareRequest` 已经在读保留的 header。把缺失的 header 当成「还没记过」是局部不变量；truncate 监听会把这件事再做一遍。

## Consequences

- 删除和重新生成不会再把被截断那一轮的用户消息复活成 pending inbox。
- 属于被删未来的 QueueDock 项仍然随那截未来一起消失。
- 若有东西被恢复，截断前缀后面可能出现 inbox cancel splice；这比再发一次便宜。
- 被截掉 header 的活 Agent 可以开始下一轮，而不是在 `prepareRequest` 里失败。
