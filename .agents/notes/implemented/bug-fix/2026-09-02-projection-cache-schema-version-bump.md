# Agent Note: Invalidate projection-cache records after identity schema changes

Status: implemented

English | [中文](2026-09-02-projection-cache-schema-version-bump.zh.md)

## Problem

The projection-cache identity gained `isSeeded` and `inheritedEventCount` when session sequence and log-offset types were separated, but the `session_projcache` domain version stayed at `5`. Records written with version `5` therefore reached the current record schema and stopped startup with `invalid-record` instead of being treated as disposable stale cache data.

## Decision

The `session_projcache` domain version is `6`. The per-record JSON backend now sees documents written with version `5` as stale and omits them before the storage-domain schema parser runs. The cache then refolds those sessions from their session logs, while unrelated version-`6` records remain available. The durable per-session layout and its stale-record semantics remain the authority in [the per-session projection-cache decision](../architecture/2026-08-19-projection-cache-per-session-files.md).

Every future change to the persisted checkpoint record or row schema increments this domain version; cache records are disposable and are not migrated when their version changes.

## Alternatives considered

**Make the new identity fields optional or default them.** A missing value cannot distinguish an old record from a valid lifecycle identity, so accepting it could seed a projection from an unrelated log. The cache must reject ambiguity rather than reconstruct identity from incomplete data.

**Swallow schema errors in the storage-domain layer.** Invalid-record failures are a general storage-domain signal, and hiding them there would weaken schema enforcement for domains that cannot safely refold. The per-record backend already owns the cache-specific stale-document behavior.

**Migrate version-`5` records.** The old record does not contain enough information to recover the new identity fields safely. Discarding the derived checkpoint and replaying the authoritative session log is the smaller and safer recovery.

## Consequences

Users with existing version-`5` projection-cache files pay one cache miss per affected session after upgrading; `dsh web` can start and rebuild those rows normally. A regression test preserves the old record format and verifies that opening the cache succeeds and serves no stale snapshot. The version bump must accompany every future persisted checkpoint schema change.
