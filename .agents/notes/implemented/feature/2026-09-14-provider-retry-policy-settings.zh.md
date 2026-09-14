# Agent Note: provider retry count and delay on Models cards

Status: implemented

[English](2026-09-14-provider-retry-policy-settings.md) | 中文

## Problem

请求重试次数和间隔本来就在每个提供方路由的 `retryPolicy` 上，但 Settings → Models 没有编辑器。想多试或少试、或改第一次等待间隔的用户只能改 `settings.yaml`。超时、可重试错误码和 always 模式仍只走 yaml；本笔记只覆盖卡片现在暴露的这两个值。

## Decision

每个提供方编辑器的「自定义设置」折叠区，以及自定义提供方创建卡片，都提供默认或自定义次数和间隔。默认会省略 `retryPolicy`，使用适配器策略（20 次重试，500 ms 到 10 s）。自定义写入 `{ mode: 'normal', maxRetries, backoff: { initialDelayMs, maxDelayMs } }`，其中 `maxDelayMs` 至少 10 s。控件按提供方路由，不按模型。yaml 里已有的 `mode: 'always'` 仍视为合法自定义，这样改其他字段时 Apply 不会被挡住；改次数或间隔会把它变成 normal。空白或非法的次数/间隔会存成 `{ mode: 'normal' }`（不含 NaN），并禁用 Apply/Create。

## Verification

`pnpm exec vitest run packages/client/ui-settings-models/tests/retry-policy.client.spec.ts packages/client/ui-settings-models/tests/provider-form.client.spec.tsx packages/client/ui-settings-models/tests/components.client.spec.tsx` 覆盖省略与自定义草稿、拒绝 NaN、DeepSeek 路径操作、回到默认时的 unset、空白次数禁用，以及创建卡片的写入/省略。

## Alternatives considered

**按模型做重试控件。** 否决：重试是适配器上的提供方路由策略，和思考强度不同。

**暴露 always 模式、可重试错误码或 jitter。** 否决：用户只要次数和间隔；其余仍只走 yaml。

**按模型或提供方 id 猜策略。** 否决：默认就是省略，自定义就是明确的数字。

**让客户端导入 `@x1a0f3n9/dsh-llm` 来拿适配器默认值。** 否决：source-plane 拆分禁止这样做；卡片复制数字默认值。

## Consequences

- 用户可以在 Settings → Models 设置重试次数和首次间隔，不用改 yaml。
- 默认保持原来的适配器行为，不写入 `retryPolicy` 键。
- always 模式的 yaml 仍能加载；改这两个数字会把它换成 normal 模式。
- 超时、可重试错误码和 always 模式仍然没有卡片字段。
