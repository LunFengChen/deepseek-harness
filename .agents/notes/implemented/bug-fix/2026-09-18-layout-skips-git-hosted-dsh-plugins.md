# Agent Note: layout verifier must not rewrite git-hosted dsh plugins

Status: implemented

English | [中文](2026-09-18-layout-skips-git-hosted-dsh-plugins.zh.md)

## Problem

`verify-npm-install-layout` clones workspace `@x1a0f3n9/dsh-*` packages onto synthetic `0.1.0` / `0.2.0` releases. Git-hosted preset plugins reuse that scope (`@x1a0f3n9/dsh-better-sidebar` at `0.19.3`) but are not workspace members of this version. The dual registry rewrote those dependencies to `^0.2.0`, so npm failed with `ETARGET` and the Release publish job never ran.

## Decision

Rewrite a dsh-named dependency onto the synthetic versions only when that name exists at the workspace source version. Other `@x1a0f3n9/dsh-*` and `@deepseek-ai/dsh-*` names are dropped from the synthetic graph, matching the existing unscoped plugin skip list. The plugin's real version stays in the index.

## Alternatives considered

**Add every scoped plugin name to `PREINSTALLED_PLUGIN_PACKAGES`.** Each new `@x1a0f3n9/dsh-*` git pin would break Release until the list was updated. The source-version check covers current and future pins.

**Make the layout job `continue-on-error`.** Pack would still produce tarballs, but a real two-release placement bug would stop blocking publication.

## Consequences

- Git-hosted preset plugins are absent from the synthetic dual-release install.
- First-party workspace packages such as `@x1a0f3n9/dsh-web-search-pool` still clone onto `0.1.0` / `0.2.0`.
