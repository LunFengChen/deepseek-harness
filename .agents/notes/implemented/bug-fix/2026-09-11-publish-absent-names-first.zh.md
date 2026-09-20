# Agent Note: 先发布尚未存在的包名，再处理已有版本

Status: implemented

[English](2026-09-11-publish-absent-names-first.md) | 中文

## Problem

家族发布按依赖顺序走成员，并在途中对照 registry 决定每一个。npm 的新包名写入额度大约每个窗口五十个新*名字*。已经存在的名字，包括打包字节不同的那些，排在这个顺序更前面。带 tag 的字节不一致会在第一个这样的名字上失败，到不了未发布成员。先升版本把已有名字再发一遍，会在缺失名字之前花掉同一窗口。

## Decision

先探测每个打好的成员，再分两轮发布。第一轮按原顺序发布每个 `absent` 名字。第二轮再跳过相同 tarball，带 tag 的字节不一致失败，分支发布的字节不一致跳过。`existingPublishedVersionAction` 不变。已经存在的名字要发新*版本*，仍须等缺失名字都有了再做一次家族 bump。

## Verification

`pnpm exec vitest run scripts/release/publish.spec.ts` 断言 `partitionPublishPasses` 在先于已有成员的 absent 轮次里保持原顺序。

## Alternatives considered

**遇到已有版本字节不一致立刻失败。** 否决：第一个过期名字排在未发布剩余成员前面，会停掉这次 job。

**先 bump 家族版本，让每个成员都变成 absent。** 否决：前五十次 PUT 会变成已有名字的新版本，后面的成员声明的也是同一版本。

**探测一返回 absent 就立刻发布。** 否决：几百次 1 秒探测比再开一条控制路径便宜，额度窗口是按小时计的。

## Consequences

- 缺失名字在考虑已有名字之前使用新包名额度。
- 带 tag 的字节不一致仍会失败，但只在未发布成员都尝试过之后。
- 分支发布仍然不能替换已发布版本；内容变化要等名字都有了再 bump。
- 探测整个家族在第一次 PUT 前大约每个成员等 1 秒。

## Related

[npm registry 调用必须间隔，第一次 429 即失败](2026-09-11-npm-registry-serial-spacing.zh.md) 仍然负责探测和 PUT 间隔。
[npm 发布序列](../process/2026-08-10-npm-release-sequences.zh.md) 仍然负责家族版本。
