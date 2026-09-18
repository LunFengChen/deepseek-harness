# Agent Note: fork Hindsight coding agents

Status: implemented

[English](2026-09-12-fork-hindsight-coding-agents.md) | 中文

## Problem

xfdsh 之前预装 npm 上的 `@vectorize-io/hindsight-coding-agents@0.5.2`，再用本地 pnpm patch 处理 git stderr。fork 没有自己的 GitHub 源码，上游合并后这份 patch 也不再出现在 `pnpm-workspace.yaml` 里。

## Decision

Hindsight 预装来自 [LunFengChen/hindsight-coding-agents](https://github.com/LunFengChen/hindsight-coding-agents) 的 `v0.5.2-xfdsh.4`。目录里的作者和主页是 LunFengChen。npm 包名是 `@x1a0f3n9/hindsight-coding-agents`，loader 行是 `@x1a0f3n9/hindsight-coding-agents/dsh`。git stderr 的 pipe 已经打进这个 fork。不再使用的 pnpm patch 文件已删除。后来的 scope 改名见 [preset plugin npm scope](2026-09-18-preset-plugin-npm-scope.zh.md)。

## Alternatives considered

**继续用 npm 包加 pnpm patch。** 否决：需要可维护的 GitHub fork，而且 patch 已经不在 `patchedDependencies` 里。

**把 npm 包名改成 fork scope。** 此次否决：dsh 条目是 `@vectorize-io/hindsight-coding-agents/dsh`。改名还得同步改 loader，对用户没有额外好处。

## Consequences

- Settings → Plugins 会把 Hindsight 链到 `LunFengChen/hindsight-coding-agents`。
- 工作区不是 git 仓库时，不再打印 `fatal: not a git repository`。
- xfdsh 仍然默认用本机 Hindsight daemon。
