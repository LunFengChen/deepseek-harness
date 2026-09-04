---
description: "Scope-grouped plugin inventory and prebundled feature management tab in Web Plugins settings for the dsh web client: agent-preset compositions first, the global plane behind a disclosure, search across both."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-settings-plugin-inventory

English | [中文](README.zh.md)

## Summary

`dsh-client-ui-settings-plugin-inventory` contributes the **Plugin list** tab to the Web Settings Plugins section. The package also contributes a compact history-import action beside New Session when the official `~/.dsh` store contains sessions. The same double-confirmation flow remains available in Settings → General. The tab lazily calls `ctx.remote.pluginInventory.list()` the first time it is selected, renders the inventory in two collapsible groups, and shows a separate catalog for profile-prebundled optional features. The agent-preset group comes first, open by default: a display-only switcher pill over the roster opens on the default preset, and each composition row is a compact disclosure card carrying its enablement — including `conditional` for a disabled gate the Host could not evaluate — with provenance facts behind the disclosure. The global group follows collapsed, its header carrying the entry count and a failure count; expanded, failures float first, and an entry disabled globally but enabled by at least one preset is marked as preset-provided in place — its details name the enabling presets — instead of reading as plainly disabled. Search filters both groups, forces the collapsed groups open, and points at matches sitting in unselected presets. Loading, empty, no-match, and generic failure states stay local to the mounted component, and a failed read can be retried without exposing transport details; without a roster the tab renders the global plane alone, expanded.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

The compact history-import action appears beside **New Session** when the official `~/.dsh` store contains sessions. It uses an icon button with a tooltip and the same double-confirmation flow as the **Migrate dsh history** row in Settings → General. Open the Plugins section in Settings and select the **Plugin list** tab to inspect the Host's plugin inventory. The tab reads no Remote during plugin activation — selecting it for the first time mounts the component and lazily calls `ctx.remote.pluginInventory.list()` through `api-remotes`.

### Reading a card

Each collapsed card uses the short module name as its title and a small enablement tag; enabled entries also show a colored root-fiber status dot. Expanding one card reveals the declared entry id, the full module specifier, and the state facts: a preset row names the preset it comes from, its runtime status when the composition is live, and its disable condition when it carries one; a preset-provided global row explains that agent presets provide it per session, names the presets that enable it, and offers a jump into the preset group. Preset names resolve through the shared `presetDisplayText` fold (`dsh-agent-presets/display`) over [`ui-agent-preset`](../ui-agent-preset/README.md)'s dictionaries: shipped presets follow the active locale while user-authored ones keep their own metadata, so an English surface never echoes the preset files' Chinese names. Search filters both groups by module name and entry id.

### The preset switcher

The switcher is the same selector-pill-plus-menu control the General settings rows use. It lists every roster preset — the default suffixed as such, broken ones marked — and changes only what the list shows: it writes no settings, and selecting a broken preset shows the discovery-reported reason in place of rows. Choosing the default preset or a session's preset stays where it was: the Agent presets section and the new-session screen.

### Managing prebundled features

The Optional plugins group lists catalog entries shipped by the active profile bundle. Each optional row has an accessible switch; changing it calls `pluginInventory/setEnabled`, updates the Loader, and persists the profile override. Required rows are displayed but disabled. Package installation and removal remain CLI operations rather than browser package-manager actions.

### Retrying a failed read

A failed read renders a generic failure state inside the tab; retrying re-runs the lazy `list()` call without exposing transport details.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The tab projects a Host-owned snapshot and mutates only the profile catalog through its Remote; it performs no Remote read during plugin activation and takes the snapshot on first selection.

### Registration

The browser plugin registers one localized `settings.plugins.tab` contribution with id `all`; the Plugins section owns the navigation entry and tab chrome. Registration uses `ctx.slots.inject()`, so it follows late tab declaration, redeclaration, locale changes, and teardown without importing the section owner.

### Rendering

Row keys are scope-qualified (`global:`, `preset:<id>:<index>`), so one module appearing in both scopes keeps distinct disclosure state; an entry id is shown as detail only when the row declares one and is never classified by string shape. The preset-provided marking is derived client-side: a global entry carries it when it is disabled there while at least one preset row for the same module specifier is actually enabled, so a module every preset gates off (or declares only conditionally) stays plainly disabled rather than over-claiming provision.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

These pages cover the settings section, the remote call, and the Host-side projection.

- [ui-settings-plugins](../ui-settings-plugins/README.md) — the Plugins section this tab registers into.
- [ui-settings](../ui-settings/README.md) — the domain base declaring `settings.plugins.tab`.
- [api-remotes](../../api/remotes/README.md) — the Remote BFF surface behind `pluginInventory.list()`.
- [plugin-inventory](../../host/plugin-inventory/README.md) — the Host-side Loader projection and profile catalog Remote this tab renders.

-----

<a id="model-experience"></a>
## Model Experience

None, as the package is a browser-side inventory projection that registers nothing model-facing.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>


These limits define the freshness and reach of the inventory view; they are current package constraints.

- **One snapshot per Settings mount or retry** — the tab does not subscribe to Loader changes or automatically refetch after reconnect; switching tabs preserves the current snapshot, while reopening Settings obtains a new one. The General settings section also exposes an official dsh history migration row: it copies sessions and attachments from `~/.dsh` into `~/.xfdsh` after an explicit confirmation and refreshes the session list.
- **Catalog-only mutation** — the tab can enable or disable profile-owned prebundled catalog entries; global Loader rows and custom preset composition files remain read-only.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>

**Runtime invariant:** No companion is published. This package owns one Settings contribution and delegates catalog mutations to the Host Remote.
