# Agent Note: npm publish must not retry 429 internally

Status: implemented

English | [中文](2026-09-10-npm-publish-fetch-retries.zh.md)

## Problem

Publishing the `@x1a0f3n9` family creates many new package names. npm's new-package write budget answers `E429` with `user undefined` even when `npm whoami` is a real user. `npm publish` also retries that 429 three times in one invocation, which spends the remaining quota on the same name and stalls the rest of the family. Sleeping 45–90 minutes inside the job then kept a GitHub Actions run in progress for hours with no new publishes, so a later re-run could not skip already-published members.

## Decision

Pass `--fetch-retries 0` on the publish command so one tarball makes one PUT. Job-level `E429` spacing and fail-on-first-429 are in [npm registry serial spacing](2026-09-11-npm-registry-serial-spacing.md). A later re-run skips members already on the registry at the same integrity.

## Verification

`pnpm exec vitest run scripts/release/publish.spec.ts` covers classifying `E429` as a transient registry code.

## Alternatives considered

**Keep npm's default three fetch retries.** Rejected because each 429 still counts against the new-package budget.

**Sleep 45–90 minutes inside the job and continue.** Rejected because a GitHub Actions job cannot outlast the quota window, and a three-hour in-progress run published no new packages while blocking a re-run.

**Fail on the first 429 with no retry.** Rejected here because a one-off 429 can clear in seconds; later evidence reversed that retry in [npm registry serial spacing](2026-09-11-npm-registry-serial-spacing.md).

## Consequences

- Publishing 200+ new names takes several quota windows, each started by re-running the publish job.
- Existing names at the same version stay skip-only; only absent names hit `E429`.
