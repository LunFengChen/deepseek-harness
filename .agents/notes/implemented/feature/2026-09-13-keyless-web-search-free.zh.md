# Agent Note: keyless Bing/DuckDuckGo web search

Status: implemented

[English](2026-09-13-keyless-web-search-free.md) | 中文

## Problem

`web_search` 是 `ctx.web` 后端，不是当前聊天模型的 API。已交付的顺序是先 Perplexity 再 Exa，DeepSeek 搜索挂着但不在列表里。用 Grok 或其他 pi-ai 路由聊天的用户常常没有 Perplexity 或 Exa 密钥。这些回合就没有可用的有序提供方，搜索会停，或者还得去打用户不想付的 DeepSeek 搜索端点。

## Decision

新增 `@x1a0f3n9/dsh-web-search-free`，作为 `free` 搜索提供方。它先读 Bing HTML，Bing 没有来源时再读 DuckDuckGo HTML。已交付的 xfdsh web 独占顺序是 `[search-pool, perplexity, exa, free]`；`free` 仍是可固定的叶子，也是搜索池的最后一跳。DeepSeek 搜索仍挂载，并且只能靠固定选择。HTML 搜索引擎会按地区重定向，所以这里跟随重定向；带凭证的搜索后端仍然拒绝重定向。见[web 搜索池](2026-09-17-web-search-pool.zh.md)。

## Alternatives considered

**用当前聊天模型的 API key 做搜索。** 否决：这条 seam 没有 Grok 或通用聊天搜索提供方。DeepSeek 搜索走的是单独的 Anthropic 兼容搜索端点。

**Perplexity 和 Exa 都缺时回落到 DeepSeek。** 此前已否决：那会在无关聊天回合上扣 DeepSeek 搜索费。

**把搜索做成 MCP 或社区插件。** 否决：默认 profile 里每个聊天模型都需要 `web_search`。第一方 `ctx.web` 提供方可以保留一个有序 id 和现有工具。

**在这个 fork 里托管付费搜索 API。** 否决：需求是无需密钥、也不再开一个厂商账号的搜索。

## Consequences

- xfdsh web 默认搜索是 `search-pool`，其最后一跳是无需密钥的 Bing/DuckDuckGo。固定 `searchProvider: free` 可单独使用本叶子。
- 没有搜索密钥的聊天路由仍能跑 `web_search`。
- 固定 `searchProvider: deepseek-official` 仍会选中 DeepSeek 搜索。
- HTML 布局变化可能让无需密钥的结果变空，直到解析器更新。
