---
description: "Conversation and workspace rewind for persisted dsh sessions, with durable file checkpoints and explicit restore confirmation."
kind: "package-reference"
---

# @x1a0f3n9/dsh-rewind

English | [中文](README.zh.md)

## Summary

`@x1a0f3n9/dsh-rewind` is an optional Web plugin for persisted dsh sessions. It rewinds the model-visible conversation to a selected human message and can restore workspace files from durable pre-edit checkpoints. Rewind appends an auditable surface marker; it does not rewrite or delete the session log. This is separate from the true session deletion command, which removes the selected session and later history.

The plugin is prebundled by the fork Web profile and disabled by default. Users enable it from **Settings → Plugins**, or install it as a profile plugin when using a profile that does not include the Web bundle.

## Table of Contents

- [Use this package](#use-this-package)
- [Configuration](#configuration)
- [Storage and safety](#storage-and-safety)
- [Understand the implementation](#understand-the-implementation)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

### Enable the prebundled Web feature

Start the fork Web profile, open **Settings → Plugins**, and enable **Workspace rewind**. The feature is installed with the Web bundle but remains opt-in so deployments do not add the extra UI and checkpoint writes unexpectedly.

### Install into another profile

```sh
xfdsh plugin --profile web add @x1a0f3n9/dsh-rewind
```

The package exports a `dsh.bundle` patch, so the profile installer can mount it through the normal plugin mechanism. The stable `master` line will publish the same source as `@xfcodeai/dsh-rewind`; the development line uses `@x1a0f3n9/dsh-rewind`. The repository directory is `packages/session/session-rewind` in the fork repository.

### Rewind a conversation

1. Open a user message and click its **↶** action.
2. Choose **conversation only** or **conversation and workspace**.
3. Review the file impact list and confirm the workspace restore when that mode is selected.
4. The selected message and everything after it are withdrawn from the model-visible surface, and the selected user text is placed back in the composer for editing and resubmission.

The `/rewind` and `/undo` commands provide the same flow for keyboard users. Rewind cancels an active run before applying the marker and serializes concurrent requests per session.

-----

<a id="configuration"></a>
## Configuration

The host plugin accepts these optional fields:

| Field | Meaning | Default |
|---|---|---|
| `snapshotDir` | Exact directory for file checkpoints | `$DSH_REWIND_SNAPSHOT_DIR` or the dsh home snapshot directory |
| `dshHome` | Harness home used to derive default storage paths | `DSH_HOME` or `~/.dsh` |
| `dedup` | Deduplicate identical pre-edit contents | `true` |

The Web profile also exposes a **Snapshot cleanup** settings card. Automatic cleanup is off by default; when enabled, it removes snapshots for sessions older than the configured inactive-age threshold, never the session log itself.

-----

<a id="storage-and-safety"></a>
## Storage and safety

File checkpoints are stored below `<dsh home>/rewind-snapshots/`, with a bounded history of the newest 100 anchor groups per session. Writes use temporary files and atomic publication. A restore checks the current file state before replacing it; an external modification is reported as a conflict instead of being silently overwritten.

The plugin tracks supported write-class tool calls (`write`, `edit`, and mutating `str_replace_editor` operations). It does not promise to capture arbitrary shell commands, subagent-owned edits, or unknown external changes. Therefore it cannot guarantee that every workspace file can be restored. Review the impact list before confirming a workspace restore.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

The Host half listens to command and tool seams. It creates a pure rewind plan from the session event log, appends a surface replacement marker, and restores checkpointed files after the session is idle. The Client half registers localized command decoration and a typed conversation action slot; it does not modify the chat DOM directly.

Snapshot data is owned by the plugin and is independent of session persistence. The append-only log remains the audit record, while the surface projection hides withdrawn events from later model requests and the Web transcript. True deletion remains owned by the session controller and is not implemented by rewind.

-----

<a id="model-experience"></a>
## Model Experience

### Rewind continuation

#### What the model sees

The next agent request is rebuilt from the selected human message onward after the `surfaceOp` rewind marker. Withdrawn messages and later tool activity are excluded from the active surface, while the append-only log remains available to persistence and diagnostics.

#### Token effect

The first request after a rewind can use fewer input tokens because withdrawn history is omitted. The plugin adds no prompt instructions or tool schemas of its own; the exact reduction depends on the selected target and the provider request.

#### KV Cache effect

Rewinding changes the request prefix at the selected target, so provider cache reuse after the first changed token is provider-specific and may be reduced.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- Workspace restore is limited to supported write-class tool calls and tracked paths; shell, subagent, and unrecognized edits are outside the capture guarantee.
- A rewind is intentionally not an undo stack. The append-only marker can be audited, but applying a later rewind does not restore a previously withdrawn surface automatically.
- Removing checkpoint files disables file restoration for those files, while conversation rewind remains available.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The package follows the fork package scope on the development branch. Rescoping to `@xfcodeai/dsh-rewind` belongs to the stable release propagation, not to a second implementation or compatibility alias.

</details>
