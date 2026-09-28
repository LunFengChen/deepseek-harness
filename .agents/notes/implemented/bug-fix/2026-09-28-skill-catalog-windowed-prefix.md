# Agent Note: Skill catalog history stops at the live RAM window

Status: implemented

English | [中文](2026-09-28-skill-catalog-windowed-prefix.zh.md)

## Problem

`tool-skill` walks `eventAt` from `session.seq - 1` down to `0` on every `agent/pre-step` to find the newest durable skill catalog. After [Session host memory bounds](../architecture/2026-09-23-session-host-memory-bounds.md), seqs before `liveBaseSeq` are a released prefix unless they remain in `prefixHot`. `eventAt` returns `undefined` for those seqs.

The scanner treated every `undefined` as a hole in a complete in-memory log and threw `skill catalog cannot read seq N below the current Session length`. A legal long Session then failed the whole turn, including at seq 34745 on a live windowed log.

## Decision

`catalogHistory` walks only `[liveBaseSeq, session.seq)`. A missing event in that tail still throws. A seq below `liveBaseSeq` is unread, not corrupt.

If the newest catalog sits only in the released prefix, this pre-step treats it as unpublished and may append a replacement. That is cheaper than failing the turn.

## Alternatives considered

**Keep scanning to seq 0 and throw on the first `undefined`.** Rejected: that is the live-window crash. The prefix is gone from RAM on purpose.

**Skip `undefined` below `liveBaseSeq` and keep walking `prefixHot`.** Rejected: `prefixHot` is sparse, so the walk would still visit every released seq. One replacement catalog in the live tail is enough for later digest comparison.

**Reread the persisted prefix to recover the old digest.** Rejected: resume already scanned the log once, and the catalog plugin must not undo the host memory bound on every step.

## Consequences

A windowed Session can take another step without the catalog scanner failing the turn. A catalog that lives only below `liveBaseSeq` may be published again as a first catalog rather than an `update`. A true hole inside the live tail still fails loud.

## Related

[Session host memory bounds](../architecture/2026-09-23-session-host-memory-bounds.md) still owns the live tail, `prefixHot`, and `eventAt` returning `undefined` for released seqs.

[Windowed restore folds projections during ingest](2026-09-28-windowed-restore-projection-fold.md) still owns restore-time projection and token-meter ingest.
