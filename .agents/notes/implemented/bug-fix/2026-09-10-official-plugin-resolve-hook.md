# Agent Note: official plugins resolve onto fork packages at launch

Status: implemented

English | [中文](2026-09-10-official-plugin-resolve-hook.zh.md)

## Problem

Preinstalled community plugins import `@x1a0f3n9/dsh-session` and `@x1a0f3n9/dsh-settings`. Workspace overrides of the form `npm:@x1a0f3n9/dsh-*@workspace:*` created broken symlinks. `xfdsh web` then failed to load `dsh-context` and `dsh-better-sidebar`.

## Decision

Register a Node resolve hook at CLI launch that rewrites `@x1a0f3n9/dsh-*` specifiers to `@x1a0f3n9/dsh-*`. Source launch then resolves the fork packages through tsx path mapping. Do not replace those names with `link:packages/...` overrides: pnpm ignores a link whose package.json name does not match, and then fetches official registry packages.

## Verification

`pnpm exec vitest run packages/boot/app-boot/tests/official-package-resolve.spec.ts`

## Alternatives considered

**`link:packages/...` overrides for every workspace package.** Rejected: pnpm skipped the links and requested `@x1a0f3n9/dsh-client-locale` from npm.

**Drop the preinstalled plugins from the Web bundle.** Rejected: they should stay optional catalog rows once official imports resolve.

## Consequences

- Source-tree `xfdsh web` can load official community plugins from the Web bundle.
- Profile plugin installs still rewrite official dependency specs through `.pnpmfile.cjs`.
