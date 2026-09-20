# Agent Note: Session history opens from a log suffix

Status: implemented

English | [中文](2026-09-11-session-history-suffix-page.zh.md)

## Problem

Opening a stored Session history restored the whole JSONL artifact into a Session before serving the last ~50 messages. A 127MB `session.jsonl.zstd` therefore paid a full decode, full object graph, and a full `snapshotEvents(0, seq)` copy on click. Write/resume still needs that full read; the view path does not.

## Decision

`SessionPersistence.readHistorySuffix` is an optional cheap tail reader. The JSONL backend scans Zstandard frame boundaries, decompresses only the newest frames that cover one message page, and never constructs a `SessionLogScanner` from seq 0. Uncompressed logs walk complete JSONL lines from the end. Historical generations return `undefined` so the existing migrate-through-observe path still runs. Pending empty creates return cursor `-1`.

`SessionHistoryController` uses that suffix for cold ordinary `page`/`follow`. It does not promote a Session on a suffix view. Live Sessions keep `observeSession` and paginate with `eventAt` plus `snapshotEvents(cut, end)` so the live events getter never materializes seq 0. Subagent addresses, missing suffix methods, and backends that return `undefined` fall back to the previous full observation.

A suffix reports `inheritedEventCount: 0` when the seeded cut is not in the window. Projection cache misses stay empty. Interrupted-turn closers are added only when the open `turn/start` sits in the suffix.

## Alternatives considered

**Keep restoring the Session and only paginate after `source.events`.** Rejected: the live observation getter copies the whole log on first `events` read, which is the click that felt hung.

**Stream-decode from disk without holding the compressed file.** Rejected for this change: frame scanning still needs the artifact bytes, and the object-graph restore was the user-visible stall. A later mmap/windowed read can drop the 127MB buffer without changing the page contract.

**Promote on suffix follow so prompt is already warm.** Rejected: viewing history must not restore a 127MB Session; `prompt` still observes for write.

## Consequences

- Cold history click pays for the last page of messages, not the whole log.
- Opening history no longer activates an Agent.
- Seeded suffix views may omit inherited projections until a full observe.
- Writable resume and compaction still full-read the artifact.

## Related

[Session history, control state, and Remote event transport](2026-08-18-session-history-and-event-transport.md) still owns page/follow wire types.
