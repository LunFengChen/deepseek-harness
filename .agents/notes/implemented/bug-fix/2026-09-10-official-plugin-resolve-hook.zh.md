# Agent Note: official plugins resolve onto fork packages at launch

Status: implemented

[English](2026-09-10-official-plugin-resolve-hook.md) | 中文

## Problem

预装的社区插件会 import `@deepseek-ai/dsh-session` 和 `@deepseek-ai/dsh-settings`。工作区 override 写成 `npm:@x1a0f3n9/dsh-*@workspace:*` 会生成坏软链。于是 `xfdsh web` 加载 `dsh-context` 和 `dsh-better-sidebar` 失败。

## Decision

在 CLI 启动时注册 Node resolve hook，把 `@deepseek-ai/dsh-*` 改写成 `@x1a0f3n9/dsh-*`。源码启动再通过 tsx path mapping 解析到 fork 包。不要改成 `link:packages/...` override：pnpm 会忽略 package.json 名不匹配的 link，然后去拉官方 registry 包。

## Verification

`pnpm exec vitest run packages/boot/app-boot/tests/official-package-resolve.spec.ts`

## Alternatives considered

**给每个工作区包加 `link:packages/...` override。** 否决：pnpm 会跳过这些 link，并向 npm 请求 `@deepseek-ai/dsh-client-locale`。

**把预装插件从 Web bundle 拿掉。** 否决：官方 import 能解析之后，它们应继续作为可关闭的目录项。

## Consequences

- 源码树里的 `xfdsh web` 可以从 Web bundle 加载官方社区插件。
- profile 插件安装仍然通过 `.pnpmfile.cjs` 改写官方依赖规格。
