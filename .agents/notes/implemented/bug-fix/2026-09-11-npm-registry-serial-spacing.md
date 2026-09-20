# Agent Note: npm registry calls must be spaced and fail on first 429

Status: implemented

English | [中文](2026-09-11-npm-registry-serial-spacing.zh.md)

## Problem

Publishing a large new-name family probes every member with `npm view` and then PUTs the first missing name. The skip path fired those probes with no gap, then the first PUT, then a 2s `E429` retry PUT. The retry also 429s, so the job dies after one name and a later re-run is the only way to continue.

## Decision

Space registry calls from one shared timestamp: 1s before every `npm view`, 5s before every `npm publish` PUT, including the first PUT after a skip-path probe. Do not retry `E429`. Keep `--fetch-retries 0` and keep pack `--concurrency 8` — pack is local disk work.

## Verification

`pnpm exec vitest run scripts/release/publish.spec.ts` asserts `REGISTRY_PROBE_SPACING_MS === 1000` and `RATE_LIMIT_ATTEMPTS === 1`.

## Alternatives considered

**Keep a 2s job-level `E429` retry.** Rejected: the retry PUT hits the same quota.

**Fail on first 429 without spacing probes.** Rejected: the skip-path GET burst still spends the quota the first PUT needs.

**Serialize pack to `--concurrency 1`.** Rejected: pack does not talk to the registry; eight workers packed in about nine minutes, serial pack would take about an hour.

**Sleep inside the job until the quota window resets.** Rejected in [npm publish must not retry 429 internally](2026-09-10-npm-publish-fetch-retries.md).

## Consequences

- A skip-only run waits about 1s per member.
- A publish waits at least 5s before each PUT.
- The first `E429` stops further PUTs in this run. [Branch publish pauses on npm new-name quota](../process/2026-09-11-branch-publish-quota-pause.md) owns whether that exit is 0.

## Related

[npm publish must not retry 429 internally](2026-09-10-npm-publish-fetch-retries.md) still owns `--fetch-retries 0`.
[Branch publish pauses on npm new-name quota](../process/2026-09-11-branch-publish-quota-pause.md) owns branch vs tagged exits.
