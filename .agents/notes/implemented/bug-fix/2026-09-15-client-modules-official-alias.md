# Agent Note: Restore official dsh aliases in the browser module table

Status: implemented

English | [中文](2026-09-15-client-modules-official-alias.zh.md)

## Problem

The Web client seeds platform modules under `@x1a0f3n9/dsh-*`. Community client plugins, including preinstalled `dsh-context`, still `require("@deepseek-ai/dsh-client-ui-primitives")`. `packages/client/modules/src/package-alias.ts` used the fork prefix for both sides of that map, so the require missed the module table and the UI reported "Failed to load plugins".

## Decision

The browser module table maps `@deepseek-ai/dsh-*` onto `@x1a0f3n9/dsh-*` and back. The official CLI name `@deepseek-ai/dsh` is not a library prefix and stays unmapped. Host-side Node resolution and profile `.pnpmfile.cjs` already rewrite the same library names; this restores the browser half.

## Alternatives considered

**Rebuild every community plugin against `@x1a0f3n9/dsh-*`.** Preinstalled plugins may still be forked for product fixes. Official plugins must load without a second compile.

**Seed both official and fork names in HTML.** That duplicates every platform module and still leaves plugin factories requiring the official spelling.

## Consequences

- `dsh-context` and other official-scope client plugins resolve `@deepseek-ai/dsh-client-ui-primitives` onto the seeded fork module.
- Tests pin both directions of the alias, including that `@deepseek-ai/dsh` is not rewritten.
