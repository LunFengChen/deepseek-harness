# Agent Note: 开发线 npm 发布在新包名 429 后定时重试

Status: rejected — GitHub Actions is not a drip queue for npm new-name quota

[English](2026-09-11-schedule-dev-npm-publish.md) | 中文

## Problem

发布一大批新包名时，第一次 npm `E429` 就会停。这个停下是对的：同一个窗口不会再收下更多名字。给 Release workflow 加每天两次的 cron，可以没人看着继续发，同时也会反复打包，并把预期中的额度停下画成 CI 失败。

## Proposal

给开发线的 `Release (dsh)` workflow 加上 `schedule: '17 2,14 * * *'`。第一次 `E429` 仍然让 job 失败。靠 GitHub 默认分支上的 cron 继续发剩下的缺失名字。

## Alternatives considered

**在 job 里睡到额度窗口重置。** 否决：GitHub Actions 不会把 runner 占几个小时。

**在发布脚本里重试 `E429`。** 否决：重试 PUT 打的还是同一额度。

**开发线分支发布遇到 `E429` 以 0 退出，下次真正的 push 再继续。** 改为采用：CI 不是发布守护进程，后面的开发 push 本来就会再进发布。

## Acceptance criteria

- 开发线 Release workflow 每天跑两次，不需要再推。
- 发布仍然 gated 在开发 ref。
- 第一次 `E429` 仍让那一次运行失败。
