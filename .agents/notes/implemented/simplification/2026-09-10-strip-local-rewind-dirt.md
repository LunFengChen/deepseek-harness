# Agent Note: Strip rewind dirt from local sessions

Status: implemented

English | [中文](2026-09-10-strip-local-rewind-dirt.zh.md)

## Problem

Historical rewind markers left ghost `step/start` after `turn/end`, skipped turn numbers, leftover v1 `sourceEventSeqs`, and rewind-marker assistant messages. Shared `~/.dsh` sessions then failed to open. Admitting those logs in restore would keep a permanent compatibility path for dirty files.

## Decision

Local session files were backed up, then rewritten as current v3 successors. Ghost steps, rewind-marker messages, unpaired rewind commands, and skipped turn numbers were removed from the successor. The original v0 generation is unchanged. Restore again refuses closed-turn ghost steps, turn-number skips, and leftover v1 provenance with no open chunk attempt. `legacyInterruptedTurnRestart` and historical subagent descriptor stamping stay.

## Alternatives considered

**Admit rewind dirt in restore.** That keeps a permanent compatibility path for files that can be cleaned once.

**Sanitize during restore without rewriting files.** Every open would re-interpret dirty v0 logs.

**Overwrite the v0 generation.** Adjacent migration forbids deleting or rewriting a committed generation.

## Consequences

Local `~/.dsh/sessions` all have a current v3 successor. Dirty v0 logs that were never baked still refuse. Relationship, catalog, admission, and v1-to-v2 migration tests pin the refusals.
