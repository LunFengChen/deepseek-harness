# Agent Note: plugin inventory matches nested Loader ids

Status: implemented

English | [中文](2026-09-10-plugin-inventory-nested-entry-id.zh.md)

## Problem

Settings → Plugins showed prebundled plugins as off. Enabling one toasted "插件状态保存失败，请重试." The catalog stores local yaml ids such as `dsh-context`. Include trees prefix `Entry.id`, so exact `entry.id === catalog.entryId` missed the mounted plugin.

## Decision

`pluginInventory` matches a catalog id to `entry.id` or the local `entry.options.id`. Profile overrides still persist the catalog id. The settings tab shows the host error text instead of a generic retry toast.

## Alternatives considered

**Rewrite catalog metadata to the nested runtime id.** Rejected: profile `pluginOverrides` and bundle patches target the yaml id.

**Leave the generic client toast.** Rejected: the host already returns the missing-entry reason; hiding it made the nested-id miss look like a save failure.

## Consequences

- Prebundled plugins that boot under include report as installed and enabled.
- Toggling them writes `dsh.profile.pluginOverrides` under the catalog id.
