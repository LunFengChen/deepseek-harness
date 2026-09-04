---
description: "Projection of current Cordis Loader state and profile plugin catalog with each agent preset's composition beside it: the pluginInventory service and its pluginInventory/list Remote for web GUI host clients."
kind: "package-reference"
---

# @x1a0f3n9/dsh-host-plugin-inventory

English | [中文](README.zh.md)

## Summary

Clients and settings pages can show what is currently composed in the host: calling `pluginInventory/list` returns the current non-group Loader entries in Loader order — entry id, module specifier, effective enablement, and root Fiber phase (`pending`, `loading`, `active`, `failed`, or `unloading`, or `null` when an entry has no live root Fiber). When an agent-preset roster is composed, the snapshot also carries one group per preset — id, trust, display name, default marking, health, and flattened composition rows — because a deployment that mounts the roster runs its model-facing plugins there rather than on the Loader's own entries. The snapshot is point-in-time: the Loader is the sole lifecycle authority, and this package owns no cache, history, provenance model, or event stream; its separate migration Remote copies official dsh history into the isolated xfdsh home. Client packages consume the Remote through the explicit [`api-remotes`](../../api/remotes/README.md) assembly rather than importing the Host implementation.

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

Call `pluginInventory/list` when a client or settings page needs to show what is currently composed in the host — which plugins are loaded, enabled, and alive, and what each agent preset would give a session. The Remote is the only entry point: the service is Remote-only and deliberately declares no same-process Cordis `Context` merge. `pluginInventory/setEnabled` is the profile-management entry point for package-owned prebundled entries. `pluginInventory/historyStatus` reports whether the official `~/.dsh` store is available, and `pluginInventory/migrateHistory` copies its sessions and attachments into the xfdsh home without deleting or overwriting existing files.

### What a snapshot contains

Each row is one non-group Loader entry: its entry id, the exact module specifier, the effective enablement (including disabled ancestor groups), and the current root Fiber phase. `pending` means the entry waits to load, `loading` that it is being read, `active` that it is running, `failed` that its fiber rejected, and `unloading` that it is being torn down; `null` means no live root Fiber exists at all. Structural group rows are skipped.

### Per-preset compositions

With a roster composed, `agentPresets` carries one group per preset in roster order: its id, whether the deployment ships it or the user owns it (`trust`, which clients use to localize shipped names), published display name, whether a session naming no preset composes it, and flattened plugin rows — entry id (null when the file row declares none), module specifier, effective enablement, the row's own `!!js` disabled expression when it carries one, and a root-fiber phase when the composition is live. A preset some session already composed answers from its newest standing generation — even when its file has since broken, because the mount is what those sessions run; one never composed since boot answers from its composition file with disabled gates evaluated against the Loader context, and reading never mounts a preset. `conditional` enablement marks a gate the Host could not evaluate, and a broken preset nothing composed stays listed with its reason and no rows. Without a roster the field is absent.

### Profile plugin catalog

A bundle may publish `dsh.bundle.plugins` metadata for features that are already shipped with the profile but are optional at runtime. The snapshot exposes each catalog entry's package, title, default, required, installed, and current enabled state. The Web Settings Plugins page uses `pluginInventory/setEnabled` to update the Loader immediately and persist `dsh.profile.pluginOverrides` in the active profile manifest. Required entries cannot be disabled. Installing or removing external packages remains the CLI's job: use `xfdsh plugin --profile <name> add <package>` or `remove <package>`.

### What you can and cannot do with it

The inventory is a snapshot for display and diagnostics, while catalog entries also support enablement changes for profile-owned prebundled features. It does not install or remove npm packages, and the migration operation copies history rather than making it part of the inventory snapshot — a fiber that already failed and was removed is absent. Because the service reads the Loader on every call, the answer always reflects the current composition rather than a cached view.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

### Design concept

The gateway is a direct projection with no second lifecycle truth: every `list()` call reads `ctx.loader.entries()` and maps each non-group entry to its public row. Cordis's internal plugin/status events already maintain `Entry.fiber` and `Fiber.state`, so a cache would only add another lifecycle truth to keep synchronized. The agent-preset roster is an optional peer resolved per call through `ctx.get('agentPresets')`: its `compositionInventory()` owns every preset read, and this package only maps root-fiber states onto the public phase vocabulary.

### The phase mapping

Fiber states map onto the public phase vocabulary, with `disposed` folding into `null` — an entry whose fiber is gone has no live root to report. The phase therefore never distinguishes why no live root exists: the entry may never have started, or its fiber may already have been disposed.

### Source map

| File | Role |
|---|---|
| [`src/index.ts`](src/index.ts) | `PluginInventoryGateway`: the `pluginInventory` Remote service and the Loader projection |
| [`src/types.ts`](src/types.ts) | Public payload types: `PluginInventoryEntry`, `PluginInventorySnapshot`, `PluginFiberPhase` |
| — | No runtime invariant companion is published; every snapshot is projected directly from Loader-owned state. |

Typert generates the Host and Client Remote artifacts exposed by `./typert` and `./remote`.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

Read these when the inventory contract is not enough: how the Remote reaches clients, then the Loader it projects and the surface that renders it.

- [Remote assembly](../../api/remotes/README.md) — how clients consume `pluginInventory/list` without importing the Host implementation.
- [Cordis plugin loader](../../../vendor/loader/README.md) — the Loader whose entries this package projects.
- [Plugin inventory settings surface](../../client/ui-settings-plugin-inventory/README.md) — the browser-side projection that renders the inventory.

-----

<a id="model-experience"></a>
## Model Experience

None, as the host-side Loader projection and profile settings Remote register nothing model-facing.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>


These limits define what a point-in-time inventory cannot tell a client. They are current package constraints, not a task backlog.

- **Point-in-time state only** — the result contains no durable failure history or subscription; a missing root Fiber is reported as `null`, regardless of why no live root exists.
- **Mutation is catalog-scoped** — the service can enable or disable only bundle-declared prebundled entries; it does not install or remove npm packages or edit arbitrary patch rows.
- **Presets appear only with a roster** — a deployment without `dsh-agent-presets` serves Loader entries alone; the `agentPresets` field is absent rather than empty.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
