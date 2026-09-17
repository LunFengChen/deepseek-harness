# Agent Note: fork drops the source agent's live inbox

Status: implemented

English | [中文](2026-09-17-fork-drops-source-inbox.zh.md)

## Problem

Fork copies a completed conversation prefix, including `agent/inbox/spliced` events that reconstruct the source agent's pending `next-turn` and `next-step` lists. A child created from an already-finished prefix then showed the parent's queued prompts as its own live input. Resume of the same session must keep those lists; fork must not.

## Decision

The inbox projection treats an inherited `session/end-seed` as the end of the source agent's live queue. Folding that marker returns empty `next-turn` and `next-step` lists. Later splices on the child remain. An untagged resume `session/end-seed` does not clear the lists. The parent session is unchanged. The durable splice history stays in the inherited prefix; only the child's live pending input is empty. Inbox reconstruction and claim lifecycle remain in [claimed pre-step inbox lifecycle](../architecture/2026-07-31-claimed-pre-step-inbox-lifecycle.md).

## Verification

`pnpm exec vitest run packages/core/agent-loop/tests/inbox.spec.ts`

## Alternatives considered

**Skip every inherited splice by storing `inheritedEventCount` in fold state.** This needs a host-only field, a `stateVersion` bump, and a wire view that strips it. The inherited end-seed already marks that cut.

**Append clearing splices after `agents.create`.** The child would briefly reconstruct the parent queue, then log extra mutations. The inherited marker already runs in the same fold.

**Strip inbox events from the fork seed.** Seq is the log position; dropping those rows would open a gap.

## Consequences

- Fork of a finished prefix starts with an empty inbox even when the copied prefix contains enqueue splices between turns.
- Resume of a forked child still restores that child's own later splices, because the inherited marker already emptied the parent queue before those splices.
- UI queue frames follow the inbox projection, so a new child does not inherit the source control-stream queue.
