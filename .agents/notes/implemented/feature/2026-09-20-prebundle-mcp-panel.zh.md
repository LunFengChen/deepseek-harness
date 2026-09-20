# Agent Note: prebundle dsh-mcp-panel

Status: implemented

[English](2026-09-20-prebundle-mcp-panel.md) | 中文

## Problem

xfdsh web 已经带 `@x1a0f3n9/dsh-mcp-client`，但没有这些行的 Settings 界面。想增删或试调 MCP 服务器的人只能手改 `cordis.patch.yml`。

## Decision

预装 [LunFengChen/dsh-mcp-panel](https://github.com/LunFengChen/dsh-mcp-panel) 的 `v0.6.16-xfdsh.1`，npm 名为 `@x1a0f3n9/dsh-mcp-panel`。web-app 目录卡片、GitHub pin 和 cordis insert 共用 id `mcp-panel`，`defaultEnabled: true`。这个 fork 写入 `@x1a0f3n9/dsh-mcp-client` 行，同时仍列出 `@deepseek-ai/dsh-mcp-client` 行。pin 策略见 [pin remaining prebundled plugins](2026-09-11-pin-prebundled-plugin-forks.zh.md)；npm 名见 [preset plugin npm scope](2026-09-18-preset-plugin-npm-scope.zh.md)。

## Alternatives considered

**继续让用户用 plugin add 安装上游 `dsh-mcp-panel`。** 否决：所有者要和 skills-manager 同一条预置路径。

**预置 Fishquito7/dsh-skill-mcp-panel。** 否决：它的技能面板会跟已经预置的 Skills manager 重叠。

**预置 duhu2000/dsh-mcp-connector。** 否决：那是连接器目录，不是官方客户端上面的 Settings 控制台。

**把插件 vendoring 进本仓库。** 否决：它已经有自己的仓库和 tag。

## Consequences

- Settings → xfdsh预置插件 出现 MCP 面板；关掉卡片就会卸掉插件。
- 卡片打开时出现 Settings → MCP 和 `/mcp`。
- `pnpm install` 解析这个 pin 之前，GitHub tag 必须已经存在。
- web-app 同时依赖 `@x1a0f3n9/dsh-mcp-client`，这样 Settings → MCP 写入的行才能加载。
- 插件的 `@deepseek-ai/dsh-subprocess`、`@deepseek-ai/dsh-jobs` 和 `@deepseek-ai/dsh-typert-protocol` specifier 在 `pnpm-workspace.yaml` 里用 `link:` 指到对应的 `@x1a0f3n9` 包，锁文件就不会去拉官方副本。
