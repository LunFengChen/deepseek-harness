# Agent Note: omit the optional-plugin author byline

Status: implemented

English | [中文](2026-09-17-omit-catalog-author-byline.zh.md)

## Problem

Optional-plugin cards showed a catalog `author` line under `@scope/name`. For fork pins that line repeated `LunFengChen` next to `@x1a0f3n9/dsh-session-timeline`, so the owner was written twice and the extra row looked like a second identity.

## Decision

Do not render `author` on optional-plugin cards. A scoped package name already names the owner. When the catalog declares `homepage`, the package name is the new-tab GitHub link. Catalog `author` and `homepage` stay in the bundle manifest for parse checks and Host projection. Related: [prebundled plugin author GitHub links](2026-09-11-prebundled-plugin-author-links.md).

## Alternatives considered

**Keep the author byline for unscoped packages only.** Rejected: the extra row is still a second identity line, and unscoped cards already show title plus package name.

**Drop `author` from the catalog schema.** Rejected for this change: profile load still validates the field, and Host snapshots can keep it without drawing it.

## Consequences

- Settings → Plugins shows title, package name, version, and description. It does not show `LunFengChen` as a byline.
- Clicking the package name still opens the GitHub pin.
