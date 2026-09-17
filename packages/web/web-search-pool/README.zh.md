---
description: "ctx.web 的多密钥故障转移搜索提供方：部署如何把 Tavily、Perplexity、Exa、Serper、Brave、Jina 以及无需密钥的 Bing/DuckDuckGo 调度到同一个 web_search id 后面。"
kind: "package-reference"
---

# @x1a0f3n9/dsh-web-search-pool

[English](README.md) | 中文

## 概述

有了 `dsh-web-search-pool`，harness 通过一个 `search-pool` 提供方搜索 web：它会依次尝试多个厂商适配器和 API 密钥，最后落到无需密钥的 Bing/DuckDuckGo。当部署希望 `web_search` 在缺密钥、429 和配额错误时继续可用、而不是钉死单一厂商时选择它。搜索池不负责 fetch；`web_fetch` 仍由 `dsh-web-fetch-http` 承担。面向模型的 `web_search` 工具位于 `dsh-tool-web`。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [延伸阅读](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与延后工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

在已加载 web 服务的组合中挂载本提供方；它以 `search-pool` 搜索提供方身份注册。已交付的 xfdsh web-app 把它预置进去，并覆盖 `searchProviderOrder: [search-pool, perplexity, exa, free]`。当部署只想用某一个厂商时，再固定叶子 id（`perplexity`、`exa`、`free`、`deepseek-official`）。

### 何时选择它

当搜索应在密钥与厂商之间故障转移时选择它，包括没有 DeepSeek 搜索密钥的 Grok 和其他 pi-ai 聊天路由。当每个已配置后端都需要密钥且一个都解析不到时，提供方不可用，每次搜索都会以结构化错误失败。

### 最小配置

加载 web 服务和搜索池；API 密钥回退到启动环境变量，`free` 作为最后一跳，因此无密钥部署仍能搜索。

```yaml
- name: '@x1a0f3n9/dsh-web'
  config:
    searchProviderOrder: [search-pool, perplexity, exa, free]
    fetchProvider: http
- name: '@x1a0f3n9/dsh-web-search-pool'
```

| 字段 | 默认值 | 含义 |
|---|---|---|
| `strategy` | `failover` | `failover` 按后端列表走；`rotate` 轮转起始下标 |
| `backends` | Tavily、Perplexity、Exa、Serper、Brave、Jina，然后 `free` | 优先顺序。带密钥的行在解析到至少一个密钥之前会被跳过；`free` 无需密钥 |
| `circuitFailureThreshold` | `3` | 在 `circuitWindowMs` 内使该密钥熔断打开的瞬时失败次数 |
| `circuitWindowMs` | `60000` | 统计瞬时失败的滑动窗口 |
| `circuitCooldownMs` | `60000` | 瞬时熔断打开后保持关闭的时长 |
| `quotaCooldownMs` | `3600000` | 401/403/402/429（或配额提示）失败后该密钥保持关闭的时长 |

每个后端字段：`id`（默认等于 `kind`）、`kind`、`apiKey`（密钥，可用逗号或空白分隔）、`apiKeyEnv`、`baseURL`、`needsKey`（除 `free` 外默认为 true）。

默认环境变量：`$TAVILY_API_KEYS` 加上 `$TAVILY_API_KEY`、`$PERPLEXITY_API_KEY`、`$EXA_API_KEY`、`$SERPER_API_KEY`、`$BRAVE_API_KEY`、`$JINA_API_KEY`。

生成的[配置目录](../../../docs/config-catalog.zh.md#x1a0f3n9dsh-web-search-pool)是每个已接受字段及其 JSDoc 的完整来源。

### 搜索返回什么

第一个返回规范化 `WebSearchResult` 的后端胜出。空来源算成功，不会因此故障转移。Tavily 和 Serper 可能带 `content`；Exa、Brave、Jina 和 `free` 省略它。请求的 `maxResults` 会转发给接受计数的适配器；服务仍会强制执行该上限。

### 失败与恢复

HTTP 401/403/402/429 以及带配额提示的响应体会打开该密钥的熔断，然后尝试下一个密钥，再尝试下一个后端。其他 HTTP 和网络失败计为瞬时错误，同样会故障转移。所有就绪后端耗尽后，调用抛出 `WebError` `WEB_PROVIDER_ERROR`，每次尝试都以后端 id 为前缀。中止——名为 `AbortError` 的 `DOMException`——立即抛出 `WEB_ABORTED`，不会再试其他后端。带凭证的适配器在接触 `Location` 目标之前拒绝 HTTP 重定向。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现内部细节 — 点击展开</summary>

本节说明提供方背后的设计决策；可观察行为已在[使用本包](#use-this-package)中完整覆盖。

### 设计理念

搜索池是调度器，不是第二个 web 服务：

- **叶子提供方仍可固定。** Exa、Perplexity 和 `free` 仍是独立包。搜索池按密钥构造这些类；Tavily、Serper、Brave 和 Jina 使用池自有 HTTP。
- **不把 fetch 纳入池。** `fetchProvider` 仍是 `http`。搜索故障转移不改变 `web_fetch` 到达 URL 的方式。
- **没有密钥就跳过 Tavily。** 匿名 Tavily 配额不会在 `free` 之前被烧掉。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：配置 schema、环境密钥解析、提供方注册 |
| [`src/provider.ts`](src/provider.ts) | `SearchPoolProvider`：顺序、密钥尝试、中止、耗尽 |
| [`src/circuit.ts`](src/circuit.ts) | 按密钥熔断：配额/鉴权立即打开；瞬时错误达到阈值后打开 |
| [`src/keys.ts`](src/keys.ts) | 逗号/空白拆分密钥，按首次出现去重 |
| [`src/http.ts`](src/http.ts) | 带凭证的 `fetch`，`redirect: 'error'` |
| [`src/backends.ts`](src/backends.ts) | 厂商适配器与 Jina markdown 解析 |
| [`src/types.ts`](src/types.ts) | 策略、后端和熔断类型 |
| — | 不发布运行时 invariant 伴生模块；本包除所属 seam 已强制的约定外，不暴露独立事件序列或可变数据关系。 |

### 请求与映射流程

`search()` 按 `strategy` 顺序遍历就绪后端。每个后端的每个密钥是一个熔断 id。已打开的熔断会被跳过。适配器成功会清除该 id。`WEB_ABORTED` 会重新抛出。其他失败归类为 `auth`、`quota` 或 `transient`，记入熔断，然后继续。

</details>

-----

<a id="further-exploration"></a>
## 延伸阅读

当包级约定不够用时阅读这些页面。它们从共享词汇走到服务、面向模型的工具和设计理由。

- [Web 子系统](../../../docs/subsystems/web.zh.md) — 完整的搜索请求/结果词汇与错误码。
- [Web 包地图](../README.zh.md) — web 包族与各角色。
- [dsh-web](../web/README.zh.md) — 本提供方注册进入的 web 服务。
- [dsh-tool-web](../tool-web/README.zh.md) — 渲染本提供方来源的面向模型 `web_search` 工具。
- [生成的配置目录](../../../docs/config-catalog.zh.md#x1a0f3n9dsh-web-search-pool) — 每个已接受配置字段及其源码声明。
- [Web 搜索池决策](../../../.agents/notes/implemented/feature/2026-09-17-web-search-pool.zh.md) — 为什么池化是提供方，而不是服务变更。
- [Web 能力 seam 决策](../../../.agents/notes/implemented/architecture/2026-06-24-web-capability-seam.zh.md) — 为什么 search 与 fetch 共用一个提供方选择服务。

-----

<a id="model-experience"></a>
## 模型体验

间接地，通过 `dsh-tool-web`，它会保留本提供方的 URL、标题、snippet、可选答案和发布日期，或在消费者的错误包装下保留精确的 `Search pool aborted`、`Search pool has no usable backend` 和 `Search pool exhausted: <backend>: <error>` 失败。

#### KV Cache effect

无直接失效；由具名消费者拥有任何请求前缀变化。

## 已知限制与延后工作

<a id="known-limitations-and-deferred-work"></a>


这些限制说明该提供方何时不合适。它们是当前的包约束。

- **不暴露 Tavily extract/map/crawl** — 搜索池只实现 `web_search`。额外的 Tavily 操作保持关闭。
- **空来源不会故障转移** — 带零命中的 200 算成功，因此返回空结果的带密钥厂商不会在那一次调用里落到 `free`。
- **中止分类基于错误形态** — 只有名为 `AbortError` 的 `DOMException` 会映射为 `WEB_ABORTED`；携带自定义原因的中止（例如 `dsh-timeout` 的 `TimeoutReason`）会在故障转移后表现为 `WEB_PROVIDER_ERROR`，只有叶子适配器已经分类时才是 `WEB_ABORTED`。
- **最后一跳的 HTML 布局由厂商控制** — `free` 选择器针对夹具标记固定；线上 SERP 改版可能让来源变空，直到那些解析器更新。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文 — 点击展开</summary>

本开发备注是维护者的工作上下文：未决问题和尚未决定的方向。它明确不具权威性——已交付行为、限制和理由写在上面各节和链接的 Agent Note 中。

#### 未来：Tavily extract/map/crawl

这些操作不是 `WebSearchRequest` 字段。它们会是默认关闭的可选额外工具，放在单独消费者后面——而不是拓宽 `ctx.web.search()`。

#### 未来：设置里的密钥卡片

Web 提供方卡片可以固定 `search-pool`。搜索池的按厂商密钥编辑仍走启动环境和 cordis.yml。

</details>
