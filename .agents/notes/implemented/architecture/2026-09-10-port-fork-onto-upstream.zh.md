# Agent Note: 把 xfdsh 移植到上游 master

Status: implemented

[English](2026-09-10-port-fork-onto-upstream.md) | 中文

## Problem

fork 的 `master` 混进了上游提交和 xfdsh 提交。把那套历史 rebase 到当前上游会带回过期文件，并产生大量类型错误。用户仍需要 fork 功能，但 `master` 必须保持纯上游镜像。

## Decision

把 `master` 重置为 `upstream/master`。在功能分支上用改 scope 加 keep 文件的方式移植 fork 行为，再 `--no-ff` 合进 `dev-x1a0f3n9`。不要把旧的 80 个 fork 提交重放到新 master 上。

产品规则不变：`xfdsh` 的插件/profile 用 `~/.xfdsh`，历史用 `DSH_SESSION_HOME=~/.dsh`，端口 `7777`。官方插件保留原 import 名，解析到 `@x1a0f3n9/dsh-*`。删除/回退/重新生成仍由 `dsh-session-timeline` 提供。预装的 timeline 和 `dshmarket` 写入 catalog，可在设置里关闭。已经处于 `danger-full-access` 的过期升权请求视为已满足。

## Verification

`master` 对齐 `upstream/master` 的 `dsh-v0.1.5-alpha.2`。功能只在 `features/port-fork-onto-upstream`，只合进 `dev-x1a0f3n9`。单测覆盖 fork 默认值、session home、standing-mode 升权，以及官方/fork 客户端模块别名。`node --import tsx/esm apps/cli/src/bin.ts web --no-open` 听在 `http://127.0.0.1:7777`，下发了 `@x1a0f3n9/dsh-client-modules`、`dsh-session-timeline` 和 `dshmarket` 的 client 模块，且没有改 `~/.dsh/profiles` 的 mtime。

## Alternatives considered

**把旧 fork 提交栈 rebase 到新 master。** 否决：共同祖先落后太多，重放会恢复上游已删文件。

**把 fork 提交留在 master。** 否决：用户要求 master 跟踪上游，fork 工作走 `dev-x1a0f3n9`。

## Consequences

- 新的 fork 工作仍走 `features/*` 或 `fix/*`，再 `--no-ff` 合进 `dev-x1a0f3n9`。
- 官方插件客户端 inject 里的 `@x1a0f3n9/dsh-*` 会解析到 fork 模块表。
- `dshmarket` 仍是可关闭的预装 web-app catalog 项。
