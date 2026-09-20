# Agent Note: 破坏性截断必须丢弃已路由的实时事件

Status: implemented

[English](2026-09-16-session-truncate-live-seq.md) | 中文

## Problem

回退、删除和重新生成会把持久化日志重写成更早的前缀，再截断内存中的 `Session`。JSONL 写入方还会把 `session/event` 流量缓冲最多 200 ms。在 `drainLive()` 返回之后到达的事件——重写期间，或持久化截断与内存截断之间——仍带着旧 `seq`。下一次 `session/flush` 就会以 `append seq mismatch`（`expected <retained> at index 0, got <old seq>`）失败，失败批次留在缓冲里，之后同一进程的每一轮都同样失败。用户再输入时，Web UI 看起来像卡死。

投影单元 cell 有同样的缺口：它们只在 `session/event` 上前进，水位若已越过截断后的日志，就会跳过每一条新事件，直到 `seq` 超过旧尾部。

## Decision

JSONL `truncate` 在重写后丢弃序号大于等于保留长度的已路由实时事件。挂到 store 上的 `Session.truncate` 在活日志已经是该长度后发出 `session/truncated`。持久化再次丢弃同一段尾部。投影 cell、投影缓存、token-meter 回放 fold、runtime-context 快照，以及水位越过截断点的进行中 session-title 生成，都会从保留前缀重建或中止。`deleteFrom` 仍然先改存储，再改内存。所属功能记录是[破坏性删除会话轮次尾部](../feature/2026-09-10-destructive-session-tail-deletion.zh.md)。

## Verification

`pnpm exec vitest run packages/session/session-persistence-jsonl/tests/jsonl.spec.ts packages/session/session-persistence/tests/live-write-contract.ts packages/core/session/tests/session.spec.ts packages/session/session-projection/tests/registry.spec.ts packages/session/session-projection-cache/tests/cache.spec.ts packages/llm/token-meter/tests/token-meter.spec.ts packages/core/agent-loop/tests/runtime-context.spec.ts packages/session/session-title/tests/provider.spec.ts`

## Alternatives considered

**把实时事件重编号到新 cursor。** 否决：`seq` 就是日志位置。幽灵尾部事件是被丢弃的历史，不是要继续的前缀。

**先截断内存 `Session`，再改持久化。** 否决：两步之间崩溃会从更长的持久化日志恢复，等于撤销回退。存储仍然领先；`session/truncated` 只修补存储在内存缩短前看不到的进程内缓冲。

**在 `persistContiguous` 里静默跳过有缺口的批次。** 否决：没有 truncate 的缺口仍是损坏，必须大声失败。只有明确的保留长度裁切才会丢弃尾部。

## Consequences

- 大会话上回退仍然可能和重写一样慢；它不再毒化后续 flush。
- `session/truncated` 和 `session/created` 一样是进程内事件。它不是日志事件，也不提升 `SESSION_FORMAT_VERSION`。
- 已经持有被毒化实时缓冲的进程仍需重启；之后那段持久化前缀可以继续用。
