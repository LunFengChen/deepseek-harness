# Agent Note: npm publish 不得在内部重试 429

Status: implemented

[English](2026-09-10-npm-publish-fetch-retries.md) | 中文

## Problem

发布 `@x1a0f3n9` 这一族会创建大量新包名。npm 的新包写入额度会返回 `E429`，文案里写 `user undefined`，即使 `npm whoami` 已是真实用户。`npm publish` 还会在一次调用里把这次 429 重试三次，把剩余额度耗在同一个名字上，后面的包全部卡住。随后在 job 里睡眠 45–90 分钟，会让 GitHub Actions 跑数小时却发不出新包，后续重跑也无法跳过已经发布的成员。

## Decision

给 publish 命令加上 `--fetch-retries 0`，一个 tarball 只发一次 PUT。job 级 `E429` 间隔和第一次即失败见 [npm registry 调用必须间隔，第一次 429 即失败](2026-09-11-npm-registry-serial-spacing.zh.md)。之后再跑会跳过 registry 上同 integrity 的已发布成员。

## Verification

`pnpm exec vitest run scripts/release/publish.spec.ts` 覆盖把 `E429` 归类为瞬时 registry 错误码。

## Alternatives considered

**保留 npm 默认的三次 fetch 重试。** 否决：每次 429 仍会计入新包额度。

**在 job 里睡眠 45–90 分钟再继续。** 否决：GitHub Actions job 等不到额度窗口结束，一次跑了三小时的 in-progress 任务没有发出新包，还挡住了重跑。

**第一次 429 立刻失败、完全不重试。** 本笔记否决是因为偶发 429 可能几秒就恢复；后来的证据在 [npm registry 调用必须间隔，第一次 429 即失败](2026-09-11-npm-registry-serial-spacing.zh.md) 里推翻了这次重试。

## Consequences

- 发布 200 多个新名字需要多个额度窗口，每次靠重跑 publish job 启动。
- 同版本已存在的名字仍然只 skip；只有缺失的名字才会碰到 `E429`。
