# Agent Note: Hindsight stays cataloged but off by default

Status: implemented

[English](2026-09-11-hindsight-opt-in.md) | 中文

## Problem

web-app 预装会在第一次启动就加载 `@vectorize-io/hindsight-coding-agents`。这个插件通过 `~/.hindsight/coding-agent.json` 连接 Hindsight Cloud 或本地服务。没有账号的用户会看到自己没打开的功能在要云端 key。去 fork `vectorize-io/hindsight` 不划算：那是一个很大的 monorepo，coding-agent 只是其中一块集成。

## Decision

包仍留在 web-app 目录和 patch insert 里。不 fork Hindsight monorepo。发货的开关默认值见 [xfdsh enables Hindsight by default](../feature/2026-09-12-hindsight-enabled-by-default.zh.md)。

## Alternatives considered

**Fork `vectorize-io/hindsight` 并去掉云端 key。** 否决：仓库比这个集成大得多，本地记忆仍然需要 Hindsight 服务。

**去掉预装。** 否决：已经在用 Hindsight 的人仍然需要目录和一键启用。

## Consequences

- xfdsh 不 fork `vectorize-io/hindsight`。
- 不需要 Cloud，因为 [xfdsh defaults Hindsight to a local daemon](../feature/2026-09-12-hindsight-local-daemon-default.zh.md)。
- 已有 profile 的 `pluginOverrides.hindsight` 仍会盖过发货行。
