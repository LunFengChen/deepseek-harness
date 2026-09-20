# Agent Note: rewind UI no longer hangs on a running command card

Status: implemented

English | [中文](2026-09-10-rewind-running-command-hang.zh.md)

## Problem

The rewind, delete, and regenerate controls could leave the transcript on `rewind` / `执行中…`. The ↶ button executed `/rewind @seq both`, which appended `command/run`, truncated that event away, then skipped `command/done`. Delete and regenerate refused to run while the Agent was busy, so a live turn made those buttons look stuck too.

## Decision

UI rewind stops the live turn, restores files through the internal `/rewind __restore` probe when asked, then truncates with `deleteFrom`. Running rewind cards and internal probes are hidden. `deleteFrom` cancels a running turn before rewriting the log.

## Verification

`tests/hidden.client.spec.ts`, `tests/actions.client.spec.tsx`, and `tests/portals.client.spec.tsx` in [LunFengChen/dsh-session-timeline](https://github.com/LunFengChen/dsh-session-timeline), plus `pnpm exec vitest run packages/api/session-controller/tests/commands-delete.host.spec.ts`

## Alternatives considered

**Keep truncating inside `/rewind @seq both` and resync harder.** Rejected: `command/done` is skipped once `command/run` is gone, so the card stays running if the client still holds the live event.

**Show the running rewind card until settlement.** Rejected: a hung restore or idle wait pinned the whole session on "Running…".

## Consequences

- Conversation rewind, delete, and regenerate share `deleteFrom` after cancel.
- Workspace restore no longer truncates the session log from inside the slash-command handler.
- A failed executed `/rewind` remains visible; probes and unsettled rewind cards do not.
