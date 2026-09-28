# Agent Note: Windowed projections snapshot the current surface

Status: implemented

[English](2026-09-28-windowed-surface-replace-bootstrap.md) | 中文

## Problem

窗口化 Session 的存活尾巴不是完整前缀。投影迟到补建仍把 `snapshotEvents()` 当作 seq 0 折叠。如果后来的 surface replace 其 `startSeq` 落在 `liveBaseSeq` 之前，就会报 `token surface: replace at seq N has invalid current range`。

存储日志本身是连续且合法的。折叠缺的是窗口已经丢掉的 surface 节点，包括后续 replace 仍然点名的那些节点。token-meter `measure()` 在恢复 ingest 缺失时已经会快照当前 surface。投影 `snapshot()` 和第一次存活 `session/event` 没有。

## Decision

`ProjectionDefinition.bootstrapWindowed(session)` 在窗口化 Session 还没有已 ingest 的 cell 时，快照当前 Session 持有的状态。`SessionProjectionRegistry.cellFor` 和第一次存活 `drive` 在 `liveBaseSeq > 0` 时调用它。cell 水位是当前游标或触发事件 seq。注册表不再 apply 该事件：它已经在 Session 里。

`contextBreakdown` 通过 `eventAt` 和 `priceCurrentSurfaceNode` 给 `session.surface.nodes` 计价。缺失或非 surface 节点会抛 `contextBreakdown cannot price surface node N missing from the live window`。工具来自 `session.requestHeader()`。

需要已被替换掉的前缀事件的单元，仍在恢复时走 `ingestRestoredEvent`。`planSurfaceTokens` 对无法解析的 replace 仍然抛错。不承认跳过脏 replace。

## Alternatives considered

**在 `planSurfaceTokens` 里跳过非法 replace。** 否决：提交日志在 append 时已经做过 surface 校验。无法解析的区间是日志损坏，必须响亮失败。

**用尾巴加上 `prefixHot` 重放 replace 做迟到补建。** 否决：`prefixHot` 保留的是当前 surface 节点，不是已被替换掉、但历史 replace 仍会点名的 seq。应该快照当前 surface，而不是重放那些区间。

**第一次 snapshot 时重读持久化前缀。** 否决：恢复已经把每条事件扫过一遍；再整段读一次会抵消窗口的内存上限。

**投影迟到补建继续抛错。** 否决：打开一个合法的长 Session 再 snapshot `contextBreakdown` 就会失败，尽管 `measure()` 已经能给同一块 surface 计价。

## Consequences

打开窗口化 Session 再 snapshot `contextBreakdown`，会给当前 surface 计价，而不重放已丢掉的 replace 区间。之后对当前节点的 replace 从该快照继续折叠。

没有 `bootstrapWindowed` 的单元仍折叠存活尾巴。若那条尾巴里有针对已丢掉 seq 的 replace，这些单元仍会抛错；它们若需要已被替换掉的前缀节点，必须保持挂载以走恢复 ingest。

## Related

[窗口化恢复在 ingest 时折叠投影](2026-09-28-windowed-restore-projection-fold.zh.md) 仍然拥有恢复 ingest，也就是保留 usage 锚点和已被替换掉的 seq 的路径。

[Session 宿主内存上限](../architecture/2026-09-23-session-host-memory-bounds.zh.md) 仍然拥有存活尾巴、`prefixHot`，以及已释放 seq 上 `eventAt` 返回 `undefined`。

[窗口化 Session 在上下文溢出时压缩](2026-09-28-windowed-overflow-compaction.zh.md) 拥有 token-meter `measure()` 的 surface 快照。
