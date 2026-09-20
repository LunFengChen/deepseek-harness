# Agent Note: preset plugins from npm

Status: implemented

[English](2026-09-19-preset-plugins-npm.md) | 中文

## Problem

`npm install --global @x1a0f3n9/dsh` 仍通过 `github:LunFengChen/...#tag` 解析八个 xfdsh 预置插件。npm 会 clone 这些仓库并跑 `prepare`，这需要 git 和编译工具链，朋友的机器上会被 SIGKILL。`--ignore-scripts` 跳过了 clone 后的编译，然后 `xfdsh web` 失败，因为 `dshmarket` 和 `dsh-better-sidebar` 把 `lib/` 写进了 gitignore，包里没有编译入口。

## Decision

每个预置插件都按 `packages/bundle/web-app` 里已经 pin 的版本，把带编译产物的 tarball 发到 npm。web-app 清单用这些精确 npm 版本，不再用 `github:`。因此 `npm install --global @x1a0f3n9/dsh` 从 registry 安装插件。`.github/workflows/publish-preset-plugins.yml` 按 tag clone，只在缺少 `lib/index.js` 或 `dist/index.js` 时编译，并用 harness 的 `NPM_TOKEN` 发布。

当前 pin：

- `@x1a0f3n9/dshmarket@1.45.2`
- `@x1a0f3n9/dsh-reasoning-effort@0.7.3`
- `@x1a0f3n9/dsh-session-timeline@0.1.5-xfdsh.2`
- `@x1a0f3n9/dsh-context@0.49.7`
- `@x1a0f3n9/dsh-better-sidebar@0.19.3`
- `@x1a0f3n9/hindsight-coding-agents@0.5.2-xfdsh.4`
- `@x1a0f3n9/dsh-failover-queue@0.1.12`
- `@x1a0f3n9/dsh-skills-manager@0.1.53-xfdsh.1`

`@x1a0f3n9/dsh-web-search-pool` 仍是 workspace 包，跟 harness 家族一起发。catalog 的 `homepage` 仍是 LunFengChen 的 GitHub 地址。

## Alternatives considered

**继续用 `github:` specifier。** 否决：`npm i -g` 仍会 clone 插件仓并跑 `prepare`。

**用 `--ignore-scripts` 安装，并且不把 `lib/` 放进 git。** 否决：market 和 better-sidebar 就没有 `lib/index.js`，`xfdsh web` 加载不了。

**在开发者笔记本上直接 `npm publish`。** 否决：这台机器没有 npm 登录，`@x1a0f3n9` 的 token 在 GitHub Actions secrets 里。

## Consequences

- 朋友用 `npm install --global @x1a0f3n9/dsh` 安装 fork，然后 `xfdsh web`，不用 clone 插件仓库。
- 刷新 harness lockfile 之前，这些 pin 版本必须已经在 npm 上。
- 官方 `@deepseek-ai/dsh` 不变。
