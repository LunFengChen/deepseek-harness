# Agent Note: session-timeline client must not require dsh-session/types

Status: implemented

[English](2026-09-18-session-timeline-client-session-seq.md) | 中文

## Problem

预装的 `@x1a0f3n9/dsh-session-timeline` client factory 在 `#v0.1.0` 会 `require("@x1a0f3n9/dsh-session/types")`。之后的 `0.1.5-xfdsh.1` 构建仍会 `require("@deepseek-ai/dsh-session/types")`。这两个 specifier 都不是 platform seed。Web 启动会以 `missed the module table` 失败。

## Decision

改插件，不改宿主模块表。`dsh-session-timeline` `0.1.5-xfdsh.2` 用本地 helper 给 chat-node seq 打 brand，client 只把 platform/inject 留成 external，并在构建时拒绝 `dsh-session` 的值导入。xfdsh 钉 `github:LunFengChen/dsh-session-timeline#v0.1.5-xfdsh.2`。`pnpm-workspace.yaml` 把该插件仍声明的官方 peer 名映射到工作区 `@x1a0f3n9/dsh-*`。`@deepseek-ai/dsh-session` 和 `@x1a0f3n9/dsh-session` 不进入 `PLATFORM_MODULES`。

## Verification

对插件 `lib/client.js` 跑 `rg 'require\("@.+/dsh-session'` 应为空。剩下的 require 是 `react`、`react-dom`、`react/jsx-runtime` 和 `@deepseek-ai/dsh-client-ui-primitives`。`pnpm install` 之后重启 `xfdsh web`。

## Alternatives considered

**把 `dsh-session/types` 加进 `PLATFORM_MODULES`。** 这会把 Host session factory 放进浏览器模块表，也会掩盖所有忘了把 session types 保持为 type-only 的插件。

**钉在 `v0.1.0` 并改 `node_modules`。** 下一次安装会把坏掉的 factory 装回来。

**把插件 peer 改写成 `npm:@x1a0f3n9/dsh-*@workspace:*`。** 否决：其它 LunFengChen fork 仍用官方 `@deepseek-ai/dsh-*` 名，由 `pnpm-workspace.yaml` 做映射。

## Consequences

- 宿主 Node 仍把 `@deepseek-ai/dsh-session` 解析为该插件的 peer。
- 仍然 `require` session types 的社区插件会失败，直到它们改为本地 brand 或 type-only 导入。
