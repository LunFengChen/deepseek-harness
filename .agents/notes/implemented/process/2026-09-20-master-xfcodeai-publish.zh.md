# Agent Note: 从 master 发布 @xfcodeai/dsh

Status: implemented

[English](2026-09-20-master-xfcodeai-publish.md) | 中文

## Problem

`dev-x1a0f3n9` 已经在发布 `@x1a0f3n9/dsh-*`。稳定 fork 线本应从同一个 GitHub 仓库的 `master` 发布 `@xfcodeai/dsh-*`。把 git 树 rescope 成 `@xfcodeai` 会让每次 master↔dev 合并都打架，而把 tarball 里所有 `@x1a0f3n9/` 一刀切改掉，也会把仍留在 `@x1a0f3n9` 的预置插件一起改名。

## Decision

Git 继续使用 `@x1a0f3n9/dsh-*`。推送 `master` 会打包这棵树，只把 dsh family 的完整包名在 packed tarball 里改写到 `@xfcodeai`，然后从 environment `npm-publish-xfcodeai` 发布。不是 family 成员的预置插件，以及 vendor 的 `@deepseek-ai` 包，都不会被改写。`dev-x1a0f3n9` 仍从 environment `npm-publish` 发布 `@x1a0f3n9/*`。

改写步骤是 `pnpm run release:rewrite-scope --family dsh --from dist/npm --out dist/npm-xfcodeai --to-scope @xfcodeai`。较短的名字例如 `@x1a0f3n9/dsh` 不会改写 `@x1a0f3n9/dsh-session-timeline`。

## Verification

`pnpm exec vitest run scripts/release/rewrite-packed-scope.spec.ts scripts/ci-workflow.spec.ts scripts/release/verify.spec.ts` 钉住完整包名改写和 `publish-xfcodeai` job。

## Alternatives considered

**在 master 上把 git 树 rescope 成 `@xfcodeai`。** 否决：每次 `master` 和 `dev-x1a0f3n9` 合并都会改写几百个包名。

**把 tarball 里每一个 `@x1a0f3n9/` 字符串都替换掉。** 否决：那样会把 `@x1a0f3n9/dsh-session-timeline` 这类预置插件也发成 `@xfcodeai/...`。

**从 `dev-x1a0f3n9` 发布 `@xfcodeai/*`。** 否决：两套 scope 是两条线。开发线留在 `@x1a0f3n9`；稳定线留在 `@xfcodeai`。

## Consequences

- `master` 是稳定 fork 线，不再是干净的上游镜像。上游更新先合进 `master`，再合进 `dev-x1a0f3n9`。
- 朋友用 `npm install --global @xfcodeai/dsh` 安装稳定 CLI。
- `master` 上的 npm 新包名额度暂停，会像 `dev-x1a0f3n9` 暂停 `@x1a0f3n9` 那样，停下剩下的 `@xfcodeai` 名字。
