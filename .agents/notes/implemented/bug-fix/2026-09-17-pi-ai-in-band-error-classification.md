# Agent Note: pi-ai in-band stream error classification

Status: implemented

English | [中文](2026-09-17-pi-ai-in-band-error-classification.zh.md)

## Problem

OpenAI-compatible gateways often answer HTTP 200 and then emit an SSE `error` event whose message is `code: text` or `Error Code code: text`. `classifyPiAiError` only recognized HTTP status numbers and a few English phrases, so concurrency limits, upstream faults, content-policy refusals, truncated JSON, and a missing Chat Completions `finish_reason` all became `PI_AI_ERROR`. Default retry policy does not retry that code, so several concurrent sessions against one account failed the turn immediately.

## Decision

pi-ai maps a leading OpenAI-style error code, a leading `Error Code <code>:`, or a bare code token onto the existing shared taxonomy in [bounded LLM request recovery](../architecture/2026-06-21-bounded-llm-request-recovery.md). Concurrency and retry-later wording become `RATE_LIMIT`. Upstream unavailability, `internal_server_error`, Cloudflare 52x, HTTP 502/503/524, HTML or empty 5xx bodies, and unexpected internal errors become `SERVER`. Truncated streams, including `Stream ended without finish_reason` and malformed JSON bodies, become `TRANSPORT`. Content-policy and model-not-found wording become `INVALID_REQUEST`. Quota wording, including a 5-hour usage quota and a 403 billing-cycle usage limit, is classified as `QUOTA` before AUTH or 429. Unclassified remainder stays `PI_AI_ERROR` and is not added to the default retryable set.

## Verification

`pnpm exec vitest run packages/llm/llm-pi-ai/tests/convert.spec.ts packages/llm/llm-pi-ai/tests/adapter.spec.ts packages/llm/llm/tests/service.spec.ts packages/llm/llm-deepseek/tests/adapter.spec.ts`

## Alternatives considered

**Add `PI_AI_ERROR` to the default retryable codes.** Rejected: that would retry content-policy refusals and unsupported deferred stops, and the turn would still surface `PI_AI_ERROR`. The recovery note keeps the transient set small and requires mapping onto it.

**A provider-specific `retryPolicy` on one route.** Rejected: custom OpenAI-compatible gateways share the same in-band event shape.

**A new retryable code for protocol glitches.** Rejected: truncated streams already have `TRANSPORT`, and expanding the default set needs a separate policy decision.

## Consequences

- Concurrent in-flight requests against a gateway concurrency cap retry as `RATE_LIMIT` instead of ending the turn.
- HTTP 502/503/524 already retried as `SERVER`; HTML or empty 5xx bodies now do the same from the captured status.
- A 5-hour usage quota or billing-cycle usage limit fails once as `QUOTA` instead of burning the retry budget.
- Content-policy refusals fail once as `INVALID_REQUEST`.
- True unknown pi-ai wording can still end a turn as `PI_AI_ERROR`.
