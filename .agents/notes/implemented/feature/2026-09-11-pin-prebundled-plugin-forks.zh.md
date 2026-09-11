# Agent Note: Pin remaining prebundled plugins to LunFengChen forks

Status: implemented

[English](2026-09-11-pin-prebundled-plugin-forks.md) | 中文

## Problem

xfdsh 会预装社区插件。`dsh-context` 已经来自 `LunFengChen/dsh-context`。其余能从 GitHub 安装的插件还指向上游 npm 或 GitHub，版本探测或依赖修复就得等别人发版。Hindsight 仍走上游：`vectorize-io/hindsight` 是很大的 monorepo，而且现在是默认关闭。

## Decision

把剩下要自己维护的预装钉到 LunFengChen 的 GitHub tag：

- `dshmarket` → `github:LunFengChen/dsh-market#v1.44.0`
- `dsh-reasoning-effort` → `github:LunFengChen/dsh-reasoning-effort#v0.7.1`
- `dsh-better-sidebar` → `github:LunFengChen/DSH-better-sidebar#v0.19.0-alpha.1`

目录里的作者和主页跟着这些 fork。Session timeline 仍在本仓库。Hindsight 仍用上游包，默认关闭。

## Alternatives considered

**市场和 sidebar 继续用 npm。** 否决：fork pin 和 `dsh-context` 是同一条维护路径，npm 仍发的是官方包名。

**把插件 vendoring 进本仓库。** 否决：它们已经有自己的仓库和 tag。

## Consequences

- 插件卡片会链到 LunFengChen 仓库。
- 版本和兼容性修复可以在这些 fork 上落地，不必等上游 npm。
- `xfdsh plugin --profile web add` 安装其他社区插件的方式不变。
