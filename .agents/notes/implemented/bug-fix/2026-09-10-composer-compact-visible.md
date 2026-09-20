# Agent Note: labeled composer compact button

Status: implemented

English | [中文](2026-09-10-composer-compact-visible.zh.md)

## Problem

The composer compact control was a 28px tertiary icon with no visible text. Users looking for a 压缩 button could not find it. Command failures only went to `console.error`.

## Decision

The compact control shows the localized 压缩 / Compact label beside the icon. A failed `/compact` Remote result or thrown error appears as a toast.

## Alternatives considered

**Keep an icon-only control and rely on the tooltip.** Rejected: the tooltip only appears on hover, and the tertiary color matched nearby chrome.

**Surface compaction progress in the chat transcript only.** Rejected: transport-level Remote failures never create a command card.

## Consequences

- The compact control is visible in the composer trailing slot without hovering.
- Automatic overflow recovery is unchanged; the button is the idle-session escape hatch after `CONTEXT_WINDOW_EXCEEDED`.
