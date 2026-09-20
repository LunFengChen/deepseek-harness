# Agent Note: npm publish always passes --tag

Status: implemented

[English](2026-09-20-npm-publish-prerelease-tag.md) | 中文

## Problem

npm CLI 拒绝不带 `--tag` 的预发布 `npm publish`。`0.1.5-rc.5` 是预发布。`DshFamily.distTagForVersion` 对 `rc` 返回 undefined，好让该版本占用 `latest`。`publish.ts` 在这种情况下省略了 `--tag`。`dev-x1a0f3n9`（`@x1a0f3n9`）和 `master`（`@xfcodeai`）的 Release job 都在第一个 tarball 上失败：`You must specify a tag using --tag when publishing a prerelease version.`

## Decision

`npmPublishTagArgs` 总会发出 `--tag`。家族没给通道时用 `latest`。具名通道（`alpha`、`canary`、vendor 的 `next`）保持显式。家族映射不变。

## Verification

`pnpm exec vitest run scripts/release/publish.spec.ts` 断言 `npmPublishTagArgs(undefined) === ['--tag', 'latest']`，具名通道保持显式。

## Alternatives considered

**让 `DshFamily.distTagForVersion` 对 `rc` 返回 `'latest'`。** 否决：家族返回 undefined 已经表示 latest 通道；必须传 `--tag` 的是 npm CLI 适配层。

**再把 `rc` 发到 `next`，以便带上 `--tag next`。** 否决：[dsh 的 rc 版本占用 latest](../process/2026-09-19-dsh-rc-latest-dist-tag.zh.md) 负责面向朋友的不带 tag 安装。

## Consequences

- 之后的 `rc` 发布会更新 `latest`。
- 稳定版本也会传 `--tag latest`，这和 npm 以前省略 `--tag` 的默认值一致。

## Related

[dsh 的 rc 版本占用 latest](../process/2026-09-19-dsh-rc-latest-dist-tag.zh.md) 仍然负责 `rc` 占用哪条通道。
