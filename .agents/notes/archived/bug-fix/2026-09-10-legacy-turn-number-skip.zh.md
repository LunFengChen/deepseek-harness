# Agent Note: 历史 turn 编号跳号

Status: implemented
Archived: 2026-09-10

[English](2026-09-10-legacy-turn-number-skip.md) | 中文

## Problem

Released v0-to-v3 restore 会在 `turn/end` 之后的 `turn/start` 编号大于下一个 turn 时拒绝整个 Session。共用的 `~/.dsh` 里，历史 rewind 和 seed 续写的日志因此打不开，即使后面的 turn 还在。

## Decision

当 `legacyTurnNumberSkip` 打开，并且没有打开的 turn 或 ghost step 时，承认已经关闭过一个 turn 之后、编号大于 `nextTurn` 的 `turn/start`。`nextTurn` 跳到这个编号。第一条 `turn/start`、turn 仍打开、以及往回跳的编号仍然拒绝。原始 v0 generation 保持不变。

## Alternatives considered

**在缺口处截断。** 后面的 turn 会消失。

**重编后面的 turn 号。** Adjacent migration 禁止改写源 generation 里已提交的事件，后继 generation 也会和日志里的 turn 坐标对不上。

**改写已存储的 v0 文件。** Adjacent migration 禁止覆盖已提交 generation。

## Consequences

后面 turn 跳号的会话可以 restore。成功打开后，persistence 仍可能发布后继 generation。[关系测试](../../../../packages/session/session-format-v0-to-v1/tests/relationships.spec.ts) 覆盖该例外及其拒绝路径。[V3 restore](../../../../packages/session/session-format-v2-to-v3/tests/admission.spec.ts) 覆盖生产 restore 路径。
