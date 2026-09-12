# Agent Note: Hindsight git probes keep stderr

Status: implemented

[English](2026-09-12-hindsight-quiet-git-stderr.md) | 中文

## Problem

`xfdsh web` 在默认浏览器打开后会加载上一个会话。Hindsight 随后用 `execFileSync` 跑 `git -C <session-cwd> rev-list` / `rev-parse`，stderr 继承到终端。会话工作区不是 git 仓库时（例如普通项目目录），每次探测都会打印 `fatal: not a git repository (or any of the parent directories): .git`。启动器并不要求当前目录是 git 仓库。

## Decision

预装包仍是 `@vectorize-io/hindsight-coding-agents@0.5.2`。不 fork Hindsight monorepo。对该包做 pnpm patch，给 `dist/dsh.js` 里三处 `git` `execFileSync` 加上 `stdio: ["ignore", "pipe", "pipe"]`。git 非 0 退出仍会 throw，并由原来的 `try/catch` 吃掉；去掉的只是打到终端的那一行。

## Alternatives considered

**Fork `vectorize-io/hindsight` 改 git helper。** 否决：这个 monorepo 远大于这次 stderr 泄漏，而且 [Hindsight stays cataloged but off by default](2026-09-11-hindsight-opt-in.zh.md) 已经拒绝过这次 fork。

**在 xfdsh bin 里 monkey-patch `node:child_process.execFileSync`。** 否决：ESM export 只读，插件里的 named `import { execFileSync }` 也看不到改过的 default export。

**要求必须从 git 仓库启动。** 否决：会话 cwd 是用户的项目目录，可以不是 git checkout。

## Consequences

- `xfdsh web` 打开非 git 会话工作区时不再打印 git fatal。
- `@vectorize-io/hindsight-coding-agents` 升过 `0.5.2` 时必须重做 `patches/@vectorize-io__hindsight-coding-agents@0.5.2.patch`。
- 没有 git 历史时，Hindsight 仍然跳过 memory seeding。
