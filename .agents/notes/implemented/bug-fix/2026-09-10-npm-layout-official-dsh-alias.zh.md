# Agent Note: 在 npm 布局仓库里给官方 dsh 包名做别名

Status: implemented

[English](2026-09-10-npm-layout-official-dsh-alias.md) | 中文

## Problem

`verify-npm-install-layout` 的本地仓库只提供 `@x1a0f3n9/dsh*`。预装社区插件仍声明 `@deepseek-ai/dsh*` 依赖，npm 会 404，Release 的 publish job 不会启动。

## Decision

`buildDualDshRegistry` 把每个 fork dsh 包按相同的合成版本复制到对应的 `@deepseek-ai/dsh*` 名称下，改写这些包上的官方 dsh range，并从合成 dsh 树里去掉预装社区插件。布局断言仍然只统计 fork 名称。

## Alternatives considered

**把社区插件留在合成树里，并把它们的 range 改成 `*`：** 否决，因为 npm 会嵌套混进 0.1.0 副本，并把 React 装进只含 DSH 的 consumer。

**官方名不进仓库，并在这条分支跳过布局 job：** 否决，因为 publish `needs` 这个 job。

## Consequences

布局演练不再安装插件市场里的预装插件。用户对已发布 tarball 做 `npm install` 时仍可以装。fork 里没有的包，对应官方名仍然会 404。
