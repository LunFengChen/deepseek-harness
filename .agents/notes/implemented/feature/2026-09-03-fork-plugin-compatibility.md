# Agent Note: Shared profiles and fork-aware plugin compatibility

Status: implemented

English | [中文](2026-09-03-fork-plugin-compatibility.zh.md)

## Problem

The fork publishes its own `@xfcodeai/dsh-*` package namespace, but profile directories and session history remain shared through `$DSH_HOME`. A plugin installed by `xfdsh` must therefore be visible to the same profile without making an upstream-only plugin appear to work until boot.

## Decision

`xfdsh plugin --profile <name> ...` keeps using the shared `$DSH_HOME/profiles/<name>` directory. The profile loader accepts fork packages and external Cordis bundles whose runtime, peer, and optional dependencies do not use the old `@deepseek-ai/dsh-*` product namespace. It rejects a listed bundle that declares an upstream product package and reports the incompatible names plus the fork-compatible installation choices.

The compatibility check does not reject upstream-scoped vendor packages such as Cordis, does not rewrite npm package names, and does not promise compatibility for plugins that import private upstream modules without declaring them. Exact shipped profiles created with the official `@deepseek-ai` scope or the previous fork scope are rewritten to the current `@xfcodeai` built-in names; user-added bundle lists are left untouched. Fork-native plugins must publish against `@xfcodeai/dsh-*`; generic bundles should depend on stable Cordis or other public interfaces.

## Alternatives considered

**Use a separate `~/.xfdsh` home.** This would isolate plugins but also split the user's profiles and history, contrary to the shared-history requirement.

**Silently alias `@deepseek-ai/dsh-*` to `@xfcodeai/dsh-*`.** Package aliases can duplicate peer and singleton dependencies and cannot guarantee compatibility for private imports, so the fork fails clearly instead of creating a partially working runtime.

## Consequences

A plugin installed by either launcher is recorded in the same profile when both use the same `$DSH_HOME`. Upstream product plugins require a fork-native release or the official `dsh` installation; portable Cordis bundles continue to work when their declared runtime dependencies avoid the old product namespace. Existing profiles containing an incompatible bundle fail with an actionable error until the dependency is replaced or removed.
