# Agent Note: Alias official dsh names in the npm layout registry

Status: implemented

English | [中文](2026-09-10-npm-layout-official-dsh-alias.zh.md)

## Problem

`verify-npm-install-layout` serves only `@x1a0f3n9/dsh*` in its local registry. Preinstalled community plugins still declare `@deepseek-ai/dsh*` dependencies, so npm 404s and the Release publish job never starts.

## Decision

`buildDualDshRegistry` copies each fork dsh package under the matching `@deepseek-ai/dsh*` name at the same synthetic versions, rewrites official dsh ranges on those packages, and drops preinstalled community plugins from the synthetic dsh tree. Layout assertions still count only the fork names.

## Alternatives considered

**Keep community plugins in the synthetic tree and rewrite their ranges to `*`:** rejected because npm then nests mixed 0.1.0 copies and installs React into the DSH-only consumer.

**Leave official names unpublished and skip the layout job on this branch:** rejected because publish `needs` that job.

## Consequences

The layout rehearsal no longer installs marketplace plugins. Real `npm install` of the published tarballs still can. A missing fork package still 404s for that official name.
