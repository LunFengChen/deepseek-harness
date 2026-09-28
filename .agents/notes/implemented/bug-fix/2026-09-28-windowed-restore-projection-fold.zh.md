# Agent Note: Windowed restore folds projections during ingest

Status: implemented

[English](2026-09-28-windowed-restore-projection-fold.md) | 中文

## Problem

持久化恢复现在把事件流进一段存活 RAM 尾巴。窗口丢掉前缀之后，`snapshotEvents()` 只剩这条尾巴。投影 cell 和 token meter 仍把这条尾巴当成从 seq 0 开始的完整日志来折叠。

如果后来的 surface replace 其 `startSeq` 落在 `liveBaseSeq` 之前，就会报 `token surface: replace at seq N has invalid current range`。存储日志本身是连续且合法的。折叠缺的是窗口已经丢掉的 surface 节点，包括后续 replace 仍然点名的那些节点。

`adoptRestoredEvent` 不发布 `session/event`，所以普通的主动驱动看不到恢复前缀。恢复之后第一次 `snapshot()` 或 `measure()` 才是第一次折叠，而且跑在尾巴上。

## Decision

`SessionProjectionRegistry.ingestRestoredEvent` 和 `TokenMeter.ingestRestoredEvent` 把一条恢复事件折进已有的逐会话状态。缺少 cell 或回放状态时从 `init` / 空 surface 开始，水位为 `-1` 或已消费 seq `0`。它们不会调用 `snapshotEvents()`，也不会用 `eventAt` 穿越已丢掉的前缀。

`AgentLoop.resumeWith` 在流式 `adoptEvent`、`handle.read(0)` 回退、以及中断回合 closer 共用的 `adopt` 辅助函数里调用这两个 ingest。未挂载 token meter 时跳过它的 ingest。

token-meter `_sync` 在没有已 ingest 的回放状态时拒绝从存活尾巴重建。投影 `cellFor` 仍会为恢复之后才注册的单元从尾巴迟到补建——那些单元从未见过已丢掉的前缀。

`Session.beginPersistedRestore` 接受可选的继承切点，以便已经知道该切点的调用方能在首次 ingest 之前给 `init` 播种。恢复仍在扫描结束后由 `finishPersistedRestore` 记录持久切点；当前格式的 `stat` 不暴露该切点。

## Alternatives considered

**把完整事件图留在 RAM 里，让迟到补建继续正确。** 否决：那正是存活窗口要避免的宿主 OOM。

**用尾巴加上 `prefixHot` 做迟到补建。** 否决：`prefixHot` 保留的是当前 surface 节点，不是已被替换掉、但后续 replace 仍会点名的 seq。缺的恰好是 replace 需要的那个节点。

**第一次 snapshot 时重读持久化前缀来重建。** 否决：恢复已经把每条事件扫过一遍；再整段读一次会在用户继续 Session 的时刻抵消窗口的内存上限。

**提高 `--max-old-space-size`，或把折叠推迟到更晚的请求。** 否决：进程照样会涨，而且第一次 continue/measure 仍然需要正确的 surface。

**改写存储日志，删掉跨越窗口的 replace 区间。** 否决：产物是合法的；缺陷在进程内折叠。

## Consequences

打开一个大型已存储 Session，随后测量或 snapshot，不会只因为 replace 点名了存活尾巴之前的 seq 就抛出 `invalid current range`。新的存活追加从已 ingest 的水位继续，并通过尾巴上稠密的 `eventAt` 前进。

在窗口化 Session 已经存在之后才注册的投影单元只会从存活尾巴迟到补建。必须看见已被替换掉的前缀节点的单元，要在恢复之前挂载，并在流上 ingest。

`init` 会读 `inheritedEventCount` 的单元在流式恢复期间看到的是 `0`，除非调用方把切点传进了 `beginPersistedRestore`。持久切点仍在 finish 时写入 Session 元数据。

## Related

[Session 宿主内存上限](../architecture/2026-09-23-session-host-memory-bounds.zh.md) 仍然拥有存活尾巴、`prefixHot` 和流式 `adoptRestoredEvent`。

[废弃对任意 Session 事件的同步读取](../architecture/2026-09-09-deprecate-synchronous-session-event-reads.zh.md) 仍然拥有不再把完整序列留在内存里的方向。
