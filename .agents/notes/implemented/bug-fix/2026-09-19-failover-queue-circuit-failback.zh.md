# Agent Note: failover-queue 会探活切回 P1

Status: implemented

[English](2026-09-19-failover-queue-circuit-failback.md) | 中文

## Problem

`v0.1.10` 把 `currentIndex` 粘住。P1 失败后，即使 P1 已经恢复，后续请求也停在 P2。CC Switch 始终优先队列里第一个可用成员，并在熔断超时后探活。

## Decision

`v0.1.11` 给每条路由 Closed / Open / HalfOpen 熔断器。`agent/request` 覆盖到第一个可用档（先 P1）。立即码插到 `llm-retry` 前面，打开熔断并重试下一档；[503 / 超时 / 传输从 v0.1.12 起也在这个集合里](2026-09-20-failover-queue-server-immediate.zh.md)。完整的 `assistant/message` 记一次成功；HalfOpen 两次成功后关闭熔断，下次选档回到 P1。队列行用绿 / 黄 / 红表示健康。xfdsh 钉 `@x1a0f3n9/dsh-failover-queue@0.1.12`。

## Verification

插件单测覆盖立即失败打开、`cooldownMs` 后 HalfOpen、两次成功回到 Closed，以及 P1 HalfOpen 时 `pickFirstAvailable` 仍返回 P1。`xfdsh web` 7777：弄挂 P1 后芯片显示 P2、P1 红点；60 秒后再发会探活 P1，芯片回到 P1 绿色。

## Alternatives considered

**继续粘 `currentIndex`，另加手动「回到 P1」。** 否决：CC Switch 的回切是自动的。

**后台 Stream Check 探活（「Hi」，10–50 tokens）。** 否决：会花额度。下一次真实请求走 HalfOpen 就够。

## Consequences

- 故障转移不粘滞。只要 P1 的熔断器是 Closed 或 HalfOpen，就优先 P1。
- 熔断器只在内存里；进程重启后全部 Closed。
- `RATE_LIMIT` 会在 `llm-retry` 同路由退避之前切档。
