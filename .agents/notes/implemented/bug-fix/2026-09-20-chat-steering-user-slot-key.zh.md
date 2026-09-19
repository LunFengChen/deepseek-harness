# Agent Note: 把准入后的 steering Chat 节点派发到 user keyed occupant

Status: implemented

[English](2026-09-20-chat-steering-user-slot-key.md) | 中文

## 问题

轮次中途插话是 Chat kind `steering`。ChatNodeSeat 按 `entryKey` 派发 `conversation.chat.node`。pending steering 是独立气泡，所以插话发送在轮次仍生成时看起来像用户消息。准入之后，缺失的 `steering` keyed occupant 落到 seat fallback。该 fallback 若是 unknown-surface JsonBlock，持久行就变成 `未知 surface 事件：steering`，而不是右对齐用户气泡。rewind、删除和重新生成活在 `conversation.chat.user-actions` 上，缺失 occupant 的 fallback 不渲染它们。

按 `node.kind` 分支的测试即使 `entryKey` 是 `steering` 且没有对应 occupant，仍会画出 `UserMessageNodeView`。kind `steering` 仍是 CSS、Turn-process 独立性和 rewind 候选的持久分类。

## 决策

ChatNodeSeat 把用户风格节点（`user` 和 `steering`）映射到 keyed entry `user`。seat 包装仍设置 `[data-chat-flow-kind=steering]`。`UserMessageNodeView` 已经接受这两种 kind，并渲染 `conversation.chat.user-actions`。缺失 occupant 的 fallback 仍是用户风格节点的 `UserMessageFallbackView`，以及其他 kind 的 unknown-surface JsonBlock，见[把缺失 keyed occupant 的 steering Chat 节点渲染成用户气泡](2026-09-18-chat-steering-unknown-surface.zh.md)。节点 kind 仍是 `steering`；共享的只是 slot key。

这部分取代该笔记里被拒绝的「把缺失的 steering 别名到 keyed user」。别名作用于 `entryKey`，不作用于 `node.kind`。

## 测试

`packages/client/ui-chat/tests/chat-view.client.spec.tsx` 钉住已结算 steering 节点为用户气泡，带 `[data-chat-flow-kind=steering]`，且没有 unknown-surface 标签。第二个用例在 `entryKey` 为 `steering` 时抛错，并期望 user occupant。pending 到持久节点的交接在轮次关闭后仍保持用户气泡。缺 renderer 的 fallback 路径仍为 steering 画出 `UserMessageFallbackView`，并为 `tool-call` 转储。

## 考虑过的替代方案

**继续按 `node.kind` 派发 `entryKey`，依赖 steering occupant 加上 fallback。** 拒绝：产品路径已经有带 user-actions 的可用 user occupant。第二个 key 是额外的 live-ledger 要求；没有该 occupant 的 fallback 会省略 rewind、删除和重新生成。

**把 Chat kind `steering` 塌成 `user`。** 拒绝：rewind、CSS、Turn-process 独立性，以及 conversation-node 测试已经区分 `steering`。转储是 keyed 派发未命中，不是 kind 写错。

**结算后保留 unknown-surface 转储。** 拒绝：插话发送是用户消息。节点数据的 JsonBlock 不是可接受的 Chat 行。

## 后果

- 准入后的 steering 使用与普通用户消息相同的 keyed renderer，包括 user-actions。
- kind `steering` 仍留在节点和 seat 包装上。
- `steering` keyed 注册仍可供想要独立 renderer 的 occupant 使用；ChatNodeSeat 不选择它。
- `message.unknownSurface` 仍是非 user/steering 的 Chat kind 的转储。
