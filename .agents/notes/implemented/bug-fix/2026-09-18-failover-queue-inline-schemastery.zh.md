# Agent Note: failover-queue 的 client 必须内联 schemastery

Status: implemented

[English](2026-09-18-failover-queue-inline-schemastery.md) | 中文

## Problem

预装的 `@x1a0f3n9/dsh-failover-queue` client factory 会 `require("@deepseek-ai/schemastery")`。该 specifier 不是 platform seed。仓库内的 client bundle 会把 vendored schemastery 内联进去。插件的 tsdown 配置把 peer dependency 留成了 external，因此 Web 启动会以 `missed the module table` 失败。

## Decision

改插件，不改宿主模块表。`dsh-failover-queue` `v0.1.4` 在 `lib/client.js` 内联 schemastery，并把 React 留作 seed-table external。xfdsh 钉 `github:LunFengChen/dsh-failover-queue#v0.1.4`。`@deepseek-ai/schemastery` 不进入 `PLATFORM_MODULES`。

## Verification

对插件 `lib/client.js` 跑 `rg 'require\\("@deepseek-ai/schemastery"\\)'` 应为空；`require("react")` 仍在。`pnpm install` 之后重启 `xfdsh web`。

## Alternatives considered

**把 `@deepseek-ai/schemastery` 加进 `PLATFORM_MODULES`。** 这会把 client purity gate 规定为仅内联的库变成共享模块，也会掩盖所有忘了打包 vendored library 的插件。

**钉在 `v0.1.3` 并改 `node_modules`。** 下一次安装会把坏掉的 factory 装回来。

## Consequences

- 仍然 `require` schemastery 的社区插件会失败，直到它们改为内联。
- 宿主 Node 仍把 `@deepseek-ai/schemastery` 解析为该插件的 peer。
