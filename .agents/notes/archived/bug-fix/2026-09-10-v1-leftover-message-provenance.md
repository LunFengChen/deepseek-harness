# Agent Note: Leftover v1 assistant message provenance

Status: implemented
Archived: 2026-09-10

English | [中文](2026-09-10-v1-leftover-message-provenance.zh.md)

## Problem

Released v1-to-v2 restore refuses a Session when an `assistant/message` still carries `sourceEventSeqs` after its chunk attempt has already settled. Historical rewind markers write that leftover provenance on a later ghost step, so a shared `~/.dsh` conversation fails to open.

## Decision

When no chunk attempt is open, keep the message and embed an empty stream. Drop the leftover provenance. Continue refusing mismatched provenance only while a matching attempt is still pending.

## Alternatives considered

**Refuse the log.** One leftover marker hides the whole conversation.

**Rewrite the stored v0 file.** Adjacent migration forbids overwriting a committed generation, and compatible read does not need a user-facing history import.

**Change only the rewind writer.** Current rewind markers already use a plugin `user/message` replace carrier. Existing logs still have to open.

## Consequences

Sessions with leftover rewind markers restore. The original v0 artifact stays unchanged. Persistence may publish a successor generation on a successful open. Empty rewind-marker messages remain in the log with empty streams. [Migration tests](../../../../packages/session/session-format-v1-to-v2/tests/migration.spec.ts) cover leftover provenance with no open attempt, and still refuse incomplete provenance on a live attempt.
