# Agent Note: 残留的 v1 assistant message provenance

Status: implemented
Archived: 2026-09-10

[English](2026-09-10-v1-leftover-message-provenance.md) | 中文

## Problem

Released v1-to-v2 restore 会在 `assistant/message` 仍携带 `sourceEventSeqs`、而其 chunk attempt 已经结束后拒绝整个 Session。历史 rewind marker 会把这种残留 provenance 写到后续 ghost step 上，于是共用的 `~/.dsh` 会话无法打开。

## Decision

当前没有未结束的 chunk attempt 时，保留该 message 并写入空的 embedded stream，同时丢掉残留 provenance。只有匹配的 attempt 仍在进行时，才继续拒绝不匹配的 provenance。

## Alternatives considered

**拒绝整个日志。** 一条残留 marker 会让整段对话消失。

**改写已存储的 v0 文件。** Adjacent migration 禁止覆盖已提交 generation，兼容读取也不需要面向用户的历史导入。

**只改 rewind 写入端。** 当前 rewind marker 已经改用 plugin `user/message` 作为 replace carrier。已有日志仍然必须能打开。

## Consequences

带有残留 rewind marker 的会话可以 restore。原始 v0 artifact 保持不变。成功打开后，persistence 仍可能发布后继 generation。空的 rewind-marker message 会留在日志里，并带有空 stream。[迁移测试](../../../../packages/session/session-format-v1-to-v2/tests/migration.spec.ts) 覆盖没有未结束 attempt 的残留 provenance，并且仍然拒绝活 attempt 上的不完整 provenance。
