# Agent Note: failover-queue add-row must not require a live session

Status: implemented

English | [中文](2026-09-19-failover-queue-model-catalog.zh.md)

## Problem

Settings → Failover rendered, but the add control looked empty. Two causes:

1. The client loaded candidates through `/failover __candidates`, which `remote.commands.execute` can only run against a session id. A new-session page has none.
2. A native `<select>` stays on the placeholder when closed, and its popup is unreadable in the dark settings modal.

## Decision

`v0.1.8` reads `session/modelCatalog` first, the same Host-generation catalog the composer model picker uses. The slash command remains a fallback when a session id exists and the catalog is empty. The add control is a button that shows the candidate count and opens a searchable list above the input. xfdsh pins `github:LunFengChen/dsh-failover-queue#v0.1.8`.

## Verification

On a new-session page, Settings → Failover shows `选择一条路由（N）`. Opening it lists configured providers above the input. Adding `xfcodeai-grok / Grok 4.6` writes P1 into the queue.

## Alternatives considered

**Keep the slash command and create a throwaway session to run it.** Rejected: listing models is a Host-generation catalog, not session state.

**Inject `sessions` and wait for a current session.** Rejected: the Settings page must work from 新会话.

**Keep the native `<select>` once the catalog is loaded.** Rejected: a closed select still looks empty, and the OS popup is clipped or unreadable in the modal.

## Consequences

- The queue stays empty until the user adds a route. The add control is no longer empty for lack of a session, and it no longer looks empty when options exist.
- `v0.1.6` still shows an empty select on 新会话 if someone pins it again.
