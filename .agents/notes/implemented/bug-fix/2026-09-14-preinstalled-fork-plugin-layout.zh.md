# Agent Note: preinstalled fork-scoped plugins stay outside the workspace release

Status: implemented

[English](2026-09-14-preinstalled-fork-plugin-layout.md) | 中文

## Problem

`verify-npm-install-layout` 把每个 `@x1a0f3n9/dsh-*` 名称都当成必须存在于当前 DSH 版本的工作区发布成员。`@x1a0f3n9/dsh-session-timeline` 是带独立版本的预装 GitHub 插件，所以这个门禁会在 `dev-x1a0f3n9` 打包或发布之前失败。

## Decision

预装插件包名，包括 fork 作用域的 `@x1a0f3n9/dsh-session-timeline`，不是工作区 DSH 包。没有工作区版本的 DSH 名称留在索引里不改。合成的 DSH 发行版不会把这些插件的版本范围改写到工作区版本。

## Alternatives considered

**把 session timeline 搬回这个工作区。** 否决：插件放在 `LunFengChen/dsh-session-timeline`，才能独立定版本和发布。

**不再按 `@x1a0f3n9/dsh-*` 前缀匹配。** 否决：工作区成员仍然用这个前缀，双版本检查需要它们。

**让门禁继续失败，只从本地 pack 发布。** 否决：推送 `dev-x1a0f3n9` 必须能走 CI 发布。

## Consequences

- `pnpm run verify-npm-install-layout` 接受 GitHub 钉死的 session timeline 插件。
- 以后再预装一个 fork 作用域插件时，在它成为工作区成员之前也需要同样的例外。
