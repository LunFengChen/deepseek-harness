# Agent Note: Fork dsh-context instead of remapping the official CLI package

Status: implemented

English | [中文](2026-09-11-fork-dsh-context.zh.md)

## Problem

`dsh-context` probes `$DSH_HOME/profiles` for `@deepseek-ai/dsh` and treats that version as the running harness. A leftover official CLI at `0.1.0-rc.8` trips the plugin's `0.1.2-rc.1` baseline gate even when this fork is `0.1.5-alpha.2`. Remapping `@deepseek-ai/dsh` onto `@x1a0f3n9/dsh` inside xfdsh made a third-party probe work by changing the kernel.

## Decision

xfdsh remaps only `@deepseek-ai/dsh-*` libraries. The official CLI name `@deepseek-ai/dsh` is left alone. Version detection is fixed in a fork of `bowenliang123/dsh-context` at `LunFengChen/dsh-context@0.49.6`, which reads `@x1a0f3n9/dsh` / `@xfcodeai/dsh` and fork library names before a leftover official CLI. The web-app bundle preinstalls that GitHub package.

## Alternatives considered

**Remap `@deepseek-ai/dsh` at launch.** Rejected: the CLI package is not a library import, and xfdsh should not special-case it so a third-party plugin's home probe succeeds.

**Delete leftover `@deepseek-ai/dsh` from the profile tree.** Rejected: official `dsh` and `xfdsh` may share session data, and wiping that install is not a product requirement.

**Keep npm `dsh-context@0.48.0` and patch it in this monorepo.** Rejected: the plugin is a separate GitHub product; the version probe belongs in that repository.

## Consequences

- Official plugins that import `@deepseek-ai/dsh-session` still remap onto this fork.
- `dsh-context` no longer treats a leftover official CLI as the running version.
- Preinstall tracks `github:LunFengChen/dsh-context#v0.49.6` instead of npm `dsh-context@0.48.0`.
