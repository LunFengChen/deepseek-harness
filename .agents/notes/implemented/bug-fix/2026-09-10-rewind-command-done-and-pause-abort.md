# Agent Note: rewind command/done walk-back and pause abort

Status: implemented

English | [中文](2026-09-10-rewind-command-done-and-pause-abort.zh.md)

## Problem

Rewind failed when the selected seq was a `command/done` (or any non-human event other than `assistant/message`) with `session event at seq N is not a human user message (command/done)`. Pause during an in-flight rewind cancelled the live Agent turn but not the slash-command execute, so the handler could truncate away `command/run` and leave the UI stuck on an executing command card.

## Decision

`planRewind` walks any non-human target back to the nearest preceding human `user/message`. Session pause calls `commands.abortInflight(agent)` so the rewind handler sees `invocation.signal` abort, returns cancelled, and does not restore files or truncate the log.

## Verification

`tests/rewind.spec.ts` in [LunFengChen/dsh-session-timeline](https://github.com/LunFengChen/dsh-session-timeline) covers `command/done` walk-back. `pnpm exec vitest run packages/interaction/commands/tests/commands.spec.ts` covers `abortInflight` settling `command/done`.

## Alternatives considered

**Keep rejecting every non-assistant target.** Rejected: UI buttons and `/rewind @seq` land on command cards, and the failure left the session unusable.

**Let pause cancel only the Agent turn.** Rejected: rewind is a slash command, so the unpaired `command/run` stays after the log is truncated.

**Sanitize or rewrite historical rewind dirt in the session log.** Rejected earlier: dirty events are stripped from the local artifact, and this change stops new unpaired `command/run` rows.

## Consequences

- Rewind from a command card or assistant answer truncates from the human prompt that opened that turn.
- Pause during rewind settles the command as cancelled and leaves the log untruncated.
