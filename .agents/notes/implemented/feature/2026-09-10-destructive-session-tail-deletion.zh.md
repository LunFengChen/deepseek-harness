# Agent Note: 会话轮次尾部的真实删除

Status: implemented

[English](2026-09-10-destructive-session-tail-deletion.md) | 中文

## Problem

Fork 会话删除不满意回答的速度太慢，而 rewind 标记会把不想要的事件留在源会话里。后续模型请求仍会携带这些历史。

## Decision

删除、回退和重新生成共用一次截断：把选中的可见消息定位到所属 `turn/start`，刷新待写入事件，将当前 JSONL generation 重写为该前缀，丢弃序号大于等于保留长度的已路由实时事件，再截断内存中的 `Session`（发出 `session/truncated`）并重建派生投影。历史格式 generation 不会被移动、覆盖或删除。发起操作的客户端会重新同步，因此下一次请求只使用保留的历史。

时间线按钮对仅对话截断调用 `deleteFrom`。`/rewind @seq both` 先恢复已追踪的工作区文件，再截断。重新生成先读取持久化图片，截断后再提交原始用户内容。插件不再追加 surface 标记。如果命令 handler 截掉了对应的 `command/run`，就跳过 `command/done`，避免出现孤儿配对。

Agent 运行期间拒绝删除，fork 继承的事件也不能删除。不支持重写的后端会明确失败。

## Alternatives considered

**Fork 一个替代会话。** 这种做法会保留原历史，并继续承担促成本功能的慢速 fork 路径。

**追加 rewind 标记并隐藏尾部。** 被隐藏的记录仍会出现在后续模型请求中，也仍然持久化，因此不是删除。

**只删除选中的消息事件。** 消息事件属于完整轮次，保留半个轮次可能导致回放或模型历史无效。

## Consequences

截断不可撤销。选中轮次及其后的记录会从当前持久化 generation 和内存会话中消失。其他已打开的客户端在会话改变后需要重新加载。重写失败时保留原来的当前 generation 文件。
