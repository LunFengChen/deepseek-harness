# Agent Note: Destructive deletion of a session turn tail

Status: implemented

English | [中文](2026-09-10-destructive-session-tail-deletion.zh.md)

## Problem

Forking a session is too slow for removing an unwanted answer, and a rewind marker leaves the unwanted events in the source session. Later model requests still carry them as history.

## Decision

Delete, rewind, and regenerate share one truncate: resolve the selected visible message to its containing `turn/start`, flush live writes, rewrite the current JSONL generation to that prefix, drop routed live events at or past the retained length, truncate the live `Session` (which emits `session/truncated`), and rebuild derived projections. Historical format generations are not moved, overwritten, or deleted. The initiating client resynchronizes so the next request uses only the retained history.

Timeline buttons call `deleteFrom` for conversation-only truncation. `/rewind @seq both` restores tracked workspace files first, then truncates. Regenerate reads durable images, truncates, then submits the original user content. The plugin does not append a surface marker. If a command handler truncates away its `command/run`, `command/done` is skipped so the pair cannot become an orphan.

Deletion is rejected while the agent is running, and inherited fork events cannot be removed. Backends without a rewrite primitive fail loudly.

## Alternatives considered

**Fork a replacement session.** This preserves the original history and incurs the slow fork path that motivated the feature.

**Append a rewind marker and hide the tail.** Hidden records would still be sent in later model requests and remain durable, so this is not deletion.

**Delete only the selected message event.** A message event is part of a balanced turn log; retaining half a turn could produce invalid replay or model history.

## Consequences

Truncation cannot be undone. The selected turn and all later records disappear from the current durable generation and the live session. A separately open client must reload after the session changes. A failed rewrite leaves the previous current-generation artifact in place.
