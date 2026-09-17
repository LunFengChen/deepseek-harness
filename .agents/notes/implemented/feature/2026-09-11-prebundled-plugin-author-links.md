# Agent Note: prebundled plugin author GitHub links

Status: implemented

English | [中文](2026-09-11-prebundled-plugin-author-links.zh.md)

## Problem

The Web optional-plugin catalog showed titles and package names only. Scoped packages looked like they had authors; unscoped ones looked authorless. None of the names were links.

## Decision

Catalog entries may declare `author` and `homepage`. `homepage` must be a credential-free `https://github.com/...` URL. Optional-plugin cards no longer render a separate author byline; the package name is the GitHub link when `homepage` is set. See [omit catalog author byline](2026-09-17-omit-catalog-author-byline.md).

## Verification

`pnpm exec vitest run packages/boot/app-boot/tests/profile.spec.ts packages/host/plugin-inventory/tests/inventory.spec.ts packages/client/ui-settings-plugin-inventory/tests/components.client.spec.tsx` covers parse rejection, Host projection, and the package-name GitHub link.

## Alternatives considered

**Read author from each plugin's npm `package.json` at boot.** Rejected: several prebundled plugins omit `author`, and the catalog already owns display title and description.

**Show the same byline inside dshmarket cards.** Rejected for this change: dshmarket owns that UI and reads authors from its registry catalog.

## Consequences

- Settings → Plugins → Optional plugins links the package name to `homepage` when the catalog declares one.
- A non-GitHub homepage fails profile load instead of becoming an in-app link.
