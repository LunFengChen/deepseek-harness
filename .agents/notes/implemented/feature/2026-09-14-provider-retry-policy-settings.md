# Agent Note: provider retry count and delay on Models cards

Status: implemented

English | [中文](2026-09-14-provider-retry-policy-settings.zh.md)

## Problem

Request retry count and delay already live on each provider route as `retryPolicy`, but Settings → Models had no editor for them. Users who wanted more or fewer retries, or a different first delay, had to edit `settings.yaml`. Timeouts, retryable codes, and always-mode stay yaml-only; this note is only about the two values the cards now expose.

## Decision

Each provider editor's 自定义设置 fold, and the custom-provider create card, offer Default or Custom count and delay. Default omits `retryPolicy` and uses the adapter policy (ten retries, 1 s to 60 s). Custom writes `{ mode: 'normal', maxRetries, backoff: { initialDelayMs, maxDelayMs } }` with `maxDelayMs` at least 60 s. The control is per provider route, not per model. Stored `mode: 'always'` from yaml stays valid custom so Apply of other fields is not blocked; editing count or delay converts it to normal. Blank or illegal count/delay stores `{ mode: 'normal' }` without NaN and disables Apply/Create.

## Verification

`pnpm exec vitest run packages/client/ui-settings-models/tests/retry-policy.client.spec.ts packages/client/ui-settings-models/tests/provider-form.client.spec.tsx packages/client/ui-settings-models/tests/components.client.spec.tsx` covers omission vs custom drafts, NaN refusal, DeepSeek path ops, Default unset, blank-count disable, and create-card include/omit.

## Alternatives considered

**A per-model retry control.** Rejected: retry is a provider-route policy on the adapter, unlike reasoning effort.

**Expose always mode, retryable codes, or jitter.** Rejected: the user asked for count and delay only; the rest stays yaml-only.

**Guess a policy from the model or provider id.** Rejected: Default is omission, Custom is explicit numbers.

**Import `@x1a0f3n9/dsh-llm` into the client for the adapter defaults.** Rejected: the source-plane split forbids it; the card copies the numeric defaults.

## Consequences

- Users can set retry count and first delay from Settings → Models without editing yaml.
- Default keeps previous adapter behavior and writes no `retryPolicy` key.
- Always-mode yaml stays loadable; changing the two numbers replaces it with normal mode.
- Timeouts, retryable codes, and always-mode still have no card fields.
