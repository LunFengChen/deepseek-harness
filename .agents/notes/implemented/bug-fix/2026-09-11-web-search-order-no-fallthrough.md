# Agent Note: Ordered web search does not fall through to DeepSeek

Status: implemented

English | [中文](2026-09-11-web-search-order-no-fallthrough.zh.md)

## Problem

The shipped web-app overlays `searchProviderOrder: [search-pool, perplexity, exa, free]` so xfdsh web search uses the multi-key pool (Tavily, Perplexity, Exa, then keyless Bing/DuckDuckGo) and only uses DeepSeek when the user pins `searchProvider: deepseek-official`. The shipped base keeps `[perplexity, exa, free]`. After ordered providers were unavailable, `resolveProvider()` still selected the unique remaining usable backend. `DEEPSEEK_API_KEY` makes `deepseek-official` search available, so a Grok or other chat turn billed DeepSeek search and failed with HTTP 402.

Chat-model credentials are not search credentials. Pi-ai/Grok has no provider in this seam, so "use the current model's key" cannot run DeepSeek search.

## Decision

When `searchProviderOrder` is set, it is an exclusive allowlist. Unusable ids are skipped. If none of those providers are usable, search throws `WEB_PROVIDER_UNAVAILABLE` instead of auto-selecting an unlisted provider. Pinning `searchProvider` (including `deepseek-official`) stays strict. The shipped web-app allowlist is `[search-pool, perplexity, exa, free]`; the shipped base allowlist is `[perplexity, exa, free]`; see [web search pool](../feature/2026-09-17-web-search-pool.md).

## Alternatives considered

**Keep unique-usable fallthrough.** Rejected: the order was added to stop silent DeepSeek billing, and the unique remaining backend is usually DeepSeek because its key is already present for chat.

**Use the current chat model's API key for search.** Rejected: this seam's DeepSeek search talks to a separate Anthropic-compatible search endpoint. Grok/pi-ai has no search provider here.

## Consequences

- Default xfdsh web `search-pool` search no longer bills DeepSeek when pool backends are missing keys; DeepSeek stays unlisted.
- Users who want DeepSeek search must pin `searchProvider: deepseek-official` in Settings or config.
- Compositions that omit `searchProviderOrder` still auto-select the unique usable provider.
