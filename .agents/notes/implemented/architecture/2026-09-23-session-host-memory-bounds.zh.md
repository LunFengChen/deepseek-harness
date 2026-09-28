# Agent Note: Session 宿主内存上限

Status: implemented

[English](2026-09-23-session-host-memory-bounds.md) | 中文

## Problem

存活的 Session 仍然在内存里持有完整事件日志。因此在 `xfdsh web` 里打开若干份大型已存储 Session，就会留下若干份完整对象图，外加用来构建它们的压缩文件。一份 121 MB 的 `session.jsonl.zstd` 解成约 341 MB UTF-8、约 39.7 万行 JSONL；V8 再持有 UTF-16 字符串和对象。运行几小时后，默认约 4 GB 的 old-space 会中止进程。

[会话历史从日志后缀打开](2026-09-11-session-history-suffix-page.zh.md) 已经能在不恢复 Session、不激活 Agent 的情况下分页最近约 50 条消息。恢复、压缩和观察仍然全量读取。后缀路径仍然把整份制品读进一个 Buffer。`ApiSessionAgentController` 丢弃了 `AgentHandle`，空闲 Agent 永远不会离开。

## Decision

API Session 保留它创建或恢复的每一个 `AgentHandle`。在观察或恢复 Session B 之前，只有最近用过的空闲普通根将超过五个时，它才会等待 dispose。这五个槽是 LRU：在五个 Session 之间切换不会重新挂载；第六个 Session 会丢掉最久未用的空闲根。正在运行的 Agent、进行中的 create/resume、子代理拥有的身份，以及由 B 拥有的 Agent 都会留下。控制器 fiber 在卸载时 dispose 剩余 handle。

已准备观察缓存继续使用现有的 5 槽 LRU，大型 Session 也一样。这套复用保持不动。

`SessionPersistence.readHistorySuffix` 打开代际文件，用滑动窗口扫描 Zstandard 帧边界。它只解压 header 帧，以及覆盖一页的最新事件帧。未压缩日志从末尾回走完整 JSONL 行。Buffer 解码器留给单元测试。

持久化存下构造 seed 之后，`Session.releaseLiveWindow()` 把 `this.log` 收成最多 `SESSION_LIVE_WINDOW_EVENTS` 条的连续尾巴，并在 `turn/start` 处切开。离开尾巴但仍被当前 surface、`request/header`、`request/context` 和 `turn/start` 需要的事件留在 `prefixHot`。`snapshotEvents` 只返回这条尾巴。写打开恢复通过 `adoptEvent` 把当前代事件流进 `Session.adoptRestoredEvent`，边流边收窗口，而不是用 `sessions.prepare` 复制一份完整 seed。投影单元和 token meter 在这条流上逐条 ingest 恢复事件，因此不会从存活尾巴重建。当这段尾巴不是完整的 `0..boundary` 前缀时，`ctx.sessions.fork` 抛出 `INVALID_BOUNDARY`。Remote API 的 fork 和窗口化的 `deleteFrom` 会重读已持久化前缀。历史 UI 从文件后缀分页；Trajectory 对尾部做虚拟化。它们不会在存活数组里打洞。

## Alternatives considered

**提高 `--max-old-space-size`。** 否决：用户再打开更多大型 Session，进程仍然会无限增长。

**拒绝恢复巨型 Session。** 否决：那些日志就是工作集；宿主应当丢掉空闲副本，而不是丢掉当前这份。

**把巨型 cut 从五槽已准备缓存里驱逐。** 否决：五槽复用是有用的；先要去掉的是空闲 Agent 和后缀整文件读入。

**在 `AgentRegistry` 自己内部驱逐。** 否决：handle 的所有者是 API Session；注册表无法知道 web 宿主还需要哪一个空闲根。

**把更早的事件在进程内留成 UTF-8 JSON。** 否决：那是把存活日志压得更密，而不是给读/渲染路径做窗口，而且它不是 Session 格式。

**在 `this.log` 里打洞（`this.log[seq] = undefined`）。** 否决：`ctx.sessions.fork` 和工具时子代理 seed 需要连续前缀。稀疏快照不是合法 seed。

**每次历史 `eventAt` 都从磁盘分页 `this.log`，并从已持久化前缀播种 fork。** 已做成存活尾巴加 `prefixHot`，而不是每个 seq 都读盘。历史 `eventAt` 只有落在尾巴或 `prefixHot` 里才有值。Remote API 的 fork 读已持久化前缀；进程内 `ctx.sessions.fork` 拒绝不完整的存活快照。

## Consequences

- 在五个最近用过的 Session 之间切换会留下这些 Agent。第六个空闲 Session 可能丢掉最久未用的 Agent；下次点击会从磁盘恢复。
- 历史后缀从文件描述符读取，并且只解压 header 加上尾页。
- 当前打开的 Session 只保留固定长度的尾巴和 `prefixHot`，不再持有完整事件图。恢复会把每个当前代事件流进这个窗口。它仍然会把每一帧、每一行扫一遍（CPU、一份压缩文件、一帧明文，再加上窗口）。迁移中或旧代的写打开仍会物化完整日志。
- 窗口化源上的 `ctx.sessions.fork` 在存活快照不是 `0..boundary` 前缀时抛错。API `fork` 从磁盘读。

## Related

[会话历史从日志后缀打开](2026-09-11-session-history-suffix-page.zh.md) 仍然负责分页契约以及“查看 vs 恢复”的划分。

[会话的 agent 由一份 preset cordis.yml 组装而成](2026-08-03-per-session-agent-presets.zh.md) 仍然负责 preset 组装；空闲根驱逐现在落在 API Session。

[弃用对会话任意位置事件的同步读取](2026-09-09-deprecate-synchronous-session-event-reads.zh.md) 仍然负责“停止在内存中保留完整序列”的存储方向。

[窗口化恢复在 ingest 期间折叠投影](../bug-fix/2026-09-28-windowed-restore-projection-fold.zh.md) 负责恢复期 ingest，使投影和 token-meter 折叠在尾巴窗口丢掉前缀之后仍然正确。
