# Agent Note: failover-queue 设置页不能用固定定位弹层

Status: implemented

[English](2026-09-19-failover-queue-settings-page.md) | 中文

## Problem

`dsh-failover-queue` `v0.1.4` 把队列编辑注册在 `settings.plugins.tab`。该组件复用了输入框弹层（`position: fixed`）。设置弹窗有 `overflow: hidden`，所以这个 tab 看起来是空白页。

## Decision

改插件再钉版本。`v0.1.5` 注册 `settings.section` id `failover`，并把编辑器放进文档流。输入框芯片仍通过 portal 打开弹层。xfdsh 钉 `github:LunFengChen/dsh-failover-queue#v0.1.5`。

## Verification

`lib/client.js` 含 `settings.section` 和 `dsh-fq-panel-page`，不含 `settings.plugins.tab`。`require` 仍是 `react`、`react-dom`、`react/jsx-runtime`。`pnpm install` 之后，设置左侧导航出现「故障转移」，里面有开关和加路由控件。

## Alternatives considered

**继续用 `settings.plugins.tab`，只改 CSS。** Plugins 区已经有清单、目录和配置 tab。独立左侧导航页更接近 Models 和 Agent presets。

**在宿主再 seed 模块，用宿主卡片画队列。** 编辑器已经在插件 client 里。宿主不该再抄一份。

## Consequences

- Settings → 故障转移 是队列编辑。Settings → xfdsh预置插件 仍是启用/关闭开关。
- 如果再钉回 `v0.1.4`，设置 tab 还会是空白。
