# Agent Note: pi-ai sends model output capability as the request cap

Status: implemented

English | [中文](2026-09-11-pi-ai-capability-as-request-output-cap.zh.md)

## Problem

Hand-declared pi-ai routes such as OpenAI-compatible gateways often omit `maxTokens`. The adapter treated catalog and fallback `maxTokens` as capability only, so `defaultMaxTokens` stayed unset and the request omitted `max_output_tokens`. Gateways then applied their own small default, finished with `max_tokens`, and the UI reported that output had hit a token ceiling the user never chose.

## Decision

`PiAiAdapter.modelInfo` always publishes `defaultMaxTokens`: an explicit profile cap wins, otherwise the model's capability (installed catalog or the route `defaultMaxTokens` fallback). The undescribed-model fallback is `256,000`, matching the native DeepSeek adapter. `LlmRuntime` still materializes that value into `request/header` with `adapterDefaults.maxTokens: true` before the wire call.

This reverses the earlier pi-ai choice not to send a catalog capability as a request default. That choice assumed omitting the field meant "no cap"; on many gateways it instead means "use the provider's hidden default."

## Verification

`packages/llm/llm-pi-ai/tests/catalog.spec.ts` expects a catalog model without an explicit cap to publish `defaultMaxTokens` equal to `Model.maxTokens`, a configured cap of `4096` to win, and a bare hand-declared model to size at `256,000`.

## Alternatives considered

**Keep omitting the field and tell users to set `maxTokens` per model.** Rejected: most hand-declared gateway models never name a cap, and the truncation looks like a harness bug.

**Auto-send "continue" after a `max-tokens` stop.** Rejected for this change: a large request cap prevents the hidden gateway default. Turn-level continuation remains a separate UX.

**Clamp every model to its catalog maximum when that is smaller than 256,000.** Unnecessary: catalog models already send `Model.maxTokens`, and inventing extra clamping is not required by current APIs.

## Consequences

- Requests that name no `maxTokens` now send the model capability or `256,000`.
- Some gateways may reject a cap larger than the model allows; deployments lower `maxTokens` or `defaultMaxTokens` on that route.
- The adapter-owned max-token seam still owns reconstruction; this note owns pi-ai publishing the field.

## Related

[Adapter-owned max-token defaults](../../archived/architecture/2026-07-30-adapter-owned-max-token-defaults.md)
