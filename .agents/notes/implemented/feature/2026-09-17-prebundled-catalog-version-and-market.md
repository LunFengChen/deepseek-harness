# Agent Note: prebundled plugins show version and count as installed

Status: implemented

English | [中文](2026-09-17-prebundled-catalog-version-and-market.zh.md)

## Problem

xfdsh ships community plugins inside `@x1a0f3n9/dsh-web-app`. Settings → Plugins listed them without a version. dshmarket's `/installed` map only reads profile `dependencies`, so those nested GitHub packages never matched Discover cards and never appeared as installed.

## Decision

`pluginInventory/list` projects each catalog package's `package.json` `version` when the bundle layer can resolve it. Optional-plugin cards render that version next to the package name.

`@x1a0f3n9/dshmarket` `v1.45.2` reads `dsh.bundle.plugins` from selected profile bundles, returns them as `prebundled`, and treats those names (plus unscoped aliases) as presence-only catalog matches. Bundle manifests resolve through Node module resolution from the profile `package.json` and the host CLI entry, because a source-launched Web bundle is often hoisted outside `profile/node_modules`. Profile `dependencies` stay the mutation source of truth: the Installed tab can list a prebundled package and must not offer uninstall or update for it. The Web bundle pin is `github:LunFengChen/dsh-market#v1.45.2` (`@x1a0f3n9/dshmarket`). Failover queue ships in the same catalog as `github:LunFengChen/dsh-failover-queue#v0.1.5`.

## Alternatives considered

**Write nested plugins into the profile `package.json` so the market already sees them.** Rejected: that copies bundle ownership into the profile and would let Uninstall delete a host-shipped plugin.

**Merge prebundled names into the existing `installed` map.** Rejected: uninstall and update mutate profile dependencies; a merged map would treat host-shipped plugins as user-owned.

**Keep versions only in dshmarket.** Rejected: the Settings plugin list is the surface that already names every prebundled card.

## Consequences

- Optional-plugin cards show `v{version}` when the bundle layer has the package.
- Discover marks LunFengChen-forked preinstalls as installed even when the registry URL is the official repo.
- Uninstall stays off for packages the profile did not add.
- Failover queue loads from the Web bundle, not from a manual `~/.xfdsh` profile add.
- Web search pool loads from the same catalog as a first-party workspace 预置.
