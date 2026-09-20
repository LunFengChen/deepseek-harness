# Agent Note: Legacy turn number skip

Status: implemented
Archived: 2026-09-10

English | [中文](2026-09-10-legacy-turn-number-skip.zh.md)

## Problem

Released v0-to-v3 restore refuses a Session when `turn/start` after `turn/end` uses a number greater than the next turn. Shared `~/.dsh` logs from historical rewind and seed continuation then fail to open, even though later turns are intact.

## Decision

When `legacyTurnNumberSkip` is on, and no turn or ghost step is open, admit `turn/start` whose number is greater than `nextTurn` after a turn has already closed. `nextTurn` jumps to that number. A first `turn/start`, a still-open turn, and a backwards number still refuse. The original v0 generation is unchanged.

## Alternatives considered

**Truncate at the gap.** Later turns would disappear.

**Renumber the later turns.** Adjacent migration forbids rewriting committed events in the source generation, and a successor would disagree with in-log turn coordinates.

**Rewrite the stored v0 file.** Adjacent migration forbids overwriting a committed generation.

## Consequences

Sessions whose later turns skip numbers restore. Persistence may publish a successor generation on a successful open. [Relationship tests](../../../../packages/session/session-format-v0-to-v1/tests/relationships.spec.ts) cover the exception and its refusals. [V3 restore](../../../../packages/session/session-format-v2-to-v3/tests/admission.spec.ts) covers the production restore path.
