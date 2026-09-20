# Agent Note: publish @x1a0f3n9/dsh from dev-x1a0f3n9

Status: implemented

English | [中文](2026-09-10-dev-branch-npm-publish.zh.md)

## Problem

Pushing `dev-x1a0f3n9` is supposed to publish `@x1a0f3n9/dsh`. The workflow already set `RELEASE_PUBLISH` and `RELEASE_PUBLISH_ALLOW_REF` for that branch, but `release:verify` still required an `xfdsh-v*` tag, and family discovery still rejected every `@x1a0f3n9/*` package.

## Decision

Keep tagged `xfdsh-v*` publication as the reviewed fallback. For `dev-x1a0f3n9`, honor `RELEASE_PUBLISH_ALLOW_REF` and discover dsh-family members under `@x1a0f3n9`. Vendor packages stay `@deepseek-ai`. Do not publish `@xfcodeai/*` from this branch.

## Verification

Unit tests cover family discovery, tag names, the branch allow-ref, and the release workflow wiring. `pnpm exec vitest run scripts/release/families.spec.ts scripts/release/verify.spec.ts scripts/ci-workflow.spec.ts` is the local evidence for this change.

## Alternatives considered

**Publish only from `xfdsh-v*` tags.** Rejected because the user asked `dev-x1a0f3n9` pushes to publish `@x1a0f3n9/*` without waiting for a tag.

**Leave family discovery on `@deepseek-ai`.** Rejected because the development packages are `@x1a0f3n9/dsh-*`; the pack job would fail before any tarball was written.

## Consequences

- `dev-x1a0f3n9` publishes `@x1a0f3n9/*` and does not publish `@xfcodeai/*`.
- `master` publishes `@xfcodeai/*` from the same packed tarballs after a complete-name rewrite ([master xfcodeai publish](../process/2026-09-20-master-xfcodeai-publish.md)).
