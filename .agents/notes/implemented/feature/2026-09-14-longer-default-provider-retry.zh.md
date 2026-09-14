# Agent Note: longer default provider retry budget

Status: implemented

[English](2026-09-14-longer-default-provider-retry.md) | 中文

## Problem

瞬时模型失败需要多于五次重试。后面几次如果每次干等一分钟，会话会卡住，所以默认应多试几次，并用较短的指数上限。

## Decision

适配器省略时使用 normal mode：最多再试二十次，首次间隔 500 ms，上限 10 s。指数退避是 min(500 ms × 2^(n-1), 10 s)，带 10% jitter，二十次重试的本地等待大约 2.8 分钟。不超过 10 s 的 `Retry-After` 会按值等待；更大的 `Retry-After` 在 normal mode 仍会跳过重试。Models 卡片的默认仍省略 `retryPolicy`；自定义仍把 `maxDelayMs` 写成 max(10 s, initialDelayMs)。可重试错误码和 always 模式不变。

## Alternatives considered

**默认改成 always mode。** 否决：永久失败会一直挂到取消。

**十次重试、1 s 到 60 s。** 否决：后面几次要干等一分钟，不适合二十次短间隔重试。

**仍只试五次、只缩短间隔。** 否决：这次要的是更多次数，不是更小预算。

**在 Models 卡片上再加一个最大间隔字段。** 否决：自定义已经能设次数和首次间隔，下限跟着适配器上限走。

## Consequences

- 默认瞬时恢复大约等待 2.8 分钟，外加每次尝试的请求时间。
- 本地重试从 500 ms 起、上限 10 s，后面几次不会干等一分钟。
- 超过 10 s 的限流 `Retry-After` 在 normal mode 仍会跳过。
- 自定义卡片策略继承 10 s 下限，除非首次间隔更大。
