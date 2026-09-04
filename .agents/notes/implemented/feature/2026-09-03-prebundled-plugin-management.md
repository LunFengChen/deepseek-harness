# Agent Note: Prebundled plugin catalog and profile toggles

Status: implemented

English | [中文](2026-09-03-prebundled-plugin-management.zh.md)

## Problem

Fork-specific behavior belongs in plugins, but a profile needs a supported way to ship optional features without forcing every installation to run them or making users edit patch files.

## Decision

Bundle manifests may declare `dsh.bundle.plugins` catalog entries. Profile loading validates and exposes the catalog, while `dsh.profile.pluginOverrides` stores user choices. The Host plugin inventory Remote lists the catalog and provides `setEnabled`; the Web Settings Plugins tab renders accessible switches and persists each choice. Required entries cannot be disabled. External npm packages remain managed by the existing profile plugin CLI, so the browser never executes package-manager commands.

The catalog controls existing Loader rows, not package installation: bundles and their dependencies are shipped/installed with the profile, and the toggle changes runtime composition immediately and on the next launch.

## Alternatives considered

**Require users to edit `cordis.patch.yml`:** this exposes implementation details and makes a profile's optional features difficult to discover or reset.

**Install every feature as a separate npm package:** this gives package-level removal but duplicates the profile dependency graph and makes the browser responsible for package management, so it is not suitable for shipped profile features.

**Mutate arbitrary Loader entries from Settings:** this would let UI state override user-owned composition and command-line overlays, so mutation is limited to bundle-declared catalog entries.

## Consequences

- Feature authors can ship a disabled-by-default plugin row and a localized settings surface without adding profile-specific fork logic.
- Users get one place to enable or disable prebundled features, while `xfdsh plugin --profile <name> add/remove` remains the package install boundary.
- Profile overrides are durable JSON state and are applied after bundle patches but before user and command-line overlays, so explicit user patches retain precedence.
