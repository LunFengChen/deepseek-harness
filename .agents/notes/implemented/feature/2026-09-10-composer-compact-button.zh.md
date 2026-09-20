# Agent Note: composer compact button

Status: implemented

[English](2026-09-10-composer-compact-button.md) | 中文

## Problem

长会话会把模型上下文撑满。溢出后会自动压缩重试，但没有一键入口。用户只能手打 `/compact`，溢出中断看起来仍像硬失败。

## Decision

`dsh-session-timeline` 把压缩按钮注入 `conversation.input.right`。按钮对当前会话执行 `session.command('/compact')`。Web patch 里的宿主 `command-compact` 仍然保持 disabled；`/compact` 仍由 per-session preset 拥有。

## Verification

[LunFengChen/dsh-session-timeline](https://github.com/LunFengChen/dsh-session-timeline) 里的 `tests/compact-button.client.spec.tsx` 覆盖点击路径和没有会话时的禁用态。

## Alternatives considered

**重新启用宿主平面的 `command-compact`。** 否决：Web patch 关掉那一行，是因为 human command 归 preset。再启用会在宿主和 preset 上重复挂 compact。

**把按钮放进 `dsh-client-ui-commands`。** 此次 fork 否决：额外 Web 控件已经由 session-timeline 拥有，压缩点击只是展示。

**新增 compaction RPC。** 否决：`/compact` 已经能通过现有命令排队压缩。

## Consequences

- 输入框右侧、上下文计量旁边会出现压缩控件。
- 轮次进行中和没有可压缩历史时，仍走 `/compact` 的命令错误。
