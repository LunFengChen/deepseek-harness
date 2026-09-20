# Agent Note: destructive truncate must drop routed live events

Status: implemented

English | [中文](2026-09-16-session-truncate-live-seq.zh.md)

## Problem

Rewind, delete, and regenerate rewrite the durable log to an earlier prefix, then truncate the live `Session`. The JSONL writer also buffers `session/event` traffic for up to 200 ms. Events that land after `drainLive()` returns — during the rewrite, or between durable truncate and memory truncate — keep their old `seq`. The next `session/flush` then fails with `append seq mismatch` (`expected <retained> at index 0, got <old seq>`), the failed batch stays buffered, and every later turn in that process fails the same way. The Web UI looks frozen after the user types.

Projection unit cells had the same gap: they only advanced on `session/event`, so a watermark past the truncated log skipped every new event until `seq` exceeded the old tail.

## Decision

JSONL `truncate` drops routed live events at or past the retained length after the rewrite. A store-attached `Session.truncate` emits `session/truncated` once the live log already has that length. Persistence discards the same tail again. Projection cells, the projection cache, the token-meter replay fold, the runtime-context snapshot, and in-flight session-title generation whose watermark is past the cut all rebuild or abort from the retained prefix. `deleteFrom` still rewrites storage first, then memory. The owning feature record is [destructive session tail deletion](../feature/2026-09-10-destructive-session-tail-deletion.md).

## Verification

`pnpm exec vitest run packages/session/session-persistence-jsonl/tests/jsonl.spec.ts packages/session/session-persistence/tests/live-write-contract.ts packages/core/session/tests/session.spec.ts packages/session/session-projection/tests/registry.spec.ts packages/session/session-projection-cache/tests/cache.spec.ts packages/llm/token-meter/tests/token-meter.spec.ts packages/core/agent-loop/tests/runtime-context.spec.ts packages/session/session-title/tests/provider.spec.ts`

## Alternatives considered

**Renumber live events onto the new cursor.** Rejected: seq is the log position. Ghost tail events are discarded history, not a prefix to continue.

**Truncate the live `Session` before persistence.** Rejected: a crash between the two steps would resume from the longer durable log and undo the rewind. Storage still leads; `session/truncated` repairs in-process buffers that storage cannot see until memory shrinks.

**Silently skip gapped batches in `persistContiguous`.** Rejected: a gap without truncate is still corruption and must fail loudly. Only an explicit retained-length cut drops the tail.

## Consequences

- Rewind on a large session can still take as long as the rewrite; it no longer poisons later flushes.
- `session/truncated` is process-local, like `session/created`. It is not a log event and does not bump `SESSION_FORMAT_VERSION`.
- A process that already has a poisoned live buffer still needs a restart; the durable prefix is usable after that.
