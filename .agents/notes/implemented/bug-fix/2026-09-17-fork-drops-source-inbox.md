# Agent Note: fork drops the source agent's live inbox

Status: implemented

English | [中文](2026-09-17-fork-drops-source-inbox.zh.md)

## Problem

Fork copies a completed conversation prefix, including `agent/inbox/spliced` events that reconstruct the source agent's pending `next-turn` and `next-step` lists. A child created from an already-finished prefix then showed the parent's queued prompts as its own live input. Resume of the same session must keep those lists; fork must not. A fold that treats the inherited `session/end-seed` as a queue cut cannot reconstruct a child that already committed later splices against the surviving source queue.

## Decision

A seeded `agents.create` reconstructs the source queue from the prefix, then records `inbox.clear()` cancel splices after the inherited `session/end-seed` and before setup. The inbox fold itself is lossless over durable splices: an inherited or untagged `session/end-seed` does not empty the lists. Resume of a child that continued from the source queue therefore still applies those later splices. New forks start empty because their own cancel splices are in the log. The parent session is unchanged. Inbox reconstruction and claim lifecycle remain in [claimed pre-step inbox lifecycle](../architecture/2026-07-31-claimed-pre-step-inbox-lifecycle.md).

## Verification

`pnpm exec vitest run packages/core/agent-loop/tests/inbox.spec.ts packages/core/agent-loop/tests/agent.spec.ts`

## Alternatives considered

**Treat an inherited `session/end-seed` as a queue cut in the inbox fold.** That drops the source queue for a brand-new child without extra events, but it also empties the queue before later splices that still use the source coordinates. Reconstruction then fails with `invalid persisted inbox splice`.

**Skip every inherited splice by storing `inheritedEventCount` in fold state.** This needs a host-only field, a `stateVersion` bump, and a wire view that strips it. It still empties the queue at the current cut, so a child that continued from the source queue cannot resume.

**Strip inbox events from the fork seed.** Seq is the log position; dropping those rows would open a gap.

## Consequences

- Fork of a finished prefix starts with an empty inbox even when the copied prefix contains enqueue splices between turns.
- Resume of a forked child restores that child's later splices, including splices written against a source queue that survived the inherited marker.
- UI queue frames follow the inbox projection, so a new child does not inherit the source control-stream queue.
