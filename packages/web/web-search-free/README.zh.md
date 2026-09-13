---
description: "ctx.web 的无需密钥 Bing/DuckDuckGo 搜索提供方：部署方如何挂载不依赖厂商 API 密钥的 HTML 搜索。"
kind: "package-reference"
---

# @x1a0f3n9/dsh-web-search-free

[English](README.md) | 中文

## 概述

有了 `dsh-web-search-free`，harness 会先通过 Bing HTML 搜索 web，Bing 没有来源时再走 DuckDuckGo HTML。当部署需要让每个聊天模型都能 `web_search`、又没有 Perplexity、Exa 或 DeepSeek 搜索密钥时选择它。此后端会跟随 HTML 重定向，并发送 Mozilla 兼容的产品标识；它不返回生成答案，因此结果不携带 `content`——只产出可引用的来源。只含 URL 的命中也会保留。面向模型的 `web_search` 工具位于 `dsh-tool-web`。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [进一步探索](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

在已加载 web 服务的组合中挂载本提供方；它以 `free` 搜索提供方身份注册，因此当它是唯一可用的搜索后端时，`ctx.web.search()` 会自动解析到它——也可以用 `searchProvider: free` 固定。已交付的 base 把它放在 `searchProviderOrder: [perplexity, exa, free]` 的最后。

### 何时选择

当搜索必须在没有厂商 API 密钥时也能工作——包括 Grok 和其他 pi-ai 聊天路由——时选择此后端。任一 HTML 源无法解析、User-Agent 为空，或已配置的 `numResults` 不是正整数时，提供方不可用——每次搜索调用都会以结构化错误失败。

### 最小配置

加载 web 服务与本提供方；源站和 User-Agent 都有公开默认值，不读取任何环境密钥。

```yaml
- name: '@x1a0f3n9/dsh-web'
- name: '@x1a0f3n9/dsh-web-search-free'
```

| 字段 | 默认值 | 含义 |
|---|---|---|
| `bingBaseURL` | `https://www.bing.com` | Bing 源站；追加 `/search`。无法解析时提供方不可用 |
| `ddgBaseURL` | `https://html.duckduckgo.com` | DuckDuckGo HTML 源站；追加 `/html/`。无法解析时提供方不可用 |
| `userAgent` | Mozilla 兼容的产品标识 | 每次请求发送的 `User-Agent`；为空时提供方不可用 |
| `numResults` | （未设置） | 请求不含 `maxResults` 时使用的默认结果数；必须是正整数 |

生成的[配置目录](../../../docs/config-catalog.zh.md#x1a0f3n9dsh-web-search-free)是每个受支持字段及其 JSDoc 的穷尽式真源。

### 搜索返回什么

Bing 中可恢复的 http(s) URL 会变成 `WebSearchSource`（`url`、可选 `title`、可选 `snippet`）。如果 Bing 没有来源，就用同样方式查询 DuckDuckGo HTML。请求的 `maxResults` 优先于已配置的默认 `numResults`，并作为 Bing 的 `count` 发送；DuckDuckGo 没有数量控制，服务仍会强制执行上限。两个引擎都不返回生成答案，因此结果不携带 `content`。任一引擎成功但零命中时，结果为空而不是错误。两个引擎都失败后，调用才会抛错。

### 失败与恢复

提供方失败——HTTP 错误、网络失败、响应体不可读——在两个引擎都失败后以 `WebError` `WEB_PROVIDER_ERROR` 呈现；中止请求以 `WEB_ABORTED` 呈现，并且不会回退到下一个引擎。HTML 搜索引擎会按地区重定向，因此此后端跟随重定向而不是拒绝它们。调用方根据错误码进行分流；面向模型的 `web_search` 工具会在自己的错误包装层内把失败呈现给模型。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节——点击展开</summary>

本节解释提供方背后的设计决策；可观察行为已在[使用本包](#use-this-package)中完整说明。

### 设计理念

该提供方是 HTML 之上的薄适配器，遵循两条刻意的规则：

- **无需密钥的搜索是 `ctx.web` 后端，不是聊天模型的 API。** Grok 和其他聊天路由在这里没有搜索端点；本包就是这些回合仍然能调用 `web_search` 的方式。
- **不虚构答案。** Bing 和 DuckDuckGo HTML 返回的是引用，因此省略 `content`，而不是编造模型可能信任的提供方文本。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：配置 schema 与提供方注册 |
| [`src/provider.ts`](src/provider.ts) | `FreeSearchProvider`：先 Bing 再 DuckDuckGo 的分发、中止分类、空结果与错误策略 |
| [`src/html.ts`](src/html.ts) | SERP HTML 解析与跟踪 URL 还原 |
| — | 不发布运行时不变量配套入口；除所属 seam 强制执行的约定外，本包没有独立的事件序列或可变数据关系。 |

### 请求与映射流程

`search()` 以 `redirect: 'follow'` GET `{bingBaseURL}/search`。Bing 只要有非空来源就立即返回。否则再 GET `{ddgBaseURL}/html/`。中止——名为 `AbortError` 的 `DOMException`，已经映射为 `WEB_ABORTED`——不会回退；单个引擎的其他失败记为引擎错误，只有双失败才变成 `WEB_PROVIDER_ERROR`。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

当包级约定不够用时阅读以下页面。它们从共享词汇逐步进入服务、面向模型的工具与设计依据。

- [web 子系统](../../../docs/subsystems/web.zh.md)——穷尽式的搜索请求／结果词汇与错误码。
- [web 包映射](../README.zh.md)——七包家族与各角色。
- [dsh-web](../web/README.zh.md)——本提供方注册进入的 web 服务。
- [dsh-tool-web](../tool-web/README.zh.md)——渲染本提供方来源的面向模型 `web_search` 工具。
- [生成配置目录](../../../docs/config-catalog.zh.md#x1a0f3n9dsh-web-search-free)——每个受支持配置字段及其源声明。
- [web 能力 seam 决策](../../../.agents/notes/implemented/architecture/2026-06-24-web-capability-seam.zh.md)——搜索与抓取为何共用一项提供方选择服务。

-----

<a id="model-experience"></a>
## 模型体验

通过 `dsh-tool-web` 间接影响模型体验。该工具保留本提供方的 URL、标题与 snippet；如果发生失败，则会在消费方的错误包装层内保留原样错误消息 `Bing search aborted`、`DuckDuckGo search aborted`、`Bing search request failed: <error>`、`DuckDuckGo search request failed: <error>`、`Bing search HTTP <status>`、`DuckDuckGo search HTTP <status>`、`Bing returned an unreadable response body: <error>`、`DuckDuckGo returned an unreadable response body: <error>` 和 `Free search failed: Bing: <error>; DuckDuckGo: <error>`。

#### KV Cache 影响

不会直接导致 KV Cache 失效；请求前缀变更由上述消费方负责。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>


这些限制说明提供方在哪些情况下不合适。它们是当前包约束。

- **HTML 布局由厂商控制**——选择器在测试里对着夹具 markup 钉死；线上 SERP 改版可能导致空来源，直到解析器更新。
- **没有生成答案，也没有 `publishedAt`**——来源只有 URL、标题和 snippet，因此工具没有提供方散文，也没有发布日期。
- **按错误形状分类中止**——只有名为 `AbortError` 的 `DOMException` 才映射为 `WEB_ABORTED`；携带自定义原因的中止（例如 `dsh-timeout` 的 `TimeoutReason`）呈现为 `WEB_PROVIDER_ERROR`。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

本开发备注是维护者的工作上下文：开放问题与尚未决定的探索方向。它明确不具权威性——已交付的行为、限制与既定理由以上文和相关 Agent Note 为准。

#### 未来：更多无需密钥的引擎

如果某个地区 Bing 和 DuckDuckGo 都开始返回空页，可以再加入第三个 HTML 引擎。这个改动应留在本提供方内，而不是再做一个 `ctx.web` 包，这样有序列表仍然只有一个 id：`free`。

</details>
