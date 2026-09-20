# Agent Note: npm registry 调用必须间隔，第一次 429 即失败

Status: implemented

[English](2026-09-11-npm-registry-serial-spacing.md) | 中文

## Problem

发布大量新包名时，每个成员先 `npm view`，再对第一个缺失的名字发 PUT。skip 路径上这些探测没有间隔，紧接着第一次 PUT，再 2 秒后重试一次 `E429` PUT。这次重试同样 429，job 在一个名字上失败，只能靠后续重跑继续。

## Decision

用同一个时间戳间隔 registry 调用：每次 `npm view` 前等 1 秒，每次 `npm publish` PUT 前等 5 秒，包括 skip 探测之后的第一次 PUT。不重试 `E429`。保留 `--fetch-retries 0`，也保留 pack `--concurrency 8` —— pack 是本地磁盘工作。

## Verification

`pnpm exec vitest run scripts/release/publish.spec.ts` 断言 `REGISTRY_PROBE_SPACING_MS === 1000` 且 `RATE_LIMIT_ATTEMPTS === 1`。

## Alternatives considered

**保留 2 秒的 job 级 `E429` 重试。** 否决：重试 PUT 打在同一额度上。

**第一次 429 失败但不间隔探测。** 否决：skip 路径的 GET 突发仍会耗掉第一次 PUT 需要的额度。

**把 pack 改成 `--concurrency 1`。** 否决：pack 不访问 registry；八个 worker 大约九分钟打完包，串行 pack 大约要一小时。

**在 job 里睡到额度窗口重置。** 已在 [npm publish 不得在内部重试 429](2026-09-10-npm-publish-fetch-retries.zh.md) 否决。

## Consequences

- 纯 skip 的一次运行大约每个成员等 1 秒。
- 发布在每次 PUT 前至少等 5 秒。
- 第一次 `E429` 停掉这一轮后续 PUT。[分支发布遇到 npm 新包名额度时暂停](../process/2026-09-11-branch-publish-quota-pause.zh.md) 负责这次退出是不是 0。

## Related

[npm publish 不得在内部重试 429](2026-09-10-npm-publish-fetch-retries.zh.md) 仍然负责 `--fetch-retries 0`。
[分支发布遇到 npm 新包名额度时暂停](../process/2026-09-11-branch-publish-quota-pause.zh.md) 负责分支和带 tag 的退出。
