# Agent Note: Hindsight stays cataloged but off by default

Status: implemented

[English](2026-09-11-hindsight-opt-in.md) | 中文

## Problem

web-app 预装会在第一次启动就加载 `@vectorize-io/hindsight-coding-agents`。这个插件通过 `~/.hindsight/coding-agent.json` 连接 Hindsight Cloud 或本地服务。没有账号的用户会看到自己没打开的功能在要云端 key。去 fork `vectorize-io/hindsight` 不划算：那是一个很大的 monorepo，coding-agent 只是其中一块集成。

## Decision

包仍留在 web-app 目录和 patch insert 里，用户可以在 Settings → Plugins 打开。发货行设 `defaultEnabled: false` 和 `disabled: true`。不 fork Hindsight monorepo。

## Alternatives considered

**Fork `vectorize-io/hindsight` 并去掉云端 key。** 否决：仓库比这个集成大得多，本地记忆仍然需要 Hindsight 服务。

**去掉预装。** 否决：已经在用 Hindsight 的人仍然需要目录和一键启用。

## Consequences

- 第一次启动不再加载 Hindsight，也不会要云端 key。
- 已有 profile 的 `pluginOverrides.hindsight: true` 仍会盖过发货的 disabled 行。
- 用户配好 `~/.hindsight/coding-agent.json` 后，再在 Settings → Plugins 打开。
