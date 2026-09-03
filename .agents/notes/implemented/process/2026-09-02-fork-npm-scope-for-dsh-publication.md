# Agent Note: Fork npm scope for dsh publication

Status: implemented

English | [中文](2026-09-02-fork-npm-scope-for-dsh-publication.zh.md)

## Problem

A fork cannot publish the first-party dsh packages under the upstream `@deepseek-ai` scope without credentials owned by that organization.

Keeping the upstream scope in package names would make the fork's release instructions depend on upstream registry access and would prevent an independent user-facing npm installation path.

## Decision

The first-party dsh release family uses the `@x1a0f3n9` scope: the launcher is `@x1a0f3n9/dsh`, the workspace root is `@x1a0f3n9/dsh-root`, and every publishable package under `packages/*/*` and `apps/*` uses `@x1a0f3n9/dsh-*` or an application package name under that scope. The published launcher executable is `xfdsh`, so it can coexist with the official `dsh` command.

All current source imports, manifests, lockfile entries, Cordis configurations, tests, snapshots, generated catalogs, and active documentation use the `@x1a0f3n9` dsh names. The pre-release repository has no compatibility aliases for the former dsh names.

The vendored Cordis framework remains under `@deepseek-ai` because it is a separate vendored release family with its own upstream rescope and publication rules. The native Landlock packages also remain under `@deepseek-ai` because they are a separate release family and are not part of this dsh scope migration.

The existing release sequence remains unchanged apart from the dsh scope: run the dsh build, verify the dsh family, pack its tarballs, test the packed installation, then publish the version from the fork's npm credentials. The release family validator now checks `@x1a0f3n9` for dsh members and `@deepseek-ai` for vendor members instead of assuming one scope for every family.

## Alternatives considered

**Keep dsh under `@deepseek-ai`.** Rejected: a fork cannot provide an independent installation path without upstream organization credentials, and publishing under a name the fork does not own is unsafe.

**Use unscoped package names.** Rejected: unscoped names are harder to reserve consistently, do not identify the fork owner, and would require a second repository-wide rename before the first release.

**Rename vendor and native packages at the same time.** Rejected: those are independent release families with separate publication and upstream-vendoring rules. Combining them would expand the release surface without solving the dsh fork's ownership problem.

**Keep compatibility packages under the former dsh names.** Rejected: the pre-release repository deliberately avoids carrying compatibility aliases, and aliases would require ownership of the upstream scope while preserving two package vocabularies.

## Consequences

Consumers of this fork install `@x1a0f3n9/dsh` rather than `@deepseek-ai/dsh`. Existing package imports using the former dsh names must be updated when moving to this fork.

The dsh package family can be published independently when the `@x1a0f3n9` npm scope is owned and authenticated by the fork maintainer. Vendor and native publication still require their own `@deepseek-ai` release ownership unless those families receive a later, separate scope decision.

Historical archived Agent Notes retain their original package names and are not rewritten; active notes and current generated references describe the names shipped by this repository.
