# Agent Note: Windowed restore folds projections during ingest

Status: implemented

English | [中文](2026-09-28-windowed-restore-projection-fold.zh.md)

## Problem

A persisted resume now streams events into a live RAM tail. After that window drops the prefix, `snapshotEvents()` is only the tail. Projection cells and the token meter still rebuilt by folding that tail as if it were the complete log from seq 0.

A later surface replace whose `startSeq` sits before `liveBaseSeq` then fails with `token surface: replace at seq N has invalid current range`. The stored log is contiguous and valid. The fold was missing every surface node that the window had already dropped, including nodes that a later replace still names.

`adoptRestoredEvent` does not publish `session/event`, so the ordinary eager drive never sees the restored prefix. The first `snapshot()` or `measure()` after resume was the first fold, and it ran against the tail.

## Decision

`SessionProjectionRegistry.ingestRestoredEvent` and `TokenMeter.ingestRestoredEvent` fold one restored event into the existing per-session state. A missing cell or replay state starts from `init` / empty surface with watermark `-1` or consumed seq `0`. They never call `snapshotEvents()` or walk `eventAt` across the dropped prefix.

`AgentLoop.resumeWith` calls both ingest methods from the same `adopt` helper used by streaming `adoptEvent`, the `handle.read(0)` fallback, and interrupted-turn closers. Token meter ingest is skipped when that service is not mounted.

Token-meter `_sync` prefers resume ingest. If that replay state is missing, it snapshots the current surface from the live tail and prefixHot so `measure()` can still price pressure. That snapshot does not recover usage anchors or replaced-away seqs; ingest during resume remains the path that preserves them. Projection `cellFor` still late-builds from the tail for units registered after restore — those units never saw the dropped prefix.

`Session.beginPersistedRestore` accepts an optional inherited cut so a caller that already knows it can seed `init` before the first ingest. Resume still records the durable cut in `finishPersistedRestore` after the scan; current-format storage does not expose that cut on `stat`.

## Alternatives considered

**Keep the complete event graph in RAM so late-build stays correct.** Rejected: that is the host OOM the live window exists to prevent.

**Late-build from the tail plus `prefixHot`.** Rejected: `prefixHot` keeps current surface nodes, not replaced-away seqs that a later replace still names. The missing node is exactly the one the replace needs.

**Rebuild by rereading the persisted prefix on first snapshot.** Rejected: resume already scanned every event once; a second full read would undo the window's memory bound at the moment the user continues the Session.

**Raise `--max-old-space-size` or skip folding until a later request.** Rejected: the process still grows, and the first continue/measure still needs a correct surface.

**Rewrite the stored log to drop replace ranges that cross the window.** Rejected: the artifact is valid; the defect is the in-process fold.

## Consequences

Opening a large stored Session and then measuring or snapshotting it no longer throws `invalid current range` solely because a replace names a seq before the live tail. New live appends continue from the ingested watermark through `eventAt` on the dense tail.

A projection unit registered after a windowed Session already exists late-builds from the live tail only. Units that must see replaced-away prefix nodes have to be mounted before resume and ingested during the stream.

Units whose `init` reads `inheritedEventCount` see `0` during streamed resume unless the caller passed the cut into `beginPersistedRestore`. The durable cut is still applied at finish for Session metadata.

## Related

[Session host memory bounds](../architecture/2026-09-23-session-host-memory-bounds.md) still owns the live tail, `prefixHot`, and streaming `adoptRestoredEvent`.

[Deprecate synchronous reads of arbitrary Session events](../architecture/2026-09-09-deprecate-synchronous-session-event-reads.md) still owns the direction away from complete in-memory logs.

[Windowed Sessions compact on context overflow](2026-09-28-windowed-overflow-compaction.md) owns measure() surface snapshot and compaction lock inspection on the live tail.
