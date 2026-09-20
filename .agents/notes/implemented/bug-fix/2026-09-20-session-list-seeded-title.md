# Agent Note: Serve cold list titles for seeded Sessions from the projection cache

Status: implemented

English | [中文](2026-09-20-session-list-seeded-title.zh.md)

## Problem

Web Session list falls back to the workspace directory basename when the host row has no durable `title`. Cold list never folds the log. It used `cachedSnapshot` / `cachedPredecessorTitle` only with inherited cut 0, and skipped those reads entirely when `header.isSeeded` was true, because a cut-0 identity would alias a different fork lifecycle.

Fork, rewind, delete, and regenerate create seeded children. Their checkpoints already store `inheritedEventCount` and `title` (session creation is a mandatory cache write). After restart those rows still showed the workspace name until the Session was opened and live-folded. A Session that failed to observe never recovered a title at all.

## Decision

Add `cachedListedHint(header)` as the Session-list cache entry. Unseeded rows keep cut 0. A seeded header-only row does not invent cut 0: it reads the stored checkpoint for that Session id, and only after `createdAt`, `cwd`, and seeded lineage match does it use the stored `inheritedEventCount` for `cachedSnapshot` or `cachedPredecessorTitle`. A lineage-less predecessor that still matches `createdAt` and `cwd` may expose only a current-schema `title` with `asOfSeq: -1`. Hydration, `cachedSnapshot`, and `coldSnapshot` still require the caller to pass the authoritative cut.

This is a listing hint, not a fold seed. It does not open Session logs.

## Testing

`session-projection-cache` serves a seeded listing hint from the stored inherited cut and refuses a cwd mismatch or an unseeded header against a seeded record. Archived lineage-less fixtures still refuse `cachedSnapshot` / `cachedPredecessorTitle` for a seeded caller, but `cachedListedHint` returns the compatible title. `session-controller` cold list includes a seeded row's cached title without `inspect` or `observe`.

## Alternatives considered

**Open every seeded log at list time to learn `inheritedEventCount`.** Rejected: list must stay metadata/cache-only. Scanning jsonl on startup is the cost this cache exists to avoid.

**Pass cut 0 for seeded snapshots.** Rejected: that identity is a different lifecycle. The previous skip existed to prevent this alias.

**Keep skipping seeded rows and accept workspace-name fallback.** Rejected: the title is already in the checkpoint. Opening the Session to recover it is unnecessary, and a failed observe never recovers.

## Consequences

- Forked Sessions keep their cached titles on Web restart without a body read.
- A missing, cwd-mismatched, or newer-format checkpoint still lists as the workspace basename until a successful open live-folds `session/title`.
- Identity matching for hydration is unchanged. See [projcache cross-version read compat](../architecture/2026-09-02-projcache-cross-version-read-compat.md) for the strict fold path.
