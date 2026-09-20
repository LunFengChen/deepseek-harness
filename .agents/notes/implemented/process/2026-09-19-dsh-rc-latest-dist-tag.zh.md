# Agent Note: dsh 的 rc 版本占用 latest

Status: implemented

[English](2026-09-19-dsh-rc-latest-dist-tag.md) | 中文

## Problem

这个 fork 给朋友的安装方式是 `npm install --global @x1a0f3n9/dsh`。`DshFamily.distTagForVersion` 把每个 `rc` 都映射到 npm 的 `next`，所以不带 tag 的命令会把 `latest` 解析到更旧的 pin（`0.1.5-rc.2`），而 `0.1.5-rc.4` 停在 `next` 上。朋友不该再写 `@next`。

## Decision

`DshFamily` 把 `alpha` 和 `canary` 映射到同名 tag，`rc`、其他预发布版本和稳定版本都返回 undefined。`publish.ts` 总会传入 `--tag`；家族返回 undefined 时用 `latest`，因为 npm 拒绝不带 `--tag` 的预发布。vendor 发布的预发布版本仍走 `next`。

`pnpm run release:dist-tag --family dsh` 在不打包的情况下，把 `latest` 指到每个成员已经发布的版本。`.github/workflows/release-dist-tag.yml` 是挂在 `npm-publish` 上的 `workflow_dispatch` job，用来跑这条命令。重复跑是幂等的：tag 已经指向该版本时会跳过。

## Verification

`pnpm exec vitest run scripts/release/families.spec.ts scripts/release/dist-tag.spec.ts scripts/release/publish.spec.ts scripts/ci-workflow.spec.ts` 覆盖映射、skip/add 判断、`--tag latest` argv，以及 dispatch workflow。

## Alternatives considered

**文档写成 `@x1a0f3n9/dsh@next`，让 `latest` 停在更旧的 rc。** 否决：朋友真正会敲的安装命令是不带 tag 的包名。

**只为了重新占上 `latest` 就 bump 到 `0.1.5-rc.5`。** 否决：tarball 已经是 `0.1.5-rc.4`；该改的是 registry 上的 dist-tag。

**只给 `@x1a0f3n9/dsh` 移动 `latest`。** 否决：依赖版本并不靠 dist-tag，但这个家族不该对外展示两条当前通道。

## Consequences

- `npm install --global @x1a0f3n9/dsh` 和 `npx --package @x1a0f3n9/dsh xfdsh web` 会解析到当前 rc。
- 之后若首次发布更旧的 dsh `rc`，可能把 `latest` 拉回去；`release:dist-tag` 不必重发也能做同样的事。
- 残留的 `next` tag 仍可能指向某个 rc。它不是文档里的安装通道。

## Related

[三条独立序列的私有 NPM 发布](2026-08-10-npm-release-sequences.zh.md) 仍然负责家族发布顺序和 vendor 的 `next` 排练。[npm publish always passes --tag](../bug-fix/2026-09-20-npm-publish-prerelease-tag.zh.md) 负责 `--tag` argv。
