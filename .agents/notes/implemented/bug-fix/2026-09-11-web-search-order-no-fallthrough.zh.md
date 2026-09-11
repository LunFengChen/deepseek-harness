# Agent Note: Ordered web search does not fall through to DeepSeek

Status: implemented

[English](2026-09-11-web-search-order-no-fallthrough.md) | 中文

## Problem

已交付的 base 设置了 `searchProviderOrder: [perplexity, exa]`，网页搜索应先用 Perplexity，再用 Exa，只有用户固定 `searchProvider: deepseek-official` 时才走 DeepSeek。这两个提供方都不可用时，`resolveProvider()` 仍会选中剩下那个唯一可用的后端。`DEEPSEEK_API_KEY` 会让 `deepseek-official` 搜索变成可用，于是 Grok 或其他聊天回合会去扣 DeepSeek 搜索费，并在 HTTP 402 失败。

聊天模型的凭证不是搜索凭证。Pi-ai/Grok 在这条 seam 里没有搜索提供方，所以“用当前模型的 key”并不能跑 DeepSeek 搜索。

## Decision

设置了 `searchProviderOrder` 时，它是独占允许列表。不可用的 id 会被跳过。如果这些提供方都不可用，搜索抛出 `WEB_PROVIDER_UNAVAILABLE`，而不是自动选中未列出的提供方。固定 `searchProvider`（包括 `deepseek-official`）仍然是严格的。

## Alternatives considered

**继续回落到唯一可用提供方。** 否决：加这个顺序就是为了阻止静默扣 DeepSeek 的钱，而剩下那个唯一可用后端通常就是 DeepSeek，因为它的聊天 key 已经在。

**用当前聊天模型的 API key 做搜索。** 否决：这条 seam 的 DeepSeek 搜索走的是单独的 Anthropic 兼容搜索端点。Grok/pi-ai 在这里没有搜索提供方。

## Consequences

- 默认 Perplexity → Exa 搜索在缺少这些 key 时，不再扣 DeepSeek 的钱。
- 想用 DeepSeek 搜索的用户必须在设置或配置里固定 `searchProvider: deepseek-official`。
- 省略 `searchProviderOrder` 的组合仍会自动选择唯一可用提供方。
