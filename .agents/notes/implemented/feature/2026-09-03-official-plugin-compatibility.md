# Agent Note: Official plugin compatibility in xfdsh profiles

Status: implemented

English | [中文](2026-09-03-official-plugin-compatibility.zh.md)

## Problem

Official dsh plugin bundles can retain `@deepseek-ai/dsh-*` dependency names and browser module requests. Rejecting those bundles made plugins that work in the upstream product unusable in xfdsh, while installing both namespaces independently could create two incompatible runtime instances.

## Decision

Profile initialization writes a profile-local `.pnpmfile.cjs`. Its `readPackage` hook rewrites official dsh dependency specs in `dependencies`, `optionalDependencies`, and `peerDependencies` to npm aliases for the matching `@x1a0f3n9/dsh-*` package. The dependency key remains the official name, so existing plugin imports continue to resolve while Node receives the fork implementation. Non-registry specs are left unchanged and an unavailable matching fork package remains an explicit pnpm installation failure.

The browser client module system applies the same mapping to official dsh module requests, but only when the matching fork seed, graph row, or registered factory is present. This lets official client bundles request their original names while materializing the single fork module instance; unrelated official rows remain resolvable when no fork counterpart is served.

## Alternatives considered

**Rejecting all official package names:** this preserves a single namespace but needlessly excludes plugins that only retain upstream import names.

**Installing official and fork packages side by side:** this maximizes nominal package compatibility but can create duplicate Loader registries and incompatible service instances, so aliasing official names to fork packages is safer.

## Consequences

- `xfdsh plugin --profile <name> add <official-plugin>` can install official bundles that depend on upstream dsh product packages.
- Existing profiles receive the hook on launch; `xfdsh plugin --profile <name> install` rebuilds installed aliases after upgrading.
- The fork does not retain the old `x1a0f3n9` namespace and does not silently combine official and fork dsh runtimes.
- Official plugin releases that depend on an unpublished or missing fork package still fail during installation rather than failing later with an ambiguous module error.
