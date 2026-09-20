# Agent Note: Closed-turn rewind ghost step

Status: implemented
Archived: 2026-09-10

English | [中文](2026-09-10-closed-turn-rewind-ghost-step.zh.md)

## Problem

Released v0-to-v3 restore refuses a Session when `step/start` arrives after `turn/end`. Historical rewind markers wrote that ghost step on the already closed turn so a later empty `assistant/message` could replace a surface range. Shared `~/.dsh` conversations then fail to open, including ones that continued after the marker.

## Decision

When `legacyClosedTurnGhostStep` is on, admit `step/start` whose turn is the last closed turn and whose step is the next step, without reopening the turn. Ghost step events match that `(turn, step)`. `step/end` clears the ghost. The following `turn/start` still uses the already advanced next-turn number. A ghost replace may omit `sourceEventSeqs` after [leftover v1 provenance](2026-09-10-v1-leftover-message-provenance.md) is dropped; the replace range still shadows the current surface. Current rewind writes still truncate instead of appending markers.

## Alternatives considered

**Truncate the tail on open.** Turns after the marker would disappear.

**Drop the marker events.** The replace would vanish and the shadowed user message would return to the model context.

**Reopen `openTurn` for the ghost step.** The following `turn/start` would then fail because a turn is already open.

**Rewrite the stored v0 file.** Adjacent migration forbids overwriting a committed generation.

## Consequences

Sessions with historical rewind ghost steps restore. The original v0 artifact stays unchanged. Persistence may publish a successor generation on a successful open. [Relationship tests](../../../../packages/session/session-format-v0-to-v1/tests/relationships.spec.ts) cover the exception and its refusals. [V3 restore](../../../../packages/session/session-format-v2-to-v3/tests/admission.spec.ts) covers the production restore path.
