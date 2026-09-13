# Agent Note: keyless Bing/DuckDuckGo web search

Status: implemented

English | [中文](2026-09-13-keyless-web-search-free.zh.md)

## Problem

`web_search` is a `ctx.web` backend, not the current chat model's API. The shipped order was Perplexity then Exa, with DeepSeek search mounted but unlisted. Users who chat on Grok or other pi-ai routes often hold no Perplexity or Exa key. Those turns then had no usable ordered provider, so search stopped or still needed a DeepSeek search endpoint the user does not want to bill.

## Decision

Add `@x1a0f3n9/dsh-web-search-free` as the `free` search provider. It reads Bing HTML first and DuckDuckGo HTML if Bing yields no sources. The shipped order is `[perplexity, exa, free]`. DeepSeek search stays mounted and remains a pin-only choice. Redirects are followed because HTML engines geo-redirect; credentialed search backends still reject redirects.

## Alternatives considered

**Use the current chat model's API key for search.** Rejected: this seam has no Grok or generic-chat search provider. DeepSeek search talks to a separate Anthropic-compatible search endpoint.

**Fall through to DeepSeek when Perplexity and Exa are missing.** Rejected earlier: that bills DeepSeek search on unrelated chat turns.

**Ship search as MCP or a community plugin.** Rejected: every chat model needs `web_search` in the default profile. A first-party `ctx.web` provider keeps one ordered id and the existing tool.

**Host a paid search API in this fork.** Rejected: the requirement is keyless search that works without another vendor account.

## Consequences

- Default search is Perplexity, then Exa, then keyless Bing/DuckDuckGo.
- Chat routes without a search key still run `web_search`.
- Pinning `searchProvider: deepseek-official` still selects DeepSeek search.
- HTML layout changes can empty the keyless result until the parsers are updated.
