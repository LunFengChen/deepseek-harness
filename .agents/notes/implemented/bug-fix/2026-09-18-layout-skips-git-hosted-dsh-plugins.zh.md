# Agent Note: layout 检查不得改写 git 托管的 dsh 插件

Status: implemented

[English](2026-09-18-layout-skips-git-hosted-dsh-plugins.md) | 中文

## Problem

`verify-npm-install-layout` 会把工作区 `@x1a0f3n9/dsh-*` 包克隆成合成的 `0.1.0` / `0.2.0` 两套发行。git 托管的预置插件也用这个 scope（`@x1a0f3n9/dsh-better-sidebar` 是 `0.19.3`），但不是这个版本的工作区成员。双发行 registry 把这些依赖改写成 `^0.2.0`，npm 以 `ETARGET` 失败，Release 的 publish job 就不会跑。

## Decision

只有当某个 dsh 名在工作区源版本里存在时，才把它的依赖改写到合成版本。其他 `@x1a0f3n9/dsh-*` 和 `@deepseek-ai/dsh-*` 名从合成图里丢掉，与现有的未加 scope 插件跳过名单一致。插件的真实版本留在 index 里。

## Alternatives considered

**把每个 scoped 插件名加进 `PREINSTALLED_PLUGIN_PACKAGES`。** 每多一个 `@x1a0f3n9/dsh-*` git pin，Release 都会坏，直到有人更新名单。按源版本判断能覆盖现在和以后的 pin。

**让 layout job `continue-on-error`。** pack 仍能产出 tarball，但真正的双发行放置 bug 将不再挡住发布。

## Consequences

- git 托管的预置插件不会出现在合成双发行安装里。
- 第一方工作区包（例如 `@x1a0f3n9/dsh-web-search-pool`）仍会克隆到 `0.1.0` / `0.2.0`。
