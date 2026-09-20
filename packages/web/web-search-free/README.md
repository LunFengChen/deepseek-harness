---
description: "The keyless Bing/DuckDuckGo search provider for ctx.web: how deployments mount HTML search that works without a vendor API key."
kind: "package-reference"
---

# @x1a0f3n9/dsh-web-search-free

English | [中文](README.zh.md)

## Summary

With `dsh-web-search-free`, the harness searches the web through Bing HTML first and DuckDuckGo HTML if Bing yields no sources. Choose it when a deployment needs `web_search` for every chat model and does not hold a Perplexity, Exa, or DeepSeek search key. The backend follows HTML redirects and sends a Mozilla-compatible product token; it returns no generated answer, so results carry no `content` — only citeable sources. URL-only hits are kept. The model-facing `web_search` tool lives in `dsh-tool-web`.

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

Mount the provider in a composition that already loads the web service; it registers as the `free` search provider, so `ctx.web.search()` resolves it automatically when it is the only usable search backend — or pin it with `searchProvider: free`. The shipped xfdsh web-app uses `searchProviderOrder: [search-pool, perplexity, exa, free]`; this leaf is the pool's last hop and remains independently pin-able.

### When to choose it

Choose this backend when search must work without a vendor API key, including Grok and other pi-ai chat routes. The provider is unavailable — and every search call fails with a structured error — when either HTML origin does not parse, the user agent is empty, or a configured `numResults` is not a positive integer.

### Minimal configuration

Load the web service and the provider; bases and the user agent have public defaults, and no environment key is read.

```yaml
- name: '@x1a0f3n9/dsh-web'
- name: '@x1a0f3n9/dsh-web-search-free'
```

| Field | Default | Meaning |
|---|---|---|
| `bingBaseURL` | `https://www.bing.com` | Bing origin; `/search` is appended. An unparseable value makes the provider unavailable |
| `ddgBaseURL` | `https://html.duckduckgo.com` | DuckDuckGo HTML origin; `/html/` is appended. An unparseable value makes the provider unavailable |
| `userAgent` | a Mozilla-compatible product token | `User-Agent` sent on every request; empty makes the provider unavailable |
| `numResults` | (unset) | Default result count when a request carries no `maxResults`; must be a positive integer |

The generated [configuration catalog](../../../docs/config-catalog.md#x1a0f3n9dsh-web-search-free) is the exhaustive source for every accepted field and its JSDoc.

### What a search returns

Bing sources with a recoverable http(s) URL become `WebSearchSource` values (`url`, optional `title`, optional `snippet`). If Bing returns none, DuckDuckGo HTML is queried the same way. A request's `maxResults` wins over the configured `numResults` default and is sent to Bing as `count`; DuckDuckGo has no count control, and the service still enforces the bound. Neither engine returns a generated answer, so the result carries no `content`. If either engine succeeds with zero hits, the result is empty rather than an error. Both engines must fail before the call throws.

### Failures and recovery

Provider failures — HTTP errors, network failures, unreadable bodies — surface as `WebError` `WEB_PROVIDER_ERROR` after both engines fail; an aborted request surfaces as `WEB_ABORTED` and does not fall through. HTML engines geo-redirect, so this backend follows redirects instead of rejecting them. Callers route on the code; the model-facing `web_search` tool surfaces failures to the model under its own error wrapper.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

This section explains the design decisions behind the provider; the observable behavior is fully covered in [Use this package](#use-this-package).

### Design philosophy

The provider is a thin HTML adapter with two deliberate rules:

- **Keyless search is a `ctx.web` backend, not the chat model's API.** Grok and other chat routes have no search endpoint here; this package is how those turns still call `web_search`.
- **No invented answers.** Bing and DuckDuckGo HTML return citations, so `content` is omitted rather than fabricating provider prose the model might trust.

### Source map

| File | Role |
|---|---|
| [`src/index.ts`](src/index.ts) | Plugin entry: config schema and provider registration |
| [`src/provider.ts`](src/provider.ts) | The `FreeSearchProvider`: Bing-then-DuckDuckGo dispatch, abort classification, empty-vs-error policy |
| [`src/html.ts`](src/html.ts) | SERP HTML parsers and tracking-URL recovery |
| — | No runtime invariant companion is published; this package exposes no independent event sequence or mutable data relation beyond contracts enforced at its owning seam. |

### Request and mapping flow

`search()` GETs `{bingBaseURL}/search` with `redirect: 'follow'`. Non-empty Bing sources return immediately. Otherwise it GETs `{ddgBaseURL}/html/`. An abort — a `DOMException` named `AbortError`, already mapped to `WEB_ABORTED` — does not fall through; anything else from one engine is an engine error, and only dual failure becomes `WEB_PROVIDER_ERROR`.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

Read these pages when the package-level contract is not enough. They move from the shared vocabulary to the service, the model-facing tools, and the design rationale.

- [Web subsystem](../../../docs/subsystems/web.md) — the exhaustive search request/result vocabulary and error codes.
- [Web package map](../README.md) — the web package family and each role.
- [dsh-web](../web/README.md) — the web service this provider registers into.
- [dsh-tool-web](../tool-web/README.md) — the model-facing `web_search` tool that renders this provider's sources.
- [Generated configuration catalog](../../../docs/config-catalog.md#x1a0f3n9dsh-web-search-free) — every accepted config field and its source declaration.
- [Web capability seam decision](../../../.agents/notes/implemented/architecture/2026-06-24-web-capability-seam.md) — why search and fetch share one provider-selection service.

-----

<a id="model-experience"></a>
## Model Experience

Indirectly, through `dsh-tool-web`, which retains this provider's URLs, titles, and snippets or its exact `Bing search aborted`, `DuckDuckGo search aborted`, `Bing search request failed: <error>`, `DuckDuckGo search request failed: <error>`, `Bing search HTTP <status>`, `DuckDuckGo search HTTP <status>`, `Bing returned an unreadable response body: <error>`, `DuckDuckGo returned an unreadable response body: <error>`, and `Free search failed: Bing: <error>; DuckDuckGo: <error>` failures under the consumer's error wrapper.

#### KV Cache effect

No direct invalidation; the named consumer owns any request-prefix changes.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>


These limits define when the provider is a poor fit. They are current package constraints.

- **HTML layout is vendor-controlled** — selectors are pinned in tests against fixture markup; a live SERP redesign can yield empty sources until the parsers are updated.
- **No generated answer and no `publishedAt`** — sources carry URL, title, and snippet only, so the tool has no provider prose and no publication date.
- **Abort classification is error-shape-based** — only a `DOMException` named `AbortError` maps to `WEB_ABORTED`; an abort carrying a custom reason (such as `dsh-timeout`'s `TimeoutReason`) surfaces as `WEB_PROVIDER_ERROR`.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

This Dev Note is working context for maintainers: open questions and undecided directions. It is explicitly non-authoritative — shipped behavior, limits, and rationale live in the sections above and the linked Agent Notes.

#### Future: additional keyless engines

A third HTML engine can join the fallback list if Bing and DuckDuckGo both start returning empty pages in a region. That change belongs in this provider, not in a second `ctx.web` package, so the ordered policy stays one id: `free`.

</details>
