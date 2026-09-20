# Agent Note: keep session-timeline off the flattened Client/Host relay

Status: implemented

English | [中文](2026-09-10-session-timeline-dependency-scope.zh.md)

## Problem

`dsh-session-timeline` declares `dsh.client`, so `verify-package-dependencies` treated it as a flattened Client/Host package. Its host rewind path imports `SessionSeq`, `createUserMessage`, `boundContextSummary`, `canonicalPath`, and `resolveDshHome`. Those exports are not in the reviewed safe/peer-required lists, so the Release `dependencies` job failed before npm publish.

## Decision

`@x1a0f3n9/dsh-session-timeline` is an external plugin at [LunFengChen/dsh-session-timeline](https://github.com/LunFengChen/dsh-session-timeline). It is not a workspace package, so it is not in `clientFaceExclude` and Host dependency flattening does not apply. Do not add those five exports to the global Host allowlists.

## Verification

`node --import tsx/esm scripts/verify-package-dependencies.ts` reports 0 violations. `pnpm exec vitest run scripts/verify-package-dependencies.spec.ts` covers the explicit exclude roster.

## Alternatives considered

**Classify the five exports as safe or peer-required.** Rejected because that allowlist is global, and new entries are reserved for explicit human review of duplicate-install identity.

**Rewrite rewind to avoid those imports.** Rejected for this publish: the plugin already uses those constructors to append the rewind marker and restore files.

## Consequences

- Session-timeline host dependencies stay declared on the plugin package.
- Workspace Client/Host flattening no longer sees this plugin.
