# Agent Note: Strip rewind dirt from local sessions

Status: implemented

[English](2026-09-10-strip-local-rewind-dirt.md) | 中文

## Problem

历史 rewind marker 会在 `turn/end` 之后留下 ghost `step/start`、跳号的 turn、残留的 v1 `sourceEventSeqs`，以及 rewind-marker assistant 消息。共享的 `~/.dsh` 会话随后无法打开。如果在 restore 里承认这些日志，就会为脏文件留下一条永久兼容路径。

## Decision

本地会话文件先备份，再写成当前 v3 successor。Successor 里删除了 ghost step、rewind-marker 消息、不成对的 rewind command，以及跳号 turn。原始 v0 generation 保持不变。Restore 再次拒绝 closed-turn ghost step、turn 跳号，以及没有未结束 chunk attempt 时的残留 v1 provenance。`legacyInterruptedTurnRestart` 和历史 subagent descriptor 打戳仍然保留。

## Alternatives considered

**在 restore 里承认 rewind 脏数据。** 这会为本来可以一次性清理的文件留下永久兼容路径。

**只在 restore 时清洗、不重写文件。** 每次打开都会重新解释脏的 v0 日志。

**覆盖 v0 generation。** Adjacent migration 禁止删除或改写已提交的 generation。

## Consequences

本地 `~/.dsh/sessions` 都有当前 v3 successor。从未 bake 过的脏 v0 日志仍然会被拒绝。Relationship、catalog、admission 和 v1-to-v2 migration 测试钉住这些拒绝行为。
