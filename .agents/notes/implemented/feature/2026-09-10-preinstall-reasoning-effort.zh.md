# Agent Note：预装社区 Web 插件

Status: implemented

[English](2026-09-10-preinstall-reasoning-effort.md) | 中文

## 问题

fork 希望全新的 `xfdsh web` profile 就带几款社区 Web 插件，并且仍能在 Settings → Plugins 关闭：思考强度、上下文面板、侧边栏工作台、Hindsight 长期记忆。只写成手动 `plugin add` 会把它们藏起来。把源码 vendor 进 `packages/` 等于再 fork 一份第三方 UI，没有维护路径。

## 决策

`@x1a0f3n9/dsh-web-app` 依赖已发布的产物，Web patch 挂上各自主机行，bundle 插件目录把每一行标成 `defaultEnabled: true`。

| 插件 | 钉版本 | 为什么钉这个 |
| --- | --- | --- |
| `dsh-reasoning-effort` | GitHub `v0.7.1` | npm `latest` 还是 `0.2.7`；GitHub tag 已经带 `lib/`，也没有 `prepare` 脚本。 |
| `dsh-context` | npm `0.48.0` | 发布包带 `lib/`。Git `main` 会跑 `prepare: husky`。 |
| `dsh-better-sidebar` | npm `0.19.0-alpha.1` | 本仓库是 `0.1.5-alpha.2`。npm `latest` 的 `0.18.1` 对准 0.1.2 线；GitHub `v0.19.0` 需要 `0.1.5-rc.1+`。Git 安装会跑 `prepare: tsdown`。 |
| `@vectorize-io/hindsight-coding-agents` | npm `0.5.2` | DSH 集成在 `hindsight-integrations/coding-agents/`，pnpm 不能把 git 子目录当成依赖。已发布包装了 `./dsh` 和 `dsh.bundle.patch`。 |

pnpm 只 remap 这些插件声明的、且本仓库存在的官方 `@deepseek-ai/dsh-*` peer。缺失的 `@deepseek-ai/dsh-client-runtime` 和可选的 `@huanlin/dsh-plugin-better-locale` 会忽略。remap 名单不是全部官方产品包。

Hindsight 记忆在 dsh 外面配置，文件是 `~/.hindsight/coding-agent.json`。没有服务或 `disabled: true` 时，插件仍会加载，但不会去建 bank。

## 验证

`pnpm install` 能解析这四个包，不会从 npm 拉官方 `@deepseek-ai/dsh-*` 产品包。Web bundle 目录列出 `reasoning-effort`、`dsh-context`、`better-sidebar`、`hindsight`，且 `defaultEnabled: true`。

## 曾考虑的替代方案

**继续只做手动 plugin add，或者 Hindsight 只走插件市场。** 不采用：用户要求和 dshmarket 一样预装这四个。市场仍可用来装别的插件，也可以关掉这些行。

**把插件源码 vendor 进 `packages/`。** 不采用：选定的 pin 已经带编译产物，再抄一份第三方 UI 没有维护路径。

**依赖 GitHub `main` 或未钉的 git ref。** 不采用：`dsh-context` 和 `dsh-better-sidebar` 在 git 安装时会跑 build/`husky` 的 `prepare`。

**给每个 `@deepseek-ai/dsh-*` 包加全局官方到 fork 的 override。** 不采用：只有声明的 peer 需要 remap；250 个包的 override 会把安装错误藏起来。

**钉 better-sidebar `0.19.0`。** 不采用：那个版本的 peer 下限是 `0.1.5-rc.1+`，本仓库还不是。

**在本地重新提供 `dsh-client-runtime`。** 不采用：后继是 `dsh-client-modules`，而且 reasoning-effort 对 `client-runtime` 的导入是 type-only。

## 后果

- 启动 `xfdsh web` 后就有思考强度、上下文面板、better-sidebar 工作台和 Hindsight 工具，不必再 `plugin add`。
- 用户可以在 Settings → Plugins 关闭每一行。
- 新 profile 会加载 Hindsight。xfdsh 默认走本机 daemon；Cloud 仍可选。
- 以后升版本就是改 web-app 上的依赖 pin。
