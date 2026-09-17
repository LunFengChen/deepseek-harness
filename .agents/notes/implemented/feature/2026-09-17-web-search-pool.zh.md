# Agent Note: first-party multi-key web search pool

Status: implemented

[English](2026-09-17-web-search-pool.md) | 中文

## Problem

默认搜索是独占的 `searchProviderOrder`。Perplexity 和 Exa 各自只用一把密钥，也不会在同一次请求中重试。社区插件已经把多密钥轮换和 Tavily 式故障转移合在一起，但 fork Tavily 插件会抢走 `web_fetch`，并且落在第一方 web 包族之外。把池化塞进 `web-search-free`，或折进 `dsh-web`，会把调度器和叶子 HTML 适配器混在一起，或和服务“每次只选一个已注册 id”的职责混在一起。

## Decision

交付 `@x1a0f3n9/dsh-web-search-pool`，插件名 `web-search-pool`，提供方 id `search-pool`。它是一个 `WebSearchProvider`：按 failover 或 rotate 依次尝试 Tavily、Perplexity、Exa、Serper、Brave、Jina，最后是无需密钥的 `free`。每个后端的多把密钥按逗号或空白拆分。配额/鉴权失败会让该 `${backend}:${key}` 熔断打开得比瞬时失败更久。没有密钥就跳过 Tavily，避免在 `free` 之前烧掉匿名 Tavily 配额。带凭证的适配器使用 `redirect: 'error'`。fetch 仍是 `http`。已交付的 base 设置 `searchProviderOrder: [search-pool]`，并且不固定 `searchProvider`，因此设置里的 Default 仍表示走顺序，叶子固定仍然生效。`free`、Exa、Perplexity 和 DeepSeek 仍可单独固定。Tavily extract/map/crawl 保持关闭。

相关：[有序 web 搜索不会回落到 DeepSeek](../bug-fix/2026-09-11-web-search-order-no-fallthrough.zh.md)；叶子 `free` 见[无需密钥的 Bing/DuckDuckGo web 搜索](2026-09-13-keyless-web-search-free.zh.md)。

## Alternatives considered

**Fork moguiyu/dsh-tavily，再加 failover 的多密钥。** 否决：那个插件还会注册 fetch，而产品需要第一方调度器，并让 `web_fetch` 继续走匿名 HTTP。

**改名或重载 `web-search-free`。** 否决：`free` 是无需密钥的 HTML 叶子。池化、熔断和厂商密钥属于调度器包。

**把重试放进 `dsh-web`。** 否决：服务每次请求只选一个已注册提供方。请求中的故障转移是提供方行为。

**在 base 里固定 `searchProvider: search-pool`。** 否决：固定会盖住顺序，也会让设置里的 Default 不再表示“使用独占允许列表”。只在 `searchProviderOrder` 里列出 `search-pool` 就足以独占选择。

**默认包含无需密钥的 Tavily。** 否决：那会在本地 HTML 一跳之前消耗共享匿名配额。

## Consequences

- 默认 `web_search` 跑 `search-pool`；缺少 Perplexity/Exa 密钥时，在该提供方内部落到 `free`，而不是让独占顺序失败。
- 固定 `exa`、`perplexity`、`free` 或 `deepseek-official` 仍只选中那一个叶子。
- `web_fetch` 不变。
- 带零来源的 200 不会走到下一个厂商。
