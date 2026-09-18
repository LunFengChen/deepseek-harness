# Agent Note: Flush running status before prompt assembly and label turn phases

Status: implemented

English | [中文](2026-09-17-turn-preparing-status.zh.md)

## Problem

Enter wakes the driver and sets `running` in the same JavaScript turn as a long synchronous `assemble()` prefix. The prompt RPC, `session/event` follow, and `api-session/status` cannot flush until that prefix awaits. Chat then shows `chat.deepDiving` for the whole `running` window, including the wait before `step/start` and the wait after `step/end` while the next assemble is still in flight.

## Decision

After every inbox claim and before `systemPrompt.assemble()`, the driver awaits one `setImmediate` and then `signal.throwIfAborted()`. `followup()` still emits `turn/start` and `agent/inbox/claimed` synchronously. Chat derives a turn-status phase from host `running`, a local transcript submission echo, the last visible Chat node, and the last timeline step:

- a transcript echo while `running` is false is preparing
- a scheduled `model-retry` at the tip is retrying
- an open last step, a running assistant-step, or a running tool-call is generating (`chat.deepDiving`)
- otherwise, while `running` is true, preparing

Copy lives in `packages/client/ui-chat/src/client/locale.ts`. Claim-before-pre-step ownership stays in [claimed pre-step inbox lifecycle](../architecture/2026-07-31-claimed-pre-step-inbox-lifecycle.md). Host `running` remains the driver-level `api-session/status` fact.

## Testing

`packages/core/agent-loop/tests/agent.spec.ts` pins the post-claim `setImmediate` yield and cancel-during-yield. `packages/client/ui-chat/tests/chat-view.client.spec.tsx` pins preparing, retrying, and generating labels.

## Alternatives considered

**Derive `running` from `turn/end`.** Between steps the durable turn stays open and the driver is still running. Clearing `running` there would flicker the footer and hide the honest assemble wait.

**Yield with `Promise.resolve()`.** That is a microtask. Node still runs it before socket I/O. Only `setImmediate` lets the WebSocket flush.

**Defer the entire `kick()`.** `followup()` tests and observers require `turn/start` plus claim in the same synchronous turn.

**Restore retry bubbles via `resetForRetry`.** Hidden `assistant-step` on retry is the tested contract. Chat reads the scheduled retry node at the tip instead.

**Add `step/preparing` session events or put `running` on the control stream.** Those are later work. This change uses existing host status, history, and Chat nodes.

## Consequences

- Enter can paint `running` and preparing copy before assemble's synchronous prefix.
- After `step/end` with the turn still open, the footer says preparing rather than generating.
- Assemble duration of tens of seconds is still a separate performance track.
- Interrupted empty-tail chrome and control-stream `running` are unchanged.
