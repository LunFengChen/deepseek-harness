# Agent Note: Exact platform namespace for the fork client

Status: implemented

English | [中文](2026-09-03-client-platform-namespace.zh.md)

## Problem

A browser page can combine a stale shell with freshly served `@x1a0f3n9/dsh-*` client bundles. The shell and bundle then expose different module tables, so a renderer can require a platform package that the shell did not preload.

## Decision

The client module system resolves platform seeds by their exact `@x1a0f3n9/dsh-*` names. Dynamic plugin entry ids remain exact graph keys and are not rewritten. The frontend HTML is served with `cache-control: no-store` so future navigations fetch a shell and boot graph from the same generation.

The fork does not alias another product namespace in the browser. A stale page must reload after the server update; a missing platform entry remains a loud boot error. The profile loader still rejects bundles that declare upstream product runtime dependencies.

## Alternatives considered

**Rewrite another client package namespace to the current namespace at load time.** Rejected because dynamic plugin entry ids and package factories are graph-owned identities; rewriting them would hide incompatible bundles and make unload and HMR bookkeeping ambiguous.

**Fetch a missing platform package from the browser.** Rejected because platform modules are shared singletons supplied by the shell, and a second copy would split React, store, or UI slot state.

**Only invalidate the browser cache.** Rejected because cache invalidation is not reliable for an already-open page; the no-store response policy makes the next navigation correct, while the running page still needs an explicit reload.

## Consequences

Existing tabs still need one reload after the server update. A fresh `xfdsh web` page loads the shell and renderer from the exact `@xfcodeai` namespace. Missing platform entries remain a loud error instead of being converted into an unrelated package fetch.
