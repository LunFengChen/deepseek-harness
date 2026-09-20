# Agent Note: Official DeepSeek requests omit unresolvable plugin packages

Status: implemented

English | [中文](2026-09-11-deepseek-inventory-unresolved-packages.zh.md)

## Problem

Selecting the official DeepSeek provider runs request-extension preparation before HTTP. `dsh_plugin_packages` threw when an active Loader entry was a bare package whose `package.json` was not on the host search path. GitHub-preinstalled plugins often live under the web-app package rather than the CLI search path, so a friend who only switched to DeepSeek saw `DeepSeek request extension preparation failed` and could not chat. Pi-ai routes never run this extension, which is why other models still worked.

## Decision

`plugin-package-inventory-deepseek` omits a bare package that cannot be resolved, the same as a loose module. Malformed `name`/`version` on a found manifest still fails preparation. The adapter's `REQUEST_EXTENSION` message includes the thrown detail so the chat turn shows the inner failure instead of only the wrapper.

## Alternatives considered

**Keep throwing on unresolved packages.** Rejected: the inventory is provider diagnostic metadata. Blocking the model request because one already-imported plugin is not visible to `createRequire` makes official DeepSeek unusable.

**Disable `dsh_plugin_packages` in the fork profile.** Rejected: that drops the field for every official request, including deployments whose packages resolve normally.

**Rewrite community plugin imports onto the fork namespace.** Rejected: resolution of the plugin's own package name is independent of `@x1a0f3n9/dsh-*` remapping.

## Consequences

- Official DeepSeek chat continues when a GitHub or nested plugin is missing from Node's search path.
- Incomplete inventories are preferred over a hard turn failure.
- Malformed package identity on a found manifest still refuses the request.
