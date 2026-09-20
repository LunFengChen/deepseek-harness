# Agent Note: failover-queue 503 skips llm-retry

Status: implemented

[English](2026-09-20-failover-queue-server-immediate.md) | 中文

## Problem

`v0.1.11` 只对 `AUTH` / `RATE_LIMIT` / `NO_ADAPTER` 跳过 `llm-retry`。供应商 503 会被标成 `SERVER`。这个码，再加上 `TIMEOUT` 和 `TRANSPORT`，会 `next()` 进 `llm-retry`（`maxRetries` 20，退避最多 10 秒）。输入框只显示重试延迟，P1 要等这二十次打完才切档。

## Decision

`v0.1.12` 默认 `immediateCodes` 是 `AUTH`、`RATE_LIMIT`、`NO_ADAPTER`、`SERVER`、`TIMEOUT`、`TRANSPORT`。这些码会跳过同一条路由剩下的重试，第一次就打开熔断并重试下一档。`EMPTY_RESPONSE` 仍留在同一条路由的 `llm-retry`。xfdsh 钉 `@x1a0f3n9/dsh-failover-queue@0.1.12`。`cooldownMs` 之后的探活回切不变，见 [failover-queue 会探活切回 P1](2026-09-19-failover-queue-circuit-failback.zh.md)。

## Verification

插件单测断言每个立即码都返回 `{ kind: 'retry' }` 且不调用 `llm-retry`，而 `EMPTY_RESPONSE` 仍会调用 `next()`。P1 上的 503 必须在同一次请求里覆盖到 P2。

## Alternatives considered

**`SERVER` 继续等 `llm-retry` 打完再切档。** 否决：二十次带抖动的 10 秒延迟会让用户在已挂的 P1 上停几分钟。

**把所有失败的 `llm-retry` `maxRetries` 都调低。** 否决：`EMPTY_RESPONSE` 常常是同一条路由的瞬时空响应，仍该先同路由重试。

**所有失败码都跳过 `llm-retry`。** 否决：一次空 completion 不该无故跳到 P2。

## Consequences

- 第一次 503 / 超时 / 传输错误就会打开 P1，并在同一次请求里重试 P2。
- `cooldownMs` 之后 P1 进入 HalfOpen，下一次请求会探活它。
- cordis.yml 里的 `immediateCodes` 仍会覆盖默认值。
