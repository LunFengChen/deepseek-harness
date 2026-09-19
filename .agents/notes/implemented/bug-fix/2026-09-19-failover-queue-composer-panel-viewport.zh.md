# Agent Note: composer failover panel must stay inside the viewport

Status: implemented

[English](2026-09-19-failover-queue-composer-panel-viewport.md) | 中文

## Problem

点输入框故障转移芯片后，P1/P2/P3 编辑会出现在窗口下方。芯片在输入行上，而 `position: fixed` 面板又套在另一个 fixed 容器里，量到的高度是 0，面板就往下长出屏幕。

## Decision

`v0.1.10` 量的是文档流里的面板，优先放在芯片上方，并把 `top` 夹到 `[8, innerHeight - height - 8]`。输入框弹层 `overflow: auto`，最大高度 `min(420, innerHeight - 16)`。设置页仍是 `overflow: visible`。xfdsh 钉 `github:LunFengChen/dsh-failover-queue#v0.1.10`。

## Verification

`xfdsh web` 7777 上，芯片 `故障转移：P1 …` 打开后，面板底边不超过 `window.innerHeight`。P1/P2/P3 和 `选择供应商` 都看得见。加入菜单仍 portal 到字段上方。

## Alternatives considered

**保留双层 fixed，只夹 `top`。** 高度仍是 0，夹完还是空盒子，内层面板继续往下长。

**一律在芯片下方打开。** 芯片在底部输入行，下方正是被裁切的一侧。

## Consequences

- 矮窗口时面板贴着 8px 上边距，内部滚动。
- 加入菜单仍挂在 `document.body`，不会被面板 overflow 裁切。
