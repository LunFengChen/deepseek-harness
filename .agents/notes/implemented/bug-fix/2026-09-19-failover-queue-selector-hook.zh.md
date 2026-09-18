# Agent Note: failover-queue slot renderer must receive a selector hook

Status: implemented

[English](2026-09-19-failover-queue-selector-hook.md) | 中文

## Problem

`dsh-failover-queue` `v0.1.5` 把 Settings → 故障转移 注册成 `settings.section`，但页面仍是空白。输入框芯片也会在 SlotErrorBoundary 下崩溃。`useFailover()` 没传 selector，并且在没有 inject 时读了 `client.sessions`。

## Decision

改插件再钉版本。`v0.1.6` 调用 `useFailover(snapshot => snapshot)`，以匹配 slot renderer 的 selector hook。会话 id 用 `ctx.get('sessions')` 读取，不要求 inject。xfdsh 钉 `github:LunFengChen/dsh-failover-queue#v0.1.6`。

## Verification

实机 Settings → 故障转移 能看到说明、开关、空队列文案和加入行。输入框芯片显示故障转移关闭。`lib/client.js` 含 `useFailover((snapshot` 和 `get("sessions")`，不含 `client.sessions`。

## Alternatives considered

**把 `sessions` 加进插件 inject 列表。** Settings 页必须在没有当前会话时也能渲染。inject `sessions` 会在该服务缺失时拖住或打挂插件。

**再往宿主模块表塞东西，让宿主卡片来画队列。** 崩溃在插件 client。宿主代码不该再抄一份编辑器。

## Consequences

- Settings → 故障转移 在没有当前会话时也能渲染。在有 session id 之前，候选路由加载保持空操作。
- 如果再钉回 `v0.1.5`，页面仍会空白。
