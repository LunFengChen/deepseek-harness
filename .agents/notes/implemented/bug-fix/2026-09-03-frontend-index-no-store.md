# Agent Note: Web shell index responses are not cacheable

Status: implemented

English | [中文](2026-09-03-frontend-index-no-store.zh.md)

## Problem

The Web shell index is generated at request time: it contains the current client-plugin graph, revisioned bundle URLs, and boot injection rows. A browser that reuses an older cached index can pair an old shell with newer `@xfcodeai` client bundles. The module loader then reports a missing platform seed such as `@xfcodeai/dsh-client-ui-slots`, even though the current shell supplies it.

## Decision

`dsh-host-frontend-static` sends `cache-control: no-store` for authenticated HTML index responses. Static assets keep their existing response policy because their Vite filenames and plugin revision query values provide the cache identity. This makes every navigation obtain a freshly rendered boot graph after a rebuild, profile switch, or plugin update.

## Alternatives considered

**Require users to hard-refresh after every rebuild.** Rejected because it leaves a normal navigation vulnerable to an old graph and turns a server-side composition fact into a manual recovery step.

**Disable caching for every static asset.** Rejected because hashed shell assets and revisioned plugin bundles can be cached safely; disabling their cache would add unnecessary transfer cost without fixing the dynamic index pairing.

**Bundle every UI dependency into each client plugin.** Rejected because it duplicates React/UI singleton modules and bypasses the module-table identity shared by the shell.

## Consequences

A normal reload receives the current HTML graph and cannot reuse an older index response. Hashed assets remain cacheable, while a previously opened tab still needs one reload to obtain the no-store policy; the server cannot retroactively change bytes already held by that tab.
