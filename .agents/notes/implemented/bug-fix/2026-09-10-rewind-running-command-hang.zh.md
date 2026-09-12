# Agent Note: rewind UI no longer hangs on a running command card

Status: implemented

[English](2026-09-10-rewind-running-command-hang.md) | 中文

## Problem

回退、删除、重新生成会把会话停在 `rewind` / `执行中…`。↶ 按钮走 `/rewind @seq both`，先写入 `command/run`，再把这条事件截掉，随后跳过 `command/done`。删除和重新生成在 Agent 忙碌时直接拒绝，正在生成时这两个按钮也会像卡住一样。

## Decision

UI 回退先停住当前回合；需要还原文件时走内部 `/rewind __restore` 探针，再用 `deleteFrom` 截断日志。正在执行的 rewind 卡片和内部探针会隐藏。`deleteFrom` 会先取消正在跑的回合再改写日志。

## Verification

`tests/hidden.client.spec.ts`, `tests/actions.client.spec.tsx`, and `tests/portals.client.spec.tsx` in [LunFengChen/dsh-session-timeline](https://github.com/LunFengChen/dsh-session-timeline), plus `pnpm exec vitest run packages/api/session-controller/tests/commands-delete.host.spec.ts`

## Alternatives considered

**继续在 `/rewind @seq both` 里截断，再加强 resync。** 否决：`command/run` 一旦被截掉就会跳过 `command/done`，客户端若还留着这条实时事件，卡片就会一直显示执行中。

**让正在执行的 rewind 卡片保持可见直到结算。** 否决：还原或 idle wait 挂住时，整个会话都会钉在“执行中”。

## Consequences

- 对话回退、删除、重新生成都是先取消再走 `deleteFrom`。
- 工作区还原不再从斜杠命令处理器内部截断会话日志。
- 失败的已执行 `/rewind` 仍可见；探针和未结算的 rewind 卡片不可见。
