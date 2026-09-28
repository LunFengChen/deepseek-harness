# Agent Note: Skill catalog history stops at the live RAM window

Status: implemented

[English](2026-09-28-skill-catalog-windowed-prefix.md) | 中文

## Problem

`tool-skill` 在每次 `agent/pre-step` 都从 `session.seq - 1` 往下用 `eventAt` 扫到 `0`，以找到最新的持久 skill 目录。在 [Session 宿主内存上限](../architecture/2026-09-23-session-host-memory-bounds.zh.md) 之后，`liveBaseSeq` 之前的 seq 是已释放前缀，除非仍留在 `prefixHot`。对这些 seq，`eventAt` 返回 `undefined`。

扫描器把每一次 `undefined` 都当成完整内存日志里的缺洞，并抛出 `skill catalog cannot read seq N below the current Session length`。于是一个合法的长 Session 会让整轮失败，包括存活窗口日志上的 seq 34745。

## Decision

`catalogHistory` 只扫描 `[liveBaseSeq, session.seq)`。这条尾巴里缺失的事件仍然抛错。`liveBaseSeq` 之下的 seq 是未读，不是损坏。

如果最新目录只在已释放前缀里，这次 pre-step 把它视为从未发布，并可能追加一份替换。这比让本轮失败更便宜。

## Alternatives considered

**继续扫到 seq 0，并在第一个 `undefined` 时抛错。** 否决：那就是存活窗口崩溃。前缀从 RAM 消失是故意的。

**跳过 `liveBaseSeq` 之下的 `undefined`，继续走 `prefixHot`。** 否决：`prefixHot` 是稀疏的，扫描仍会访问每一个已释放 seq。活尾巴里有一份替换目录，就够以后比 digest。

**重读持久化前缀以恢复旧 digest。** 否决：恢复已经把日志扫过一遍，catalog 插件不能在每一步上抵消宿主内存上限。

## Consequences

窗口化 Session 可以再走一步，而不被 catalog 扫描器整轮失败。只存在于 `liveBaseSeq` 之下的目录可能被再次作为首次目录发布，而不是 `update`。活尾巴内部的真缺洞仍然会响亮失败。

## Related

[Session 宿主内存上限](../architecture/2026-09-23-session-host-memory-bounds.zh.md) 仍然拥有存活尾巴、`prefixHot`，以及已释放 seq 上 `eventAt` 返回 `undefined`。

[窗口化恢复在 ingest 时折叠投影](2026-09-28-windowed-restore-projection-fold.zh.md) 仍然拥有恢复时的投影和 token-meter ingest。
