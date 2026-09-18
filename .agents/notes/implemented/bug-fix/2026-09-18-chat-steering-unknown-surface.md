# Agent Note: Render missing keyed steering Chat nodes as user bubbles

Status: implemented

English | [中文](2026-09-18-chat-steering-unknown-surface.zh.md)

## Problem

A mid-turn interrupt is a durable `user/message` classified as Chat kind `steering`. ChatNodeSeat dispatches that kind through the keyed `conversation.chat.node` slot. When the live keyed ledger has no `steering` occupant, the seat fallback was a JsonBlock labeled `message.unknownSurface` with type `steering`. Interrupt send then showed a debug dump instead of a right-aligned user bubble.

Classification, pending steering, and the registered `UserMessageNodeView` already treat admitted steering as a plain user bubble. The dump appears only on the missing-key path. Collapsing kind `steering` into `user` would churn Turn-process independent kinds, `[data-chat-flow-kind='steering']`, rewind candidate selection, and snapshot tests.

## Decision

Keep kind `steering`. Keep the keyed renderer on `UserMessageNodeView`, including the `conversation.chat.user-actions` child list. When that keyed occupant is absent, ChatNodeSeat renders `UserMessageFallbackView`: the same user-style bubble and copy actions, without the user-actions list. Other Chat kinds still use the unknown-surface JsonBlock. Node assembly stays the user/steering/context split in [client Conversation business-node assembly](../architecture/2026-08-09-client-conversation-node-assembly.md).

## Testing

`packages/client/ui-chat/tests/chat-view.client.spec.tsx` pins a `steering` node whose `renderSlot` always returns the seat fallback: the typed text is in a user bubble, and the unknown-surface label is absent. The same missing-renderer path still dumps `tool-call`. Existing consumed-steering bubble coverage in `packages/client/ui-chat/tests/chat-branch-tails.client.spec.tsx` is unchanged.

## Alternatives considered

**Classify claimed steering as kind `user`.** Rejected: rewind, CSS, Turn-process independence, and conversation-node tests already distinguish `steering`. The dump is a missing keyed occupant, not a wrong kind.

**Reuse `UserMessageNodeView` from the seat fallback.** Rejected: that view calls `renderSlot('conversation.chat.user-actions')`, which the Chat view binding does not authorize. The fallback must not pretend the child list exists.

**Alias missing `steering` to keyed `user`.** Rejected: it would lie about `node.kind` to the user renderer. The product path still registers both keys; the fallback is degradation, not a second dispatch.

**Keep the unknown-surface dump.** Rejected: interrupt send is a user message. A JsonBlock of node data is not an acceptable Chat row.

## Consequences

- Interrupt send still looks like a user bubble when the keyed `steering` renderer is missing.
- Rewind, delete, and regenerate on that row still require the keyed renderer plus session-timeline user-actions. The fallback omits those actions.
- `message.unknownSurface` remains the dump for Chat kinds that are not user or steering.
