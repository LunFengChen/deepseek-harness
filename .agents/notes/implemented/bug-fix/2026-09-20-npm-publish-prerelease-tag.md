# Agent Note: npm publish always passes --tag

Status: implemented

English | [中文](2026-09-20-npm-publish-prerelease-tag.zh.md)

## Problem

npm CLI refuses `npm publish` of a prerelease unless `--tag` is present. `0.1.5-rc.5` is a prerelease. `DshFamily.distTagForVersion` returns undefined for `rc` so the version occupies `latest`. `publish.ts` omitted `--tag` in that case. Both `dev-x1a0f3n9` (`@x1a0f3n9`) and `master` (`@xfcodeai`) Release jobs failed on the first tarball: `You must specify a tag using --tag when publishing a prerelease version.`

## Decision

`npmPublishTagArgs` always emits `--tag`. A missing family channel becomes `latest`. Named channels (`alpha`, `canary`, vendor `next`) stay explicit. Family mapping is unchanged.

## Verification

`pnpm exec vitest run scripts/release/publish.spec.ts` asserts `npmPublishTagArgs(undefined) === ['--tag', 'latest']` and named channels stay explicit.

## Alternatives considered

**Return `'latest'` from `DshFamily.distTagForVersion` for `rc`.** Rejected: the family already means the latest channel by returning undefined; the npm CLI adapter is what must pass `--tag`.

**Publish `rc` onto `next` again so `--tag next` is present.** Rejected: [dsh rc versions take latest](../process/2026-09-19-dsh-rc-latest-dist-tag.md) owns the friend-facing untagged install.

## Consequences

- A later `rc` publish updates `latest`.
- Stable versions also pass `--tag latest`, which matches npm's previous omit-`--tag` default.

## Related

[dsh rc versions take latest](../process/2026-09-19-dsh-rc-latest-dist-tag.md) still owns which channel an `rc` occupies.
