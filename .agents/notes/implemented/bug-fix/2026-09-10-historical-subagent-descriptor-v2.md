# Agent Note: Historical subagent descriptor version 2

Status: implemented

English | [中文](2026-09-10-historical-subagent-descriptor-v2.zh.md)

## Problem

Released v0-to-v3 restore refuses a Session when `subagent/descriptor` still carries payload version 2. Current writes stamp version 3. Shared `~/.dsh` child logs and parent logs that embed those children then fail to open.

## Decision

v0-to-v1 stamps historical descriptor version 2 onto version 3 before payload validation. The payload fields are the current ones. Unknown descriptor versions still refuse with `SessionFormatUnsupportedMigrationError`. The original v0 generation is unchanged.

## Alternatives considered

**Keep version 2 in the successor.** `foldSubagentDescriptor` would return undefined, so those children could not be classified.

**Admit every non-3 version.** Future descriptor layouts would be treated as current.

**Rewrite the stored v0 file.** Adjacent migration forbids overwriting a committed generation.

## Consequences

Sessions whose descriptors still say version 2 restore. Persistence may publish a successor generation on a successful open. [Legacy normalization tests](../../../../packages/session/session-format-v0-to-v1/tests/legacy.spec.ts) cover the stamp and the unknown-version refusal. [Catalog restore](../../../../packages/session/session-format-catalog/tests/catalog.spec.ts) covers the production v0-to-v3 path.
