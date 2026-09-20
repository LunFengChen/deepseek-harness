# Agent Note: Pin remaining prebundled plugins to LunFengChen forks

Status: implemented

[English](2026-09-11-pin-prebundled-plugin-forks.md) | 中文

## Problem

xfdsh 会预装社区插件。`dsh-context` 已经来自 `LunFengChen/dsh-context`。其余能从 GitHub 安装的插件还指向上游 npm 或 GitHub，版本探测或依赖修复就得等别人发版。

## Decision

在 `packages/bundle/web-app/package.json` 把要自己维护的预装钉到 LunFengChen 的 GitHub tag。npm 包名现在走 fork scope，见 [preset plugin npm scope](2026-09-18-preset-plugin-npm-scope.zh.md)：

- `@x1a0f3n9/dshmarket` → `github:LunFengChen/dsh-market#v1.45.2`
- `@x1a0f3n9/dsh-reasoning-effort` → `github:LunFengChen/dsh-reasoning-effort#v0.7.3`
- `@x1a0f3n9/dsh-context` → `github:LunFengChen/dsh-context#v0.49.7`
- `@x1a0f3n9/dsh-better-sidebar` → `github:LunFengChen/DSH-better-sidebar#v0.19.2`
- `@x1a0f3n9/dsh-session-timeline` → `github:LunFengChen/dsh-session-timeline#v0.1.5-xfdsh.2`
- `@x1a0f3n9/hindsight-coding-agents` → `github:LunFengChen/hindsight-coding-agents#v0.5.2-xfdsh.4`
- `@x1a0f3n9/dsh-failover-queue` → `github:LunFengChen/dsh-failover-queue#v0.1.11`
- `@x1a0f3n9/dsh-skills-manager` → `github:LunFengChen/dsh-skills-manager#v0.1.53-xfdsh.1`
- `@x1a0f3n9/dsh-mcp-panel` → `github:LunFengChen/dsh-mcp-panel#v0.6.16-xfdsh.1`

目录里的作者和主页跟着这些 fork。cordis loader 的 `name` 与 scoped npm 包名一致。

## Alternatives considered

**市场和 sidebar 继续用 npm。** 否决：fork pin 和 `dsh-context` 是同一条维护路径，npm 仍发的是官方包名。

**把插件 vendoring 进本仓库。** 否决：它们已经有自己的仓库和 tag。

## Consequences

- 插件卡片会链到 LunFengChen 仓库。
- 版本和兼容性修复可以在这些 fork 上落地，不必等上游 npm。
- `xfdsh plugin --profile web add` 安装其他社区插件的方式不变。
