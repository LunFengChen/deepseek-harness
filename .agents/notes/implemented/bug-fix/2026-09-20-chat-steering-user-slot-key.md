# Agent Note: Dispatch admitted steering Chat nodes through the user keyed occupant

Status: implemented

English | [中文](2026-09-20-chat-steering-user-slot-key.zh.md)

## Problem

A mid-turn interrupt is Chat kind `steering`. ChatNodeSeat dispatches `conversation.chat.node` by `entryKey`. Pending steering is a dedicated bubble, so interrupt send looks like a user message while the turn is still generating. After admission, a missing `steering` keyed occupant falls through to the seat fallback. When that fallback is the unknown-surface JsonBlock, the durable row becomes `未知 surface 事件：steering` instead of a right-aligned user bubble. Rewind, delete, and regenerate live on `conversation.chat.user-actions`, which the missing-occupant fallback does not render.

Tests that switch on `node.kind` still paint `UserMessageNodeView` even when `entryKey` is `steering` and no such occupant exists. Kind `steering` remains the durable classification for CSS, Turn-process independence, and rewind candidates.

## Decision

ChatNodeSeat maps user-style nodes (`user` and `steering`) to keyed entry `user`. The seat wrapper still sets `[data-chat-flow-kind=steering]`. `UserMessageNodeView` already accepts both kinds and renders `conversation.chat.user-actions`. The missing-occupant fallback remains `UserMessageFallbackView` for user-style nodes and the unknown-surface JsonBlock for other kinds, as in [Render missing keyed steering Chat nodes as user bubbles](2026-09-18-chat-steering-unknown-surface.md). Node kind stays `steering`; only the slot key is shared.

This partially supersedes the rejected "alias missing steering to keyed user" alternative in that note. The alias applies to `entryKey`, not to `node.kind`.

## Testing

`packages/client/ui-chat/tests/chat-view.client.spec.tsx` pins a settled steering node as a user bubble with `[data-chat-flow-kind=steering]` and no unknown-surface label. A second case throws if `entryKey` is `steering` and expects the user occupant. Pending-to-durable handoff keeps the user bubble after the turn closes. The missing-renderer fallback path still paints `UserMessageFallbackView` for steering and dumps `tool-call`.

## Alternatives considered

**Keep dispatching `entryKey` as `node.kind` and rely on the steering occupant plus fallback.** Rejected: the product path already has a working user occupant with user-actions. A second key is an extra live-ledger requirement; fallback without that occupant omits rewind, delete, and regenerate.

**Collapse Chat kind `steering` into `user`.** Rejected: rewind, CSS, Turn-process independence, and conversation-node tests already distinguish `steering`. The dump is a keyed dispatch miss, not a wrong kind.

**Keep the unknown-surface dump after settle.** Rejected: interrupt send is a user message. A JsonBlock of node data is not an acceptable Chat row.

## Consequences

- Admitted steering uses the same keyed renderer as ordinary user messages, including user-actions.
- Kind `steering` remains on the node and the seat wrapper.
- The `steering` keyed registration stays available for an occupant that wants a distinct renderer; ChatNodeSeat does not select it.
- `message.unknownSurface` remains the dump for Chat kinds that are not user or steering.
