# Agent Note: extract session timeline into its own repository

Status: implemented

[English](2026-09-12-external-session-timeline-plugin.md) | 中文

## Problem

Session timeline 原来在 harness 工作区里。插件维护和 harness 包混在一起，回退 UI 也没有独立的 GitHub 仓库。

## Decision

`@x1a0f3n9/dsh-session-timeline` 是独立插件，仓库是 [LunFengChen/dsh-session-timeline](https://github.com/LunFengChen/dsh-session-timeline)。包名仍是 `@x1a0f3n9/dsh-session-timeline`。Web bundle 预装 `github:LunFengChen/dsh-session-timeline#v0.1.5-xfdsh.2`，不再包含 `packages/session/session-timeline`。

## Alternatives considered

**把包名改成 `@deepseek-ai/dsh-session-timeline`。** 否决：这个插件属于 fork。改成官方名会盖住作者，也会破坏当前 client module id。

**继续把插件放在 monorepo 里。** 否决：需要单独仓库，这样不用检出 harness 也能维护插件。

**只发 npm 包，不再钉 GitHub tag。** 此次否决：其它预装插件已经在钉 GitHub tag。

## Consequences

- Timeline 的源码和测试在 `LunFengChen/dsh-session-timeline`。
- Settings → Plugins 的卡片会链到这个仓库。
- 工作区的 Client/Host 依赖策略不再列出这个插件。
