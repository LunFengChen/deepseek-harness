# Agent Note: dsh rc versions take latest

Status: implemented

English | [中文](2026-09-19-dsh-rc-latest-dist-tag.zh.md)

## Problem

This fork's friend-facing install is `npm install --global @x1a0f3n9/dsh`. `DshFamily.distTagForVersion` mapped every `rc` to npm's `next` tag, so the untagged command resolved `latest` to an older pin (`0.1.5-rc.2`) while `0.1.5-rc.4` sat on `next`. Friends should not have to pass `@next`.

## Decision

`DshFamily` maps `alpha` and `canary` to those named tags and returns undefined for `rc`, other prereleases, and stable versions. `publish.ts` always passes `--tag`, using `latest` when the family returns undefined, because npm refuses a prerelease publish without `--tag`. Vendor publication still uses `next` for prereleases.

`pnpm run release:dist-tag --family dsh` points `latest` at each member's already-published version without packing. `.github/workflows/release-dist-tag.yml` is a `workflow_dispatch` job on `npm-publish` that runs that command. Re-running it is idempotent: a tag that already names the version is skipped.

## Verification

`pnpm exec vitest run scripts/release/families.spec.ts scripts/release/dist-tag.spec.ts scripts/release/publish.spec.ts scripts/ci-workflow.spec.ts` covers the mapping, the skip/add judgement, `--tag latest` argv, and the dispatch workflow.

## Alternatives considered

**Document `@x1a0f3n9/dsh@next` and leave `latest` on the older rc.** Rejected: the install path friends actually type is the untagged package name.

**Bump to `0.1.5-rc.5` only to retake `latest`.** Rejected: the tarball is already `0.1.5-rc.4`; a dist-tag move is the registry change.

**Move `latest` only for `@x1a0f3n9/dsh`.** Rejected: dependency versions do not use dist-tags, but the family should not advertise two current channels.

## Consequences

- `npm install --global @x1a0f3n9/dsh` and `npx --package @x1a0f3n9/dsh xfdsh web` resolve the current rc.
- A later first-time publish of an older dsh `rc` can move `latest` backwards; `release:dist-tag` can do the same without republishing.
- The leftover `next` tag may still name an rc. It is not the documented install channel.

## Related

[Private npm publication as three independent sequences](2026-08-10-npm-release-sequences.md) still owns family publish order and vendor `next` rehearsals. [npm publish always passes --tag](../bug-fix/2026-09-20-npm-publish-prerelease-tag.md) owns the `--tag` argv.
