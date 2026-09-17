# Agent Note: first-party multi-key web search pool

Status: implemented

English | [中文](2026-09-17-web-search-pool.zh.md)

## Problem

Default search is an exclusive `searchProviderOrder`. Perplexity and Exa each take one key and do not retry mid-request. Community plugins already combine multi-key rotation with Tavily-style failover, but a Tavily fork would steal `web_fetch` and sit outside the first-party web family. Expanding `web-search-free` or folding pooling into `dsh-web` would mix a scheduler with a leaf HTML adapter or with the service that only selects one registered id.

## Decision

Ship `@x1a0f3n9/dsh-web-search-pool` as plugin `web-search-pool`, provider id `search-pool`. It is a `WebSearchProvider`: failover or rotate across Tavily, Perplexity, Exa, Serper, Brave, Jina, then keyless `free`. Multiple keys per backend split on comma or whitespace. A quota/auth failure opens that `${backend}:${key}` circuit longer than a transient burst. Tavily without a key is skipped so anonymous Tavily quota is not burned before `free`. Credentialed adapters use `redirect: 'error'`. Fetch stays `http`. The shipped base sets `searchProviderOrder: [search-pool]` and does not pin `searchProvider`, so Settings Default still means the order and a leaf pin still wins. `free`, Exa, Perplexity, and DeepSeek remain independently pin-able. Tavily extract/map/crawl stay off.

Related: exclusive order in [ordered web search does not fall through](../bug-fix/2026-09-11-web-search-order-no-fallthrough.md); the `free` leaf in [keyless Bing/DuckDuckGo web search](2026-09-13-keyless-web-search-free.md).

## Alternatives considered

**Fork moguiyu/dsh-tavily and add failover's multi-key.** Rejected: that plugin also registers fetch, and the product needs a first-party scheduler that keeps `web_fetch` on anonymous HTTP.

**Rename or overload `web-search-free`.** Rejected: `free` is the keyless HTML leaf. Pooling, circuits, and vendor keys belong in a scheduler package.

**Put retry inside `dsh-web`.** Rejected: the service selects one registered provider per request. Mid-request failover is provider behavior.

**Pin `searchProvider: search-pool` in the base.** Rejected: a pin hides the order and blocks Settings Default from meaning "use the exclusive allowlist". Listing only `search-pool` in `searchProviderOrder` is enough for exclusive selection.

**Include keyless Tavily by default.** Rejected: it would consume a shared anonymous quota before the local HTML hop.

## Consequences

- Default `web_search` runs `search-pool`; missing Perplexity/Exa keys fall through that provider to `free` instead of failing the exclusive order.
- Pinning `exa`, `perplexity`, `free`, or `deepseek-official` still selects that leaf alone.
- `web_fetch` is unchanged.
- A 200 with zero sources does not walk to the next vendor.
