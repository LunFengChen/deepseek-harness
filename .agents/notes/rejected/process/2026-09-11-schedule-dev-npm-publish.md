# Agent Note: Schedule development npm publish after new-name 429

Status: rejected — GitHub Actions is not a drip queue for npm new-name quota

English | [中文](2026-09-11-schedule-dev-npm-publish.zh.md)

## Problem

Publishing a large new-name family stops on the first npm `E429`. That stop is correct: the same window will not accept more names. Putting a twice-daily cron on the Release workflow would keep retrying without a person, and would also keep packing the family and painting expected quota stops as CI failures.

## Proposal

Add `schedule: '17 2,14 * * *'` to the development `Release (dsh)` workflow. Keep failing the job on the first `E429`. Rely on GitHub's default-branch cron to continue remaining absent names.

## Alternatives considered

**Sleep inside the job until the quota window resets.** Rejected: GitHub Actions will not keep a runner for hours.

**Retry `E429` in the publish script.** Rejected: the retry PUT hits the same quota.

**Exit 0 on a branch-publish `E429` and continue on the next real push.** Accepted instead: CI is not a publisher daemon, and a later development push already re-enters publish.

## Acceptance criteria

- The development Release workflow runs twice daily without a push.
- Publish stays gated on the development ref.
- The first `E429` still fails that run.
