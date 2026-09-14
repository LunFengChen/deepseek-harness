# Agent Note: longer default provider retry budget

Status: implemented

[English](2026-09-14-longer-default-provider-retry.md) | 中文

## Problem

省略 `retryPolicy` 时只会再试五次，退避从 500 ms 到 10 s，本地等待大约 15.5 s。提供方 `Retry-After` 超过 10 s 时不会等待，常见限流窗口会直接跳过重试。Settings 的自定义可以加大次数和首次间隔，但 10 s 上限仍会丢掉这些 `Retry-After`。

## Decision

适配器省略时使用 normal mode：最多再试十次，首次间隔 1 s，上限 60 s。指数退避是 min(1000 ms × 2^(n-1), 60 s)，带 10% jitter，十次重试的本地等待大约五分钟。不超过 60 s 的 `Retry-After` 会按值等待。Models 卡片的默认仍省略 `retryPolicy`；自定义仍把 `maxDelayMs` 写成 max(60 s, initialDelayMs)。可重试错误码和 always 模式不变。

## Alternatives considered

**默认改成 always mode。** 否决：永久失败会一直挂到取消。

**只加大 maxRetries，仍保留 10 s 上限。** 否决：超过 10 s 的 `Retry-After` 还是会跳过重试。

**上限改成 30 s。** 否决：限流 `Retry-After` 经常是整整一分钟。

**在 Models 卡片上再加一个最大间隔字段。** 否决：这次要的是更长的默认；自定义已经能设次数和首次间隔，下限现在跟着适配器上限走。

## Consequences

- 默认瞬时恢复大约等待五分钟，外加每次尝试的请求时间。
- 不超过 60 s 的限流 `Retry-After` 会等待，而不是跳过。
- 自定义卡片策略继承 60 s 下限，除非首次间隔更大。
