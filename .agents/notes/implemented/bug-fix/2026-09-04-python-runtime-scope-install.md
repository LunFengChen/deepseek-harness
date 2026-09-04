# Agent Note: Keep the Python runtime closure on the active fork scope

Status: implemented

English | [中文](2026-09-04-python-runtime-scope-install.zh.md)

## Problem

The development scope rewrite updated the lockfile and build entry point to `@x1a0f3n9/dsh`, but `python/sdk-runtime/package.json` still declared the old `@deepseek-ai/dsh-*` workspace dependencies. A clean workspace install therefore failed before the Python runtime closure could be built. The runtime carrier documentation and node-mode launcher also named the old package path.

## Decision

Use the active fork scope consistently in the Python runtime closure manifest, node-mode launcher documentation, and launcher path description. Keep official package names in profile compatibility fixtures and user-facing profile manifests where they represent external plugin identities rather than workspace package dependencies.

## Alternatives considered

**Keep official workspace dependencies and add aliases:** rejected because the workspace must resolve one active product graph and aliases would conceal an incomplete scope migration.

**Leave the Python carrier path unchanged:** rejected because the generated development carrier contains the active scoped package and the documented path would fail at runtime.

## Consequences

A clean development-scope workspace install can resolve the Python runtime closure, and its explicit node mode points at `@x1a0f3n9/dsh`. The stable `@xfcodeai` branch retains the corresponding stable-scope paths. Official plugin compatibility remains explicit and does not create a second product runtime.
