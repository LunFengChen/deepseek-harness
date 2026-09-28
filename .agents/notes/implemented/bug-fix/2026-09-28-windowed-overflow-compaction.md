# Agent Note: Windowed Sessions compact on context overflow

Status: implemented

English | [中文](2026-09-28-windowed-overflow-compaction.zh.md)

## Problem

A provider-confirmed `CONTEXT_WINDOW_EXCEEDED` from pi-ai already maps onto overflow recovery. On a live-windowed Session that recovery still failed the turn, and `/compact` then reported `token meter cannot rebuild a windowed Session from its live tail` or `Compaction could not produce a useful summary`.

Two scanners still walked `eventAt` from `session.seq - 1` down to `0`. After the window dropped the prefix, the first missing seq threw. Token-meter `measure()` also threw when resume ingest had not populated replay state. The summarizer then sent nearly the whole overflowing surface back to the same model, so the auxiliary call overflowed too and the original request error was preserved.

## Decision

Token-meter `measure()` snapshots the current surface from the live tail and prefixHot when replay state is missing. Resume ingest still preserves usage anchors and replaced-away seqs.

Compaction lock inspection walks only `snapshotEvents()` — the live tail. An open turn's `turn/start` stays in that tail because the window never splits an in-flight turn. A `session/end-seed` left in the released prefix is unread, not corrupt.

If the summarizer itself finishes with `CONTEXT_WINDOW_EXCEEDED`, the region transaction lands a short fallback checkpoint so the surface still shrinks and overflow recovery can retry. Other summarizer failures stay fail-closed.

## Alternatives considered

**Keep throwing when token-meter ingest is missing.** Rejected: `/compact` and overflow recovery then fail the turn on every long Session whose resume missed ingest, including a live conversation that windowed after the first measure never ran.

**Reread the persisted prefix to rebuild the meter and compaction lock.** Rejected: that undoes the host memory bound at the moment the user needs to continue.

**Leave summarizer overflow as a failed compact.** Rejected: the user-visible turn already overflowed; failing the recovery call with the same code leaves the conversation stuck.

## Consequences

`CONTEXT_WINDOW_EXCEEDED` on a windowed Session can compact and retry instead of stopping the turn. `/compact` can run on the live tail without scanning released seqs. A fallback checkpoint is lossy; it is still smaller than the shadowed span.

## Related

[Windowed restore folds projections during ingest](2026-09-28-windowed-restore-projection-fold.md) still owns resume ingest.

[Skill catalog history stops at the live RAM window](2026-09-28-skill-catalog-windowed-prefix.md) is the same class of `eventAt` walk to seq 0.

[Classify Grok and pi-ai context overflow](2026-09-14-pi-ai-context-overflow-classification.md) still owns mapping provider overflow onto `CONTEXT_WINDOW_EXCEEDED`.
