# Agent Note: source builds without a git checkout

Status: implemented

[English](2026-09-12-source-build-without-git.md) | 中文

## Problem

`pnpm run build` 用 `execFileSync` 读 `git rev-parse HEAD`，再写进 `DSH_CLIENT_COMMIT_HASH`。zip 或拷贝出来的目录没有 `.git` 时，Git 以 128 退出，这个 throw 会在写出任何 client bundle 之前打断 `scripts/build.ts`。

## Decision

`repositoryCommitHash` 改用 `spawnSync` 探测 Git，和 `repositoryGitDirty` 一样。显式的 `DSH_CLIENT_COMMIT_HASH` 仍然优先，并且仍然拒绝不是 7–40 位十六进制的值。变量未设置且没有 Git 元数据时，hash 取 SHA-256(`package.json` 版本号) 的前 7 个十六进制字符。脏工作区标记仍然省略。

## Alternatives considered

**非 git 目录一律要求 `DSH_CLIENT_COMMIT_HASH`。** 否决：朋友拿到的 `dev-x1a0f3n9` zip 应该能直接 `pnpm run build`，不必再设环境变量。

**把 `unknown` 或版本号写进 commit 字段。** 否决：client 产物已经按 `/^[0-9a-f]{7,40}$/i` 校验。

**继续 throw，让用户必须用 git clone。** 否决：缺的是元数据来源，不是产品树坏了。

## Consequences

- 没有 `.git` 的源码树也能完成 client 构建。
- 非法的显式 `DSH_CLIENT_COMMIT_HASH` 仍然会让构建失败。
- 同一 package 版本的 zip 产物会共用同一个合成 hash。
