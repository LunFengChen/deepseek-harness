# Agent Note: preset plugin npm scope

Status: implemented

[English](2026-09-18-preset-plugin-npm-scope.md) | 中文

## Problem

fork 出来的 xfdsh 预装包仍在用上游 npm 名：`dshmarket`、`dsh-reasoning-effort`、`dsh-context`、`dsh-better-sidebar` 和 `@vectorize-io/hindsight-coding-agents`。设置卡片因此显示未加 scope 或上游 scope 的副标题，即使 GitHub pin 已经是 LunFengChen fork，这些包也无法在 fork scope 下发版和维护。

## Decision

每个 fork 预装都发布为 `@x1a0f3n9/<name>`。catalog 的 `packageName`、web-app 依赖键和 cordis loader 的 `name` 都用这个 npm 名。客户端 `__ModuleLoader__` id 跟随包名。settings 命名空间和 Cordis `export const name` 仍用原来的短 id，这样已有用户设置不会丢。catalog 的 `homepage` 仍是 LunFengChen 的 GitHub 地址；包名副标题就是这个链接。

当前 pin：

- `@x1a0f3n9/dsh-reasoning-effort` → `github:LunFengChen/dsh-reasoning-effort#v0.7.3`
- `@x1a0f3n9/dsh-context` → `github:LunFengChen/dsh-context#v0.49.7`
- `@x1a0f3n9/dsh-better-sidebar` → `github:LunFengChen/DSH-better-sidebar#v0.19.2`
- `@x1a0f3n9/dshmarket` → `github:LunFengChen/dsh-market#v1.45.2`
- `@x1a0f3n9/hindsight-coding-agents` → `github:LunFengChen/hindsight-coding-agents#v0.5.2-xfdsh.4`，loader `@x1a0f3n9/hindsight-coding-agents/dsh`

这推翻了 [fork Hindsight coding agents](2026-09-12-fork-hindsight-coding-agents.zh.md) 里“保留上游 npm 名”，以及 [pin remaining prebundled plugins](2026-09-11-pin-prebundled-plugin-forks.zh.md) 里“cordis 行保持 `dshmarket`”。

## Alternatives considered

**在 xfdsh UI 里映射显示名。** 否决：卡片副标题就是 catalog 的 `packageName`。显示别名会藏起真实安装名，包仍然没法维护。

**只 fork GitHub，npm 名继续用上游的。** 否决：所有者发不了这些名字，卡片看起来仍像官方包。

**把内部 settings 命名空间也改成 scoped id。** 否决：已有的 composer、context、sidebar 设置会丢。

## Consequences

- Settings → xfdsh预置插件 显示 `@x1a0f3n9/...`，点进去打开 LunFengChen 的 GitHub pin。
- `pnpm install` 解析这些 pin 之前，GitHub tag 必须已经存在。
- 官方 `@deepseek-ai/dsh` 不变。
