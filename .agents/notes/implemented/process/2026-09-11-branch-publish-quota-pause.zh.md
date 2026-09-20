# Agent Note: 分支发布遇到 npm 新包名额度时暂停

Status: implemented

[English](2026-09-11-branch-publish-quota-pause.md) | 中文

## Problem

第一次发布整个家族时，npm 新包名写入额度会在几十个名字之后打满。同一 job 里重试还是这个窗口。用 GitHub Actions 定时去滴灌剩下的包，等于把 CI 当成发布守护进程，还把预期中的停下画成失败检查。

## Decision

不重试 `E429`。带 tag 的发布仍然让 job 失败。分支 allow-ref 发布会停掉后续 PUT，打出暂停日志，走完 skip 轮次，然后以 0 退出。下次真正的 push 会再探测并发布剩下的缺失名字。不为这件事给 GitHub Actions 加定时。

## Verification

`pnpm exec vitest run scripts/release/publish.spec.ts` 断言 `rateLimitedPublishAction('') === 'fail'`，非空 allow-ref 则暂停。

## Alternatives considered

**给 Release workflow 加每天两次 cron。** 已在 [开发线 npm 发布在新包名 429 后定时重试](../../rejected/process/2026-09-11-schedule-dev-npm-publish.zh.md) 否决：CI 不是滴灌队列。

**分支 job 在 `E429` 上失败，等人重跑。** 否决：下一次开发 push 本来就会再进发布，红掉的检查不是额度停下该有的信号。

**带 tag 的 `E429` 也以 0 退出。** 否决：一个没发完的 tag 版本就是一次失败的 release。

## Consequences

- 开发分支的 Release 在 npm 额度用尽时保持绿。
- 剩下的名字等下一次 push，而不是等定时器。
- 带 tag 的发布仍在第一次 `E429` 失败。

## Related

[npm registry 调用必须间隔，第一次 429 即失败](../bug-fix/2026-09-11-npm-registry-serial-spacing.zh.md) 仍然负责探测和 PUT 间隔，以及不重试。
