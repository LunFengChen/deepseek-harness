# Agent Note: Windowed projections snapshot the current surface

Status: implemented

English | [中文](2026-09-28-windowed-surface-replace-bootstrap.zh.md)

## Problem

A windowed Session's live tail is not a complete prefix. Projection late-build still folded `snapshotEvents()` as seq 0. A later surface replace whose `startSeq` sits before `liveBaseSeq` then fails with `token surface: replace at seq N has invalid current range`.

The stored log is contiguous and valid. The fold is missing every surface node the window already dropped, including nodes that a later replace still names. Token-meter `measure()` already snapshots the current surface when resume ingest is missing. Projection `snapshot()` and the first live `session/event` did not.

## Decision

`ProjectionDefinition.bootstrapWindowed(session)` snapshots current Session-owned state when a windowed Session has no ingested cell. `SessionProjectionRegistry.cellFor` and the first live `drive` call it when `liveBaseSeq > 0`. The cell watermark is the current cursor or the triggering event seq. The registry does not apply that event again: it is already in the Session.

`contextBreakdown` prices `session.surface.nodes` through `eventAt` and `priceCurrentSurfaceNode`. A missing or non-surface node throws `contextBreakdown cannot price surface node N missing from the live window`. Tools come from `session.requestHeader()`.

Units that need replaced-away prefix events keep `ingestRestoredEvent` during resume. `planSurfaceTokens` still throws on an unresolvable replace. Skipping dirty replaces is not admitted.

## Alternatives considered

**Skip invalid replaces in `planSurfaceTokens`.** Rejected: committed logs are surface-validated at append time. An unresolvable range is log corruption and must fail loud.

**Late-build from the tail plus `prefixHot` by replaying replaces.** Rejected: `prefixHot` keeps current surface nodes, not replaced-away seqs that a historical replace still names. Snapshot the current surface instead of replaying those ranges.

**Reread the persisted prefix on first snapshot.** Rejected: resume already scanned every event once; a second full read would undo the window's memory bound.

**Keep throwing on projection late-build.** Rejected: opening a long valid Session and then snapshotting `contextBreakdown` fails even though `measure()` can already price the same surface.

## Consequences

Opening a windowed Session and snapshotting `contextBreakdown` prices the current surface without replaying dropped replace ranges. A later replace of a current node folds from that snapshot.

Units without `bootstrapWindowed` still fold the live tail. Those units still throw if that tail contains a replace of a dropped seq, and they must stay mounted for resume ingest when they need replaced-away prefix nodes.

## Related

[Windowed restore folds projections during ingest](2026-09-28-windowed-restore-projection-fold.md) still owns resume ingest, the path that preserves usage anchors and replaced-away seqs.

[Session host memory bounds](../architecture/2026-09-23-session-host-memory-bounds.md) still owns the live tail, `prefixHot`, and `eventAt` returning `undefined` for released seqs.

[Windowed Sessions compact on context overflow](2026-09-28-windowed-overflow-compaction.md) owns the token-meter `measure()` surface snapshot.
