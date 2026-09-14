# Agent Note: 恢复浏览器模块表里的官方 dsh 别名

Status: implemented

[English](2026-09-15-client-modules-official-alias.md) | 中文

## Problem

Web 客户端把平台模块种在 `@x1a0f3n9/dsh-*` 下。社区客户端插件，包括预装的 `dsh-context`，仍然 `require("@deepseek-ai/dsh-client-ui-primitives")`。`packages/client/modules/src/package-alias.ts` 把映射两边都写成了 fork 前缀，于是这次 require 打不中模块表，界面报 "Failed to load plugins"。

## Decision

浏览器模块表把 `@deepseek-ai/dsh-*` 映射到 `@x1a0f3n9/dsh-*`，并支持反向查找。官方 CLI 名 `@deepseek-ai/dsh` 不是库前缀，保持不映射。Host 侧的 Node resolution 和 profile `.pnpmfile.cjs` 已经改写同一批库名；这里补回浏览器这一半。

## Alternatives considered

**把每个社区插件都重新编译成 `@x1a0f3n9/dsh-*`。** 预装插件仍可以为产品修复而 fork。官方插件必须能直接加载，不能再编一次。

**在 HTML 里同时种官方名和 fork 名。** 这会把每个平台模块复制一份，插件工厂仍会 require 官方拼写。

## Consequences

- `dsh-context` 和其他官方 scope 的客户端插件会把 `@deepseek-ai/dsh-client-ui-primitives` 解析到已种下的 fork 模块。
- 测试钉住别名的两个方向，包括 `@deepseek-ai/dsh` 不会被改写。
