# Agent Note: strip pre-turn inbox splices during deleteFrom

Status: implemented

[English](2026-09-28-delete-from-pre-turn-inbox-splices.md) | 中文

## Problem

`deleteFrom` 清空活 inbox 之后，重新生成仍会把原问题当成插话再发一次。`deletionStart` 按轮切割，停在 `turn/start`。把该轮送进 inbox 的 `agent/inbox/spliced` 记在 `turn/start` 之前，所以保留前缀里还有它。截断观察者丢掉 projection cell 再按此前缀重建，原问题就回来了。Timeline 的重新生成接着 `prompt('queue')`。若一轮已经认领了恢复出来的那份，第二份就会按 steering 进入，Chat 结算时还可能把这行收成未知的 `steering` 事件。

[截断后排空被恢复的 inbox splice](2026-09-21-delete-from-restored-inbox.zh.md) 已经在 truncate 之后调用 `inbox.clear()`。Clear 删不掉前缀里的 wake 事件，所以之后的重建或 regenerate 的 prompt 仍会看到两份。

## Decision

`deleteFrom` 把删除偏移沿着紧挨被删 `turn/start` 的连续 `agent/inbox/spliced` 往回走，不越过 `inheritedEventCount`。持久化和内存日志再缩到这个更早的偏移。若活 RAM 窗口就从这次 `turn/start` 开始，wake splice 已经不在内存里，现场回走会停；`deleteFrom` 再读持久化前缀，在替换活日志之前丢掉尾部 inbox splice。truncate 之后仍调用 `inbox.clear()`，以便丢掉 `session/truncated` 期间重建出来的活 inbox。

重新生成仍走现在的客户端契约：先截掉这一轮，再把原文按 `queue` prompt 一次。保留前缀里不再有被删那一轮的 wake splice，所以这次 prompt 是唯一的一份。

## Alternatives considered

**截断后只靠 `inbox.clear()`。** 否决：wake splice 仍留在前缀里。重放、windowed 前缀替换，以及 regenerate 随后的 prompt，仍可能把它恢复或复制成插话。

**只改 timeline 的重新生成，让它续跑恢复出来的 wake，而不再 prompt。** 不能当唯一修复：删除和重新生成共用 `deleteFrom`。删除时续跑会把用户要去掉的一轮重新开始。Host 前缀无法重放被删问题，所有客户端才安全。

**让 `deletionStart` 自己吃掉尾部 inbox splice。** 否决：其他调用方要用轮边界。会话截断才拥有这段额外回走。

## Consequences

删除和重新生成不会再把被删那一轮的 wake splice 留在保留前缀里。truncate 之后若活 inbox 被重建，仍可能出现 inbox cancel splice，这比再发一次便宜。Timeline 重新生成仍会把原问题作为新的 followup 提交一次，而不是插话。

## Related

[截断后排空被恢复的 inbox splice](2026-09-21-delete-from-restored-inbox.zh.md) 仍然拥有截断后的 inbox 清空。

[会话轮次尾部的真实删除](../feature/2026-09-10-destructive-session-tail-deletion.zh.md) 仍然拥有按轮切割的 `deleteFrom`。
