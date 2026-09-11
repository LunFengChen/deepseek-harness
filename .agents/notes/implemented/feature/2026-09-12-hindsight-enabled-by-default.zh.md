# Agent Note: xfdsh enables Hindsight by default

Status: implemented

[English](2026-09-12-hindsight-enabled-by-default.md) | 中文

## Problem

xfdsh 把 Hindsight 默认改成本机 daemon 之后，预装行仍是 `disabled: true`。用户还得去 Settings → Plugins 打开，才能用 fork 已经选好的本地记忆。这和「默认本地」不一致。

## Decision

web-app 目录把 `hindsight` 标成 `defaultEnabled: true`，patch insert 不再写 `disabled: true`。目的地仍是 [xfdsh defaults Hindsight to a local daemon](2026-09-12-hindsight-local-daemon-default.zh.md) 的本机 daemon。用户仍可在 Settings → Plugins 关闭。xfdsh 不把插件的 embed 启动器换成 Docker、pip 或内置服务。

## Alternatives considered

**继续默认关，直到用户在 Settings 点开。** 否决：fork 已经选了本地记忆；再关掉就把这件事藏起来了。

**默认改用 Docker 镜像 `ghcr.io/vectorize-io/hindsight`，不用插件自己的本机 embed。** 否决：那是更重的额外进程和镜像拉取。coding-agent 包在 daemon 模式里已经会启动 `hindsight-embed`。

**Fork coding-agents 包，去掉它的 embed 启动器。** 否决：monorepo 仍然比这块集成大得多，本地记忆还是需要那个 embed。

## Consequences

- 全新的 `xfdsh web` profile 会加载 Hindsight，不需要 Cloud 账号。
- profile 里的 `pluginOverrides.hindsight: false` 仍然生效。
- 本机 embed 起不来时，这一轮没有记忆，而不是去打 Cloud。
