# Agent Note: Destructive deletion of a session turn tail

Status: implemented

English | [中文](2026-09-02-destructive-session-tail-deletion.zh.md)

## Problem

Forking a session is too slow for removing an unwanted answer, and leaving the unwanted events in the source session means later model requests still carry them as history.

## Decision

The session controller exposes `deleteFrom`, which resolves a selected visible message to its containing `turn/start`. It flushes pending writes, atomically rewrites the JSONL artifact to the retained prefix, then truncates the live `Session` and resets all derived projections. The initiating client reloads the session after success so the next request and displayed transcript use only the retained history.

The Web chat renders a trash icon for persisted user and assistant turns. The icon opens a confirmation dialog with an acknowledgement checkbox; confirmation permanently removes the selected turn and every later event. Deletion is rejected while the agent is running, and inherited fork events cannot be removed. Backends without a rewrite primitive fail loudly instead of pretending that deletion succeeded.

## Alternatives considered

**Fork a replacement session.** This preserves the original history and incurs the slow fork path that motivated the feature.

**Hide messages only in the Web client.** Hidden records would still be sent in later model requests and remain durable, so this does not satisfy deletion.

**Delete only the selected message event.** A message event is part of a balanced turn log with tool and boundary records; retaining half a turn could produce invalid replay or model history. Turn-granular deletion preserves a valid event prefix.

## Consequences

Deletion is destructive and cannot be undone; the selected turn and all later records disappear from the durable artifact and live session. The current client resynchronizes immediately, while a separately open client must reload after the session is changed. The JSONL provider publishes a synced temporary file by rename, so a failed rewrite leaves the previous artifact in place.
