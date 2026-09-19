# Agent Note: prebundled plugins show version and count as installed

Status: implemented

[English](2026-09-17-prebundled-catalog-version-and-market.md) | 中文

## Problem

xfdsh 把社区插件打进 `@x1a0f3n9/dsh-web-app`。设置 → 插件列出它们时没有版本号。dshmarket 的 `/installed` 只读 profile 的 `dependencies`，这些嵌套的 GitHub 包对不上 Discover 卡片，也不会显示为已安装。

## Decision

`pluginInventory/list` 在 bundle 层能解析到该包时，把 `package.json` 的 `version` 投到目录行上。可选插件卡片把这个版本显示在包名旁边。

`@x1a0f3n9/dshmarket` `v1.45.2` 从当前选中的 profile bundle 读取 `dsh.bundle.plugins`，作为 `prebundled` 返回，并把这些名字（含去 scope 的别名）当作仅用于匹配的在场记录。bundle 的 `package.json` 通过 Node 模块解析从 profile `package.json` 和宿主 CLI 入口读取，因为源码启动时 Web bundle 经常 hoist 到 `profile/node_modules` 外面。profile 的 `dependencies` 仍是变更的真相来源：已安装页可以列出预装包，但不能提供卸载或更新。Web bundle 钉的是 `github:LunFengChen/dsh-market#v1.45.2`（`@x1a0f3n9/dshmarket`）。故障转移队列同样走目录，钉 `github:LunFengChen/dsh-failover-queue#v0.1.9`。

## Alternatives considered

**把嵌套插件写进 profile `package.json`，让市场沿用现有已安装表。** 否决：那会把 bundle 所有权抄进 profile，卸载会删掉宿主自带的插件。

**把预装名字合并进现有 `installed` 表。** 否决：卸载和更新改的是 profile 依赖；合并后会把宿主自带插件当成用户装的。

**版本号只在 dshmarket 里显示。** 否决：设置里的插件列表已经是每张预装卡片的所在。

## Consequences

- bundle 层有这个包时，可选插件卡片显示 `v{version}`。
- 即使登记处 URL 是官方仓库，Discover 也会把 LunFengChen fork 预装标成已安装。
- 不是 profile 自己加的包，卸载入口保持关闭。
- 故障转移队列从 Web bundle 加载，不是手动往 `~/.xfdsh` profile 里加。
- Web 搜索池作为第一方 workspace 预置，走同一份目录。
