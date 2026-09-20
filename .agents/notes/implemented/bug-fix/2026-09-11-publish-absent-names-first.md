# Agent Note: Publish absent package names before present versions

Status: implemented

English | [中文](2026-09-11-publish-absent-names-first.zh.md)

## Problem

A family publish walks members in dependency order and decides each one against the registry as it goes. npm's new-package write quota is about fifty new *names* per window. Names that already exist, including those whose packed bytes differ, sit earlier in that order. A tagged mismatch fails at the first such name and never reaches unpublished members. A version bump that republishes existing names first spends the same window before the missing names.

## Decision

Probe every packed member, then publish in two passes. Pass one publishes every `absent` name in the original order. Pass two then skips an identical tarball, fails a tagged mismatch, and skips a branch-publish mismatch. `existingPublishedVersionAction` is unchanged. New *versions* of names that already exist still need a family bump after the missing names exist.

## Verification

`pnpm exec vitest run scripts/release/publish.spec.ts` asserts `partitionPublishPasses` keeps original order inside an absent pass that precedes present members.

## Alternatives considered

**Fail immediately on a present mismatch.** Rejected: the first stale name sits before the unpublished remainder and would stop the job.

**Bump the family version so every member is absent.** Rejected: the first fifty PUTs would be new versions of names that already exist, and later members declare that same version.

**Publish each absent name as soon as its probe returns.** Rejected: a few hundred 1s probes are cheaper than a second control path, and the quota window is hours.

## Consequences

- Missing names use the new-package quota before existing names are considered.
- A tagged mismatch still fails, but only after unpublished members have been attempted.
- A branch publish still cannot replace a published version; content changes need a bump once the names exist.
- Probing the whole family waits about 1s per member before the first PUT.

## Related

[npm registry calls must be spaced and fail on first 429](2026-09-11-npm-registry-serial-spacing.md) still owns probe and PUT gaps.
[npm release sequences](../process/2026-08-10-npm-release-sequences.md) still owns family versioning.
