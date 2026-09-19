# Agent Note: 把缺失 keyed occupant 的 steering Chat 节点渲染成用户气泡

Status: implemented

[English](2026-09-18-chat-steering-unknown-surface.md) | 中文

## 问题

轮次中途插话是持久 `user/message`，分类为 Chat kind `steering`。ChatNodeSeat 按该 kind 派发到 keyed `conversation.chat.node` slot。现场 keyed ledger 没有 `steering` occupant 时，seat fallback 是带 `message.unknownSurface` 标签、type 为 `steering` 的 JsonBlock。插话发送随后显示调试转储，而不是右对齐用户气泡。

分类、pending steering，以及已注册的 `UserMessageNodeView` 已经把准入后的 steering 当成普通用户气泡。转储只出现在缺 key 路径。把 kind `steering` 塌成 `user` 会搅动 Turn-process 独立 kind、`[data-chat-flow-kind='steering']`、rewind 候选选择，以及 snapshot 测试。

## 决策

保留 kind `steering`。keyed renderer 仍是 `UserMessageNodeView`，包括 `conversation.chat.user-actions` 子列表。该 keyed occupant 缺失时，ChatNodeSeat 渲染 `UserMessageFallbackView`：同一套用户气泡和复制操作，不含 user-actions 列表。其他 Chat kind 仍使用 unknown-surface JsonBlock。节点装配仍是[客户端 Conversation 业务节点装配](../architecture/2026-08-09-client-conversation-node-assembly.zh.md)里的 user/steering/context 划分。

## 测试

`packages/client/ui-chat/tests/chat-view.client.spec.tsx` 钉住一个 `steering` 节点，其 `renderSlot` 总是返回 seat fallback：输入文本出现在用户气泡中，且没有 unknown-surface 标签。同一条缺 renderer 路径仍转储 `tool-call`。`packages/client/ui-chat/tests/chat-branch-tails.client.spec.tsx` 里已有的已消费 steering 气泡覆盖不变。

## 考虑过的替代方案

**把已领取 steering 分类为 kind `user`。** 拒绝：rewind、CSS、Turn-process 独立性，以及 conversation-node 测试已经区分 `steering`。转储是 keyed occupant 缺失，不是 kind 写错。

**在 seat fallback 里复用 `UserMessageNodeView`。** 拒绝：该 view 会调用 `renderSlot('conversation.chat.user-actions')`，Chat view binding 并未授权这个子 slot。fallback 不能假装子列表存在。

**把缺失的 `steering` 别名到 keyed `user`。** slot key 复用是[把准入后的 steering Chat 节点派发到 user keyed occupant](2026-09-20-chat-steering-user-slot-key.zh.md)里的产品派发。本笔记仍拥有缺失 occupant 的 fallback 以及 kind `steering`。

**保留 unknown-surface 转储。** 拒绝：插话发送是用户消息。节点数据的 JsonBlock 不是可接受的 Chat 行。

## 后果

- keyed `steering` renderer 缺失时，插话发送仍显示为用户气泡。
- 该行上的 rewind、删除和重新生成仍要求 keyed renderer 加上 session-timeline 的 user-actions。fallback 省略这些操作。
- `message.unknownSurface` 仍是非 user/steering 的 Chat kind 的转储。

## 相关

[把准入后的 steering Chat 节点派发到 user keyed occupant](2026-09-20-chat-steering-user-slot-key.zh.md) 拥有用户风格节点的 ChatNodeSeat `entryKey` 映射。
