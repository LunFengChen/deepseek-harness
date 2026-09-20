# Agent Note: 历史 subagent descriptor version 2

Status: implemented

[English](2026-09-10-historical-subagent-descriptor-v2.md) | 中文

## Problem

Released v0-to-v3 restore 会在 `subagent/descriptor` 仍携带 payload version 2 时拒绝整个 Session。当前写入会盖 version 3。共用的 `~/.dsh` 子会话，以及嵌了这些子会话的父会话，因此打不开。

## Decision

v0-to-v1 在 payload 校验之前，把历史 descriptor version 2 盖成 version 3。这些 payload 字段就是当前字段。未知 descriptor version 仍然以 `SessionFormatUnsupportedMigrationError` 拒绝。原始 v0 generation 保持不变。

## Alternatives considered

**后继 generation 里继续留 version 2。** `foldSubagentDescriptor` 会返回 undefined，这些子会话无法被分类。

**承认所有非 3 的 version。** 未来的 descriptor 布局会被当成当前布局。

**改写已存储的 v0 文件。** Adjacent migration 禁止覆盖已提交 generation。

## Consequences

descriptor 仍写 version 2 的会话可以 restore。成功打开后，persistence 仍可能发布后继 generation。[遗留归一化测试](../../../../packages/session/session-format-v0-to-v1/tests/legacy.spec.ts) 覆盖盖章和未知 version 拒绝。[Catalog restore](../../../../packages/session/session-format-catalog/tests/catalog.spec.ts) 覆盖生产 v0-to-v3 路径。
