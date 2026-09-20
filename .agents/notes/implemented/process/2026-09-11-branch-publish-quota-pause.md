# Agent Note: Branch publish pauses on npm new-name quota

Status: implemented

English | [中文](2026-09-11-branch-publish-quota-pause.zh.md)

## Problem

A first-time family publish hits npm's new-package write quota after a few dozen names. Retrying in the same job spends the same window. Scheduling GitHub Actions to drip the rest turns CI into a publisher daemon and paints an expected stop as a failed check.

## Decision

Do not retry `E429`. A tagged publish still fails the job. A branch allow-ref publish stops further PUTs, logs the pause, finishes the skip pass, and exits 0. The next real push probes again and publishes remaining absent names. GitHub Actions is not scheduled for this.

## Verification

`pnpm exec vitest run scripts/release/publish.spec.ts` asserts `rateLimitedPublishAction('') === 'fail'` and a non-empty allow-ref pauses.

## Alternatives considered

**Twice-daily cron on the Release workflow.** Rejected in [Schedule development npm publish after new-name 429](../../rejected/process/2026-09-11-schedule-dev-npm-publish.md): CI is not a drip queue.

**Fail the branch job on `E429` and wait for a person to re-run.** Rejected: the next development push already re-enters publish, and a red check is the wrong signal for an expected quota stop.

**Exit 0 on tagged `E429` too.** Rejected: a tagged version that did not finish publishing is a failed release.

## Consequences

- Development-branch Release stays green when npm quota is exhausted.
- Remaining names wait for the next push, not a timer.
- A tagged publish still fails on the first `E429`.

## Related

[npm registry calls must be spaced and fail on first 429](../bug-fix/2026-09-11-npm-registry-serial-spacing.md) still owns probe and PUT gaps and the no-retry rule.
