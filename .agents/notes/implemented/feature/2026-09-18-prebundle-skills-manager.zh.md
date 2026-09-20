# Agent Note: prebundle dsh-skills-manager

Status: implemented

[English](2026-09-18-prebundle-skills-manager.md) | 中文

## Problem

xfdsh web 没有预装 Skills manager。想用本机 Agent 技能界面的人得自己 `xfdsh plugin --profile web add`，而上游包仍发布为 `@michengai/dsh-skills-manager`，peer 还是 `@deepseek-ai/dsh-*`。

## Decision

预装 [LunFengChen/dsh-skills-manager](https://github.com/LunFengChen/dsh-skills-manager) 的 `v0.1.53-xfdsh.1`，npm 名为 `@x1a0f3n9/dsh-skills-manager`。web-app 目录卡片、依赖 pin 和 cordis insert 共用 id `skills-manager`，`defaultEnabled: true`。这个 fork 把上游 `0.1.53`（恢复 Project 标签页）接到已有的 `@x1a0f3n9` xfdsh 适配上。pin 策略见 [pin remaining prebundled plugins](2026-09-11-pin-prebundled-plugin-forks.zh.md)；npm 名见 [preset plugin npm scope](2026-09-18-preset-plugin-npm-scope.zh.md)。

## Alternatives considered

**继续让用户用 plugin add 安装 `@michengai/dsh-skills-manager`。** 否决：所有者要和市场、timeline、Hindsight 同一条预置路径。

**把插件 vendoring 进本仓库。** 否决：它已经有自己的仓库和 tag。

**继续钉旧的 `v0.1.50-xfdsh.4`，不 rebase。** 否决：上游 `0.1.53` 会在不再暴露 current-session 字段的宿主上恢复 Project 标签页。

## Consequences

- Settings → xfdsh预置插件 出现技能管理；关掉卡片就会卸掉插件。
- 卡片打开时出现 Settings → 技能。
- `pnpm install` 解析这个 pin 之前，GitHub tag 必须已经存在。
- 插件的 `@deepseek-ai/dsh-skill` 和 `@deepseek-ai/dsh-web-app` peer 加入 `pnpm-workspace.yaml` 的 workspace override，锁文件就不会去拉官方副本。
