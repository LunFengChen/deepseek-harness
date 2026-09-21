# Agent Note: drain restored inbox splices after conversation truncation

Status: implemented

English | [中文](2026-09-21-delete-from-restored-inbox.zh.md)

## Problem

Regenerate deletes from a user-message seq, then prompts the original text as a new turn. `deletionStart` is turn-granular: it walks back to `turn/start`. The wake `agent/inbox/spliced` that admitted that user message is logged before `turn/start`. Truncation therefore keeps the splice and drops the claim. Replaying the prefix puts the original question back in the inbox. The regenerate `prompt('queue')` then appends a second copy. The first restored copy is claimed as the new user turn; the second sits in `next-turn` or is admitted mid-turn as steering, so the UI resends the question and then shows an interrupt.

The same live Agent still has `requestHeaderLogged`. Truncation also dropped `request/header`, so the next `prepareRequest` folded `undefined` and the new turn died before `user/message`.

## Decision

After `deleteFrom` truncates persistence and the live log, call `agent.inbox.clear()`. Empty lists are a no-op splice. Restored pre-turn splices belong to the deleted turn, not to later queued work (queued next-turn items while a turn is running are logged after `turn/start` and are already truncated).

When `prepareRequest` sees `requestHeaderLogged` but `session.requestHeader()` is missing, it clears the flag and seeds the declared route. The next header is `initial` on an empty prefix. The owning feature record is [destructive session tail deletion](../feature/2026-09-10-destructive-session-tail-deletion.md).

## Verification

`packages/api/session-controller/tests/commands-delete.host.spec.ts` runs a real AgentLoop turn, deletes from the user message, and asserts the inbox is empty. A second followup of the same text logs one user message, not two, and not steering.

`packages/core/agent-loop/tests/agent.spec.ts` truncates away the logged header, clears the restored splice, and still admits the followup user message.

## Alternatives considered

**Walk `deletionStart` back through contiguous inbox splices.** Rejected as the only fix: identifying which splices belong to the deleted turn is easy for the common wake-then-`turn/start` case and brittle for inject/cancel noise. Clearing after replay is the durable invariant.

**Fix only the timeline plugin's regenerate path.** Rejected: delete then prompt is a Host contract. Any client that truncates and resubmits hits the restored splice.

**Cancel with `keepInbox: false` instead of clearing after truncate.** Rejected: cancel runs before truncation. Clearing then still leaves the pre-turn splice in the kept prefix, which replay restores.

**Listen for `session/truncated` to reset driver flags.** Rejected as the only header fix: `prepareRequest` already reads the retained header. Treating a missing header as "not yet logged" is the local invariant; a truncate listener would duplicate that.

## Consequences

- Delete and regenerate no longer resurrect the truncated turn's user message as pending inbox work.
- QueueDock items that belonged to the deleted future remain gone with that future.
- Inbox cancel splices may appear after the truncated prefix when anything was restored; they are cheaper than a second send.
- A live Agent whose header was truncated can start the next turn instead of failing inside `prepareRequest`.
