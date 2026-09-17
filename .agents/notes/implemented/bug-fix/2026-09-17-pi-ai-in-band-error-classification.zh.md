# Agent Note: pi-ai in-band stream error classification

Status: implemented

[English](2026-09-17-pi-ai-in-band-error-classification.md) | 中文

## Problem

OpenAI 兼容网关经常先回 HTTP 200，再在 SSE `error` 事件里给出 `code: text` 或 `Error Code code: text`。`classifyPiAiError` 只认 HTTP 状态码和少量英文短语，因此并发上限、上游故障、内容策略拒绝、截断 JSON，以及 Chat Completions 缺少 `finish_reason`，全部变成 `PI_AI_ERROR`。默认重试策略不会重试该 code，同一账号上多个并发会话会立刻结束本轮。

## Decision

pi-ai 把前缀 OpenAI 风格错误码、前缀 `Error Code <code>:` 或裸 code 词映射到[有界 LLM 请求恢复](../architecture/2026-06-21-bounded-llm-request-recovery.zh.md)里已有的共享分类。并发与 retry-later 文案成为 `RATE_LIMIT`。上游不可用、`internal_server_error`、Cloudflare 52x、HTTP 502/503/524、HTML 或空 5xx 正文，以及 unexpected internal error 成为 `SERVER`。截断流（包括 `Stream ended without finish_reason` 和畸形 JSON 正文）成为 `TRANSPORT`。内容策略和 model-not-found 文案成为 `INVALID_REQUEST`。额度文案（含 5 小时 usage quota 和 403 billing-cycle usage limit）在 AUTH 或 429 之前归为 `QUOTA`。未分类剩余仍为 `PI_AI_ERROR`，不加入默认可重试集合。

## Verification

`pnpm exec vitest run packages/llm/llm-pi-ai/tests/convert.spec.ts packages/llm/llm-pi-ai/tests/adapter.spec.ts packages/llm/llm/tests/service.spec.ts packages/llm/llm-deepseek/tests/adapter.spec.ts`

## Alternatives considered

**把 `PI_AI_ERROR` 加入默认可重试 code。** 否决：这会重试内容策略拒绝和不支持的 deferred 结束，且界面仍会显示 `PI_AI_ERROR`。恢复记录要求暂时性集合保持很小，并把新情况映射进去。

**在某一条路由上写提供方专用 `retryPolicy`。** 否决：自定义 OpenAI 兼容网关共用同一套 in-band 事件形状。

**为协议毛刺新增可重试 code。** 否决：截断流已经有 `TRANSPORT`，扩大默认集合需要单独的策略决策。

## Consequences

- 打到网关并发上限的进行中请求会按 `RATE_LIMIT` 重试，而不是结束本轮。
- HTTP 502/503/524 本来就会按 `SERVER` 重试；HTML 或空 5xx 正文现在也会按捕获到的状态码同样处理。
- 5 小时 usage quota 或 billing-cycle usage limit 会以 `QUOTA` 失败一次，而不是耗尽重试预算。
- 内容策略拒绝会以 `INVALID_REQUEST` 失败一次。
- 真正未知的 pi-ai 文案仍可能以 `PI_AI_ERROR` 结束本轮。
