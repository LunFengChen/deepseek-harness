# Agent Note: Session and workspace rewind is a fork-native optional plugin

Status: implemented

English | [中文](2026-09-04-session-rewind.zh.md)

## Problem

Fork users need a faster alternative to creating a session fork when an answer or an edit should be retried. The feature must preserve the append-only session record, avoid claiming that every filesystem change can be restored, and load through the same Host/Client plugin seams as the rest of dsh.

## Decision

Add `@x1a0f3n9/dsh-rewind` under `packages/session/session-rewind` as a dual-face plugin. The Host half plans a rewind from the durable event log, appends a surface replacement marker, cancels an active run before execution, and restores durable pre-edit file checkpoints when the user selects workspace mode. The Client half contributes localized `/rewind` and `/undo` command flows plus a typed user-message action slot.

The Web bundle prebundles the plugin but sets `defaultEnabled: false`; Settings → Plugins can enable the same `session-rewind` Loader entry. A profile without the bundle can install the package through `xfdsh plugin --profile <name> add @x1a0f3n9/dsh-rewind`. The development scope is `@x1a0f3n9`; stable propagation will rescope the package to `@xfcodeai` without maintaining duplicate implementations or aliases.

Checkpoints are plugin-owned, atomically published, bounded to the newest 100 anchor groups per session, and reconciled against current file metadata before restore. The tracker covers supported `write`, `edit`, and mutating `str_replace_editor` calls. It does not promise to recover arbitrary shell commands, subagent-owned edits, or unknown external changes. True session deletion remains owned by the session controller.

## Alternatives considered

**Use a third-party rewind package unchanged.** Rejected: its package identity, profile metadata, and UI dependencies target a different release surface. The fork needs a package that follows the current scope, typed slots, locale ownership, and bundle catalog rules.

**Create a fork for every retry.** Rejected: it is slower and creates extra sessions when the user only wants to revise a message or restore tracked files.

**Rewrite or truncate the session log.** Rejected: the log is the audit record and other projections may depend on its append-only sequence. Rewind changes the active surface with an explicit marker instead.

**Promise complete workspace restoration.** Rejected: shell, subagent, and unrecognized external edits are not observable at the supported tool seam. The UI shows the known impact and reports conflicts rather than silently overwriting external changes.

## Consequences

The feature is opt-in in the shipped Web profile and is available through normal profile plugin installation. Conversation rewind works independently of checkpoint files; deleting checkpoint files removes file restoration only. The append-only log retains withdrawn events, so diagnostics can explain what was rewound. The implementation owns a clear extension seam but deliberately does not replace session deletion or add an undo stack.
