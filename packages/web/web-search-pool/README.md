---
description: "The multi-key failover search provider for ctx.web: how deployments schedule Tavily, Perplexity, Exa, Serper, Brave, Jina, and keyless Bing/DuckDuckGo behind one web_search id."
kind: "package-reference"
---

# @x1a0f3n9/dsh-web-search-pool

English | [中文](README.zh.md)

## Summary

With `dsh-web-search-pool`, the harness searches the web through one `search-pool` provider that tries several vendor adapters and API keys, then keyless Bing/DuckDuckGo. Choose it when a deployment wants `web_search` to keep working across missing keys, 429s, and quota errors instead of pinning a single vendor. The pool does not own fetch; `web_fetch` stays on `dsh-web-fetch-http`. The model-facing `web_search` tool lives in `dsh-tool-web`.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Mount the provider in a composition that already loads the web service; it registers as the `search-pool` search provider. The shipped xfdsh web-app preinstalls it and overlays `searchProviderOrder: [search-pool, perplexity, exa, free]`. Pin a leaf (`perplexity`, `exa`, `free`, `deepseek-official`) when a deployment wants that vendor alone.

### When to choose it

Choose this backend when search should fail over across keys and vendors, including Grok and other pi-ai chat routes that hold no DeepSeek search key. The provider is unavailable — and every search call fails with a structured error — when every configured backend needs a key and none resolve.

### Minimal configuration

Load the web service and the pool; API keys fall back to launch-environment variables, and `free` is the last hop so a keyless deployment still searches.

```yaml
- name: '@x1a0f3n9/dsh-web'
  config:
    searchProviderOrder: [search-pool, perplexity, exa, free]
    fetchProvider: http
- name: '@x1a0f3n9/dsh-web-search-pool'
```

| Field | Default | Meaning |
|---|---|---|
| `strategy` | `failover` | `failover` walks the backend list; `rotate` round-robins the start index |
| `backends` | Tavily, Perplexity, Exa, Serper, Brave, Jina, then `free` | Preference order. A keyed row is skipped until at least one key resolves; `free` is keyless |
| `circuitFailureThreshold` | `3` | Transient failures inside `circuitWindowMs` that open that key's circuit |
| `circuitWindowMs` | `60000` | Sliding window that counts transient failures |
| `circuitCooldownMs` | `60000` | How long a transient-open circuit stays closed |
| `quotaCooldownMs` | `3600000` | How long a 401/403/402/429 (or quota-hint) failure keeps that key closed |

Per-backend fields: `id` (defaults to `kind`), `kind`, `apiKey` (secret, comma/whitespace-separated), `apiKeyEnv`, `baseURL`, `needsKey` (default true except `free`).

Default env names: `$TAVILY_API_KEYS` plus `$TAVILY_API_KEY`, `$PERPLEXITY_API_KEY`, `$EXA_API_KEY`, `$SERPER_API_KEY`, `$BRAVE_API_KEY`, `$JINA_API_KEY`.

The generated [configuration catalog](../../../docs/config-catalog.md#x1a0f3n9dsh-web-search-pool) is the exhaustive source for every accepted field and its JSDoc.

### What a search returns

The first backend that returns a normalized `WebSearchResult` wins. Empty sources are a success, not a reason to fail over. Tavily and Serper may include `content`; Exa, Brave, Jina, and `free` omit it. A request's `maxResults` is forwarded to adapters that accept a count; the service still enforces the bound.

### Failures and recovery

HTTP 401/403/402/429 and quota-hint bodies open that key's circuit and try the next key, then the next backend. Other HTTP and network failures count as transients and also fail over. After every ready backend is exhausted, the call throws `WebError` `WEB_PROVIDER_ERROR` with each attempt prefixed by backend id. An abort — a `DOMException` named `AbortError` — throws `WEB_ABORTED` immediately and does not try another backend. Credentialed adapters reject HTTP redirects before the `Location` target is contacted.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

This section explains the design decisions behind the provider; the observable behavior is fully covered in [Use this package](#use-this-package).

### Design philosophy

The pool is a scheduler, not a second web service:

- **Leaf providers stay pin-able.** Exa, Perplexity, and `free` remain their own packages. The pool constructs those classes per key; Tavily, Serper, Brave, and Jina use pool-owned HTTP.
- **Fetch is not pooled.** `fetchProvider` stays `http`. Search failover does not change how `web_fetch` reaches a URL.
- **Tavily without a key is skipped.** Anonymous Tavily quota is not burned before `free`.

### Source map

| File | Role |
|---|---|
| [`src/index.ts`](src/index.ts) | Plugin entry: config schema, env key resolution, provider registration |
| [`src/provider.ts`](src/provider.ts) | The `SearchPoolProvider`: order, key attempts, abort, exhaust |
| [`src/circuit.ts`](src/circuit.ts) | Per-key circuit: quota/auth open immediately; transients open at a threshold |
| [`src/keys.ts`](src/keys.ts) | Comma/whitespace key splitting with first-seen uniqueness |
| [`src/http.ts`](src/http.ts) | Credentialed `fetch` with `redirect: 'error'` |
| [`src/backends.ts`](src/backends.ts) | Vendor adapters and Jina markdown parsing |
| [`src/types.ts`](src/types.ts) | Strategy, backend, and circuit types |
| — | No runtime invariant companion is published; this package exposes no independent event sequence or mutable data relation beyond contracts enforced at its owning seam. |

### Request and mapping flow

`search()` walks ready backends in `strategy` order. Each key of a backend is a circuit id. A closed circuit is skipped. A successful adapter result clears that id. `WEB_ABORTED` rethrows. Other failures classify as `auth`, `quota`, or `transient`, record on the circuit, and continue.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

Read these pages when the package-level contract is not enough. They move from the shared vocabulary to the service, the model-facing tools, and the design rationale.

- [Web subsystem](../../../docs/subsystems/web.md) — the exhaustive search request/result vocabulary and error codes.
- [Web package map](../README.md) — the web package family and each role.
- [dsh-web](../web/README.md) — the web service this provider registers into.
- [dsh-tool-web](../tool-web/README.md) — the model-facing `web_search` tool that renders this provider's sources.
- [Generated configuration catalog](../../../docs/config-catalog.md#x1a0f3n9dsh-web-search-pool) — every accepted config field and its source declaration.
- [Web search pool decision](../../../.agents/notes/implemented/feature/2026-09-17-web-search-pool.md) — why pooling is a provider, not a service change.
- [Web capability seam decision](../../../.agents/notes/implemented/architecture/2026-06-24-web-capability-seam.md) — why search and fetch share one provider-selection service.

-----

<a id="model-experience"></a>
## Model Experience

Indirectly, through `dsh-tool-web`, which retains this provider's URLs, titles, snippets, optional answers, and publication dates or its exact `Search pool aborted`, `Search pool has no usable backend`, and `Search pool exhausted: <backend>: <error>` failures under the consumer's error wrapper.

#### KV Cache effect

No direct invalidation; the named consumer owns any request-prefix changes.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>


These limits define when the provider is a poor fit. They are current package constraints.

- **Tavily extract/map/crawl are not exposed** — the pool only implements `web_search`. Extra Tavily operations stay off.
- **Empty sources do not fail over** — a 200 with zero hits is success, so a keyed vendor that returns nothing will not reach `free` on that call.
- **Abort classification is error-shape-based** — only a `DOMException` named `AbortError` maps to `WEB_ABORTED`; an abort carrying a custom reason (such as `dsh-timeout`'s `TimeoutReason`) surfaces as `WEB_PROVIDER_ERROR` after failover, or as `WEB_ABORTED` only when a leaf adapter already classified it.
- **HTML layout is vendor-controlled for the last hop** — `free` selectors are pinned against fixture markup; a live SERP redesign can yield empty sources until those parsers are updated.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

This Dev Note is working context for maintainers: open questions and undecided directions. It is explicitly non-authoritative — shipped behavior, limits, and rationale live in the sections above and the linked Agent Notes.

#### Future: Tavily extract/map/crawl

Those operations are not `WebSearchRequest` fields. They would be optional extra tools, default off, behind a separate consumer — not a widening of `ctx.web.search()`.

#### Future: Settings key card

The Web provider card can pin `search-pool`. Per-vendor key editing for the pool is still the launch environment and cordis.yml.

</details>
