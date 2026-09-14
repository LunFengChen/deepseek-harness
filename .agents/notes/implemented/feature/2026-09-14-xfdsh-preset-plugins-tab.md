# Agent Note: split xfdsh preset plugins out of Plugin list

Status: implemented

English | [中文](2026-09-14-xfdsh-preset-plugins-tab.zh.md)

## Problem

The Plugin list tab mixed profile-prebundled xfdsh features into the same page as session and global Loader inventory, under an "Optional plugins" heading. Users wanted those cards in a dedicated surface named xfdsh preset plugins.

## Decision

Register a second `settings.plugins.tab` (`xfdsh-presets`). That tab renders the catalog cards (title, linked package specifier, description, enable switch). Plugin list keeps session and global rows and omits catalog packages, including nested Loader ids. An empty catalog hides the group instead of showing a blank Optional plugins block.

## Alternatives considered

**Keep the catalog as a section inside Plugin list and only rename it.** Rejected: the user asked for a new similar UI, not another heading on the same tab.

**Filter only by package name.** Rejected: nested include trees prefix Loader ids, so the inventory also matches `entryId` and `parent:entryId`.

## Consequences

- Settings → Plugins shows Plugin configuration, Plugin list, and xfdsh preset plugins.
- Timeline, market, reasoning effort, dsh-context, better-sidebar, and Hindsight toggle from the new tab.
