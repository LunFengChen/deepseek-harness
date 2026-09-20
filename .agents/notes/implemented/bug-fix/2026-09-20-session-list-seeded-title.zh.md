# Agent Note: 冷列表从投影缓存读取 seeded Session 的标题

Status: implemented

[English](2026-09-20-session-list-seeded-title.md) | 中文

## Problem

当宿主行没有 durable `title` 时，Web Session 列表会回退到工作区目录名。冷列表从不折叠日志。它只用 inherited cut 0 调用 `cachedSnapshot` / `cachedPredecessorTitle`，并且在 `header.isSeeded` 为 true 时完全跳过这两次读取，因为 cut-0 身份会与另一个 fork 生命周期别名。

Fork、rewind、删除和重新生成会创建 seeded 子会话。它们的检查点已经存有 `inheritedEventCount` 和 `title`（会话创建是强制缓存写入）。重启后这些行仍显示工作区名，直到 Session 被打开并做 live-fold。观察失败的 Session 则永远恢复不了标题。

## Decision

新增 `cachedListedHint(header)` 作为 Session 列表的缓存入口。未 seeded 行仍使用 cut 0。仅 header 的 seeded 行不会发明 cut 0：它按 Session id 读取已存检查点，只有在 `createdAt`、`cwd` 与 seeded lineage 匹配后，才用存储的 `inheritedEventCount` 调用 `cachedSnapshot` 或 `cachedPredecessorTitle`。仍然匹配 `createdAt` 和 `cwd` 的无 lineage predecessor 可以只公开当前 schema 的 `title`，并带 `asOfSeq: -1`。hydrate、`cachedSnapshot` 和 `coldSnapshot` 仍要求调用方传入权威切点。

这是列表 hint，不是 fold seed。它不打开 Session 日志。

## Testing

`session-projection-cache` 用存储的 inherited cut 提供 seeded 列表 hint，并拒绝 cwd 不匹配、或用 unseeded header 去读 seeded 记录。归档的无 lineage fixture 对 seeded 调用方仍拒绝 `cachedSnapshot` / `cachedPredecessorTitle`，但 `cachedListedHint` 返回兼容 title。`session-controller` 冷列表在不调用 `inspect` 或 `observe` 的情况下包含 seeded 行的缓存标题。

## Alternatives considered

**列表时打开每个 seeded 日志以得知 `inheritedEventCount`。** 否决：列表必须保持仅 metadata/cache。启动时扫描 jsonl 正是这块缓存要避免的成本。

**给 seeded snapshot 传入 cut 0。** 否决：那是另一个生命周期的身份。先前跳过读取就是为了防止这种别名。

**继续跳过 seeded 行，接受工作区名回退。** 否决：标题已经在检查点里。打开 Session 才能恢复是多余的，而且观察失败时永远恢复不了。

## Consequences

- Fork 出的 Session 在 Web 重启后无需读取正文即可保留缓存标题。
- 缺失、cwd 不匹配或更新格式的检查点仍会显示为工作区名，直到成功打开并 live-fold `session/title`。
- hydrate 的身份匹配不变。严格 fold 路径见 [projcache 跨版本读兼容](../architecture/2026-09-02-projcache-cross-version-read-compat.zh.md)。
