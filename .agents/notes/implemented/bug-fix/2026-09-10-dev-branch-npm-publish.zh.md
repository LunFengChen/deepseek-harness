# Agent Note: 从 dev-x1a0f3n9 发布 @x1a0f3n9/dsh

Status: implemented

[English](2026-09-10-dev-branch-npm-publish.md) | 中文

## Problem

推送 `dev-x1a0f3n9` 本应发布 `@x1a0f3n9/dsh`。工作流已经为该分支设置了 `RELEASE_PUBLISH` 和 `RELEASE_PUBLISH_ALLOW_REF`，但 `release:verify` 仍要求 `xfdsh-v*` 标签，而且 family 发现逻辑仍会拒绝每一个 `@x1a0f3n9/*` 包。

## Decision

保留已审阅的 `xfdsh-v*` 标签发布作为回退路径。对 `dev-x1a0f3n9`，承认 `RELEASE_PUBLISH_ALLOW_REF`，并在 `@x1a0f3n9` 下发现 dsh family 成员。vendor 包仍使用 `@deepseek-ai`。此分支不发布 `@xfcodeai/*`。

## Verification

单测覆盖 family 发现、标签名、分支 allow-ref，以及 release 工作流接线。本地证据是 `pnpm exec vitest run scripts/release/families.spec.ts scripts/release/verify.spec.ts scripts/ci-workflow.spec.ts`。

## Alternatives considered

**只从 `xfdsh-v*` 标签发布。** 否决：用户要求推送 `dev-x1a0f3n9` 就发布 `@x1a0f3n9/*`，不必等待标签。

**让 family 发现继续只接受 `@deepseek-ai`。** 否决：开发包已经是 `@x1a0f3n9/dsh-*`，pack 会在写出 tarball 之前失败。

## Consequences

- `dev-x1a0f3n9` 发布 `@x1a0f3n9/*`，不发布 `@xfcodeai/*`。
- `master` 在 packed tarball 上做完整包名改写后发布 `@xfcodeai/*`（[从 master 发布 xfcodeai](../process/2026-09-20-master-xfcodeai-publish.zh.md)）。
