# Agent Note: strip pre-turn inbox splices during deleteFrom

Status: implemented

English | [中文](2026-09-28-delete-from-pre-turn-inbox-splices.zh.md)

## Problem

Regenerate still resends the original question as an interrupt after `deleteFrom` drains the live inbox. `deletionStart` is turn-granular and stops at `turn/start`. The wake `agent/inbox/spliced` that admitted that turn is logged before `turn/start`, so the retained prefix still contains it. Truncation observers forget projection cells and rebuild them from that prefix, which restores the original question. Timeline regenerate then `prompt('queue')`. If a turn has already claimed the restored copy, the second copy is admitted as steering, and the Chat surface can settle that row as an unknown `steering` event.

[Drain restored inbox splices after conversation truncation](2026-09-21-delete-from-restored-inbox.md) already calls `inbox.clear()` after truncate. Clear cannot delete the wake event from the prefix, so a later rebuild or a regenerate prompt still sees two copies.

## Decision

`deleteFrom` walks the deletion offset back through contiguous `agent/inbox/spliced` events that sit immediately before the deleted `turn/start`, without crossing `inheritedEventCount`. Persistence and the live log then shrink to that earlier offset. When the live RAM window starts at that `turn/start`, the wake splice is already outside RAM, so the live walk stops; `deleteFrom` rereads the persisted prefix and drops trailing inbox splices before replacing the live log. `inbox.clear()` still runs after truncate so any live rebuild during `session/truncated` is dropped.

Regenerate keeps its current client contract: truncate the turn, then prompt the original text once as `queue`. The retained prefix no longer contains the deleted turn's wake splice, so that prompt is the only copy.

## Alternatives considered

**Keep only `inbox.clear()` after truncate.** Rejected: the wake splice remains in the prefix. Replay, windowed prefix replace, and regenerate's later prompt can still restore or duplicate it as steering.

**Change timeline regenerate to resume the restored wake instead of prompting.** Rejected as the only fix: delete and regenerate share `deleteFrom`. Resume-on-delete would restart a turn the user asked to remove. A Host prefix that cannot replay the deleted question keeps every client safe.

**Make `deletionStart` itself consume trailing inbox splices.** Rejected: other callers use the turn boundary. Conversation truncation owns the extra walk.

## Consequences

Delete and regenerate no longer leave the deleted turn's wake splice in the retained prefix. Inbox cancel splices after truncate still appear when live inbox was rebuilt, and remain cheaper than a second send. Timeline regenerate still resubmits the original question once as a new followup, not as steering.

## Related

[Drain restored inbox splices after conversation truncation](2026-09-21-delete-from-restored-inbox.md) still owns the post-truncate inbox clear.

[Destructive session tail deletion](../feature/2026-09-10-destructive-session-tail-deletion.md) still owns turn-granular `deleteFrom`.
