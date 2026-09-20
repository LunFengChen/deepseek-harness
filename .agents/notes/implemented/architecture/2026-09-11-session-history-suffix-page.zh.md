# Agent Note: 会话历史从日志后缀打开

Status: implemented

[English](2026-09-11-session-history-suffix-page.md) | 中文

## Problem

打开已存储的 Session 历史时，会先把整份 JSONL 制品恢复成 Session，再返回最近约 50 条消息。因此点击一份 127MB 的 `session.jsonl.zstd` 就要付一次完整解码、完整对象图，以及一次 `snapshotEvents(0, seq)` 全量拷贝。写入/恢复仍然需要这次全量读取；查看路径不需要。

## Decision

`SessionPersistence.readHistorySuffix` 是可选的廉价尾页读取。JSONL 后端扫描 Zstandard 帧边界，只解压覆盖一页消息的最新帧，并且不会从 seq 0 构造 `SessionLogScanner`。未压缩日志从末尾回走完整 JSONL 行。历史代际返回 `undefined`，因此现有的“观察并迁移”路径仍然运行。尚未落盘的空 create 返回 cursor `-1`。

`SessionHistoryController` 对冷的普通 `page`/`follow` 使用该后缀。后缀查看不会 promote Session。仍在内存中的 Session 继续走 `observeSession`，并用 `eventAt` 加上 `snapshotEvents(cut, end)` 分页，这样 live 的 `events` getter 不会物化 seq 0。子代理地址、没有后缀方法的后端、以及返回 `undefined` 的后端，回退到原来的完整观察。

当后缀窗口里没有 seeded cut 时，后缀报告 `inheritedEventCount: 0`。投影缓存未命中保持为空。只有开放的 `turn/start` 落在后缀里时，才补 interrupted-turn closer。

## Alternatives considered

**继续恢复 Session，只在 `source.events` 之后分页。** 否决：live observation 的 getter 会在第一次读 `events` 时拷贝整份日志，而这正是点击后卡住的那一步。

**从磁盘流式解码，不持有压缩文件。** 这次不做：扫帧仍需要制品字节，而用户能感觉到的停顿是对象图恢复。以后可以用 mmap/窗口读丢掉 127MB 缓冲区，不必改分页契约。

**在后缀 follow 上 promote，让 prompt 已经是热的。** 否决：查看历史不得恢复 127MB Session；`prompt` 仍会为写入做观察。

## Consequences

- 冷历史点击只为最后一页消息付费，而不是整份日志。
- 打开历史不再激活 Agent。
- seeded 后缀视图在完整观察之前可能省略继承投影。
- 可写恢复和压缩仍然全量读取制品。

## Related

[会话历史、控制状态与 Remote 事件传输](2026-08-18-session-history-and-event-transport.zh.md) 仍然负责 page/follow 的 wire 类型。
