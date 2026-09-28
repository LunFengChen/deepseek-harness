# Agent Note: restore shared session home after 0.1.7

Status: implemented

English | [中文](2026-09-28-restore-shared-session-home.zh.md)

## Problem

Upstream 0.1.7 replaced `dsh-settings-file` with profile-backed `dsh-settings` and restated durable roots as `dshHomePath(...)`. xfdsh sets `DSH_HOME` to `~/.xfdsh`, so following that restatement would store sessions, attachments, workspace storage, and API keys under the plugin home instead of the shared official `~/.dsh` tree.

## Decision

Keep the 0.1.7 settings service. Point credentials, session persistence, attachments, and JSON storage back at `dshSessionPath()`, which reads `DSH_SESSION_HOME` and defaults to `~/.dsh`. Leave plugin and profile files under `DSH_HOME`.

## Verification

`packages/bundle/base/tests/base.spec.ts` asserts the four `!!js dshSessionPath(...)` roots. `apps/cli/tests/fork-defaults.spec.ts` still pins `DSH_HOME=~/.xfdsh` and `DSH_SESSION_HOME=~/.dsh`.

## Alternatives considered

**Restore `dsh-settings-file`.** Rejected: 0.1.7 deleted that package from the composition. Model forms now write the active profile patch.

**Leave `dshHomePath` and tell users to copy `~/.dsh`.** Rejected: the fork already promised shared history without a migration.

## Consequences

- `xfdsh web` keeps reading `~/.dsh/sessions` and `~/.dsh/.credentials.yaml`.
- Plugin enablement and 0.1.7 model forms stay in `~/.xfdsh/profiles/web`.
- Official `dsh` and `xfdsh` still share transcripts and keys; they no longer share a single `settings.yaml`.
