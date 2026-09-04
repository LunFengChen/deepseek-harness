# Agent Note: Development branch npm scope

Status: implemented

English | [中文](2026-09-04-development-npm-scope.zh.md)

## Problem

The fork needs an independently installable development package line while the stable fork line uses a different npm scope. Mixing package names from the two lines leaves workspace links, profile bundles, release checks, and generated TypeScript paths inconsistent.

## Decision

The development branch publishes every harness workspace package under `@x1a0f3n9/dsh-*`, including the CLI package `@x1a0f3n9/dsh`. Its executable remains `xfdsh`, so the command name distinguishes the fork from upstream `dsh`. Official `@deepseek-ai/dsh-*` plugin dependencies remain accepted only through the existing compatibility mapping to the matching development package. The vendored Cordis and native package scopes are unchanged.

The stable fork scope is a separate branch concern: it uses the same source organization with `@xfcodeai/dsh-*` package names and must be released independently. Neither scope is installed alongside the other in one workspace tree.

## Alternatives considered

**Keep the upstream `@deepseek-ai/dsh-*` names:** this would make the development branch collide with upstream packages and would not provide an independently installable fork.

**Publish development packages under the stable `@xfcodeai` scope:** this would mix unreleased development artifacts with the stable package line and make CI publication ambiguous.

**Use both fork scopes in one workspace:** this would create duplicate package identities and can load two copies of runtime registries, so scope separation is safer.

## Consequences

- Development package manifests, imports, workspace paths, profile defaults, lockfile entries, release checks, and documentation consistently use `@x1a0f3n9`.
- `npm install --global @x1a0f3n9/dsh` installs the `xfdsh` launcher; one-off use can run `npx --package @x1a0f3n9/dsh xfdsh web`.
- The stable `@xfcodeai` line still requires its own scope-rescope branch and release publication before it is ready for users.
- Official plugin packages are still compatible through explicit aliasing; an unavailable matching fork package fails at installation instead of silently loading two runtimes.
