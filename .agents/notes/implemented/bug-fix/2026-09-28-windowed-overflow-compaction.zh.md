# Agent Note: Windowed Sessions compact on context overflow

Status: implemented

[English](2026-09-28-windowed-overflow-compaction.md) | 中文

## Problem

pi-ai 确认的 `CONTEXT_WINDOW_EXCEEDED` 已经会进入溢出恢复。在存活窗口化的 Session 上，这次恢复仍会让本轮失败，随后 `/compact` 报 `token meter cannot rebuild a windowed Session from its live tail` 或 `Compaction could not produce a useful summary`。

两处扫描仍从 `session.seq - 1` 走到 `0` 调用 `eventAt`。窗口丢掉前缀后，第一个缺失 seq 就会抛错。恢复 ingest 没填回放状态时，token-meter `measure()` 也会抛错。摘要器接着把几乎整段已经溢出的 surface 再发给同一个模型，辅助调用再次溢出，于是原始请求错误被保留。

## Decision

token-meter `measure()` 在回放状态缺失时，从存活尾巴和 prefixHot 快照当前 surface。恢复 ingest 仍保留 usage 锚点和已被替换掉的 seq。

压缩锁检查只走 `snapshotEvents()`，也就是存活尾巴。开放回合的 `turn/start` 留在这条尾巴里，因为窗口不会切开进行中的回合。留在已释放前缀里的 `session/end-seed` 是未读，不是损坏。

若摘要器自己以 `CONTEXT_WINDOW_EXCEEDED` 结束，区域事务会落下一段短的回退检查点，让 surface 仍然缩小，溢出恢复可以重试。其他摘要失败仍保持失败闭合。

## Alternatives considered

**ingest 缺失时继续抛错。** 否决：所有长 Session 只要恢复漏了 ingest，`/compact` 和溢出恢复都会让本轮失败，包括第一次 measure 还没跑、会话随后才窗口化的存活对话。

**重读持久化前缀来重建 meter 和压缩锁。** 否决：那会在用户正要继续的时刻抵消宿主内存上限。

**让摘要器溢出保持为压缩失败。** 否决：用户可见的这一轮已经溢出；恢复调用再用同一个 code 失败，会话就会卡住。

## Consequences

窗口化 Session 上的 `CONTEXT_WINDOW_EXCEEDED` 可以压缩并重试，而不再停住本轮。`/compact` 可以在存活尾巴上运行，不必扫描已释放 seq。回退检查点会丢细节；它仍然比被遮蔽的 span 更短。

## Related

[窗口化恢复在 ingest 时折叠投影](2026-09-28-windowed-restore-projection-fold.zh.md) 仍然拥有恢复 ingest。

[Skill catalog 历史停在存活 RAM 窗口](2026-09-28-skill-catalog-windowed-prefix.zh.md) 是同一类走到 seq 0 的 `eventAt` 扫描。

[把 Grok 和 pi-ai 上下文溢出分类](2026-09-14-pi-ai-context-overflow-classification.zh.md) 仍然拥有把提供方溢出映射到 `CONTEXT_WINDOW_EXCEEDED`。
