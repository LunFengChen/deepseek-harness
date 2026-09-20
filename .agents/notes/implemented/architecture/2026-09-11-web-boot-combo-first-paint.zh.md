# Agent Note: Web 启动首屏 combo

Status: implemented

[English](2026-09-11-web-boot-combo-first-paint.md) | 中文

## Problem

所有启用的 `dsh.client` 包共享一两个 application combo 脚本。HTML 会预加载这些 combo，第一次 `arrive()` 会在任何插件 factory 注册前执行整段 payload。因此 6.7 MiB 的文档预览 bundle 会挡住会话列表首屏，尽管侧栏并不需要它。boot kernel 也会在 `uiRenderer.mount` 之前等待完整名册，于是可选预装插件留在了关键路径上。

## Decision

**启动 combo 按 URL 长度、合并 source 体积和 immediately 层拆分。** `immediately: true` 的 application row 留在自己的 combo 中。其余 row 在 map 形式 URL 超过 3 KiB 或合并 source 超过 512 KiB 之前切开。单个超大 bundle 独占 combo，不与邻居合并。

**HTML 只预加载 immediately 层 application combo。** 延迟 combo 仍在图上，并在第一个成员到达时加载。bootstrap combo 仍然阻塞 parser。

**boot kernel 在 `uiRenderer` 一出现就开始 hydrate。** `loader.create` 先跑 immediately 层。`mountApp` 与这一波并发注册 `uiRenderer` inject 等待，因此 React 可以在延迟 combo 开始前 hydrate。immediately 波结束后才创建延迟 entry。`run()` 仍等待完整名册，任一 entry 未激活仍会使启动审计失败。

**root outlet 等待第一次有效注册。** `BootHandoff` 会 hydrate 启动 DOM，并在 `slots.entries('root')` 非空之前停在那里。渐进挂载可能早于 layout。挂载时的空 root 是等待；空着调用 `renderSlot('root')` 仍会抛错。已 abdicate 的 root 注册仍渲染崩溃面。

## Alternatives considered

**默认关掉沉重的预装插件。** 否决，因为产品要求这些插件保持启用；首屏必须在它们存在时变快。

**新增第三种 `deferred` batch phase。** 否决，因为现有 application phase 已支持多条描述。immediately 与延迟的归属是组合规则，不是新的协议 phase。

**完全去掉 application combo preload，改为逐插件 URL。** 否决，因为 immediately 层 row 仍受益于一次共享传输，而且 HMR 在 invalidate 后已经使用单资源 URL。

**跳过非 immediately 失败的启动审计。** 本次否决，以便后续损坏的插件在挂载后仍会大声失败；范围只覆盖首屏。

## Consequences

- 大型 client bundle 不能再与侧栏/layout factory 共享启动脚本。
- 首屏可以在文档预览、市场等延迟 combo 解析完成前出现。
- 随后的 FAILED fiber 仍会在这次首屏之后用启动失败报告替换页面。
- 原先假定每个 application combo 都会预加载的测试，现在要区分 immediately 层 batch。
- `BootHandoff` 会在有效的 `root` 注册到来前保持 `[data-dsh-boot]`。

## Testing

[UI renderer 插件 spec](../../../../packages/client/ui-renderer/tests/ui-renderer.client.spec.tsx) 会在空 `root` 上 hydrate 启动页，然后再占用它。空着直接调用 `renderSlot('root')` 仍会在 [registry spec](../../../../packages/client/ui-renderer/tests/registry.client.spec.ts) 中抛错。
