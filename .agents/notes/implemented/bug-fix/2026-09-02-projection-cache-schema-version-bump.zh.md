# Agent Note: 身份 schema 变更后使投影缓存记录失效

Status: implemented

[English](2026-09-02-projection-cache-schema-version-bump.md) | 中文

## Problem

在拆分 session sequence 与 log offset 类型时，投影缓存身份新增了 `isSeeded` 和 `inheritedEventCount`，但 `session_projcache` 存储域版本仍为 `5`。因此，使用版本 `5` 写入的记录会进入当前记录 schema，并在启动时以 `invalid-record` 失败，而不是被视为可丢弃的过期缓存数据。

## Decision

`session_projcache` 存储域版本为 `6`。这样，per-record JSON 后端会在存储域 schema 解析器运行前，将版本 `5` 文档视为过期并忽略。随后缓存会从 session 日志重新折叠这些会话，而仍为版本 `6` 的其他记录继续可用。每会话持久化布局及其过期记录语义仍以[每会话投影缓存决策](../architecture/2026-08-19-projection-cache-per-session-files.zh.md)为准。

今后每次修改持久化检查点记录或行 schema 都必须递增存储域版本；缓存记录是可丢弃的，版本变化时不迁移。

## Alternatives considered

**将新增身份字段改为可选或提供默认值。** 缺失字段无法区分旧记录和有效的 session 生命周期身份，接受它可能使投影从无关日志中播种。缓存必须拒绝含糊身份，而不是从不完整数据中猜测。

**在 storage-domain 层吞掉 schema 错误。** `invalid-record` 是通用存储域信号，隐藏它会削弱那些无法安全重新折叠的域的 schema 强制。per-record 后端已经拥有缓存专用的过期文档处理语义。

**迁移版本 `5` 记录。** 旧记录没有足够信息安全恢复新的身份字段。丢弃派生检查点并重放权威 session 日志，是更小且更安全的恢复方式。

## Consequences

升级后，已有版本 `5` 投影缓存文件的用户会为每个受影响会话承担一次缓存未命中；`dsh web` 可以正常启动并重建这些行。回归测试保留旧记录格式，并验证打开缓存成功且不会提供过期快照。今后每次持久化检查点 schema 变更都必须同步递增版本。
