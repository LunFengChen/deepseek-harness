# Agent Note: composer failover panel must stay inside the viewport

Status: implemented

English | [中文](2026-09-19-failover-queue-composer-panel-viewport.zh.md)

## Problem

Clicking the composer failover chip opened the P1/P2/P3 editor below the window. The chip sits on the input row, and a `position: fixed` panel nested in another fixed wrapper reported height 0, so the panel grew downward off the screen.

## Decision

`v0.1.10` measures the in-flow panel, prefers a slot above the chip, and clamps `top` into `[8, innerHeight - height - 8]`. Composer overflow is `auto` with max-height `min(420, innerHeight - 16)`. Settings page overflow stays `visible`. xfdsh pins `github:LunFengChen/dsh-failover-queue#v0.1.10`.

## Verification

On `xfdsh web` port 7777, the composer chip labeled `故障转移：P1 …` opens a panel whose bottom is above `window.innerHeight`. P1/P2/P3 and `选择供应商` stay visible. The add menu still portals above the field.

## Alternatives considered

**Keep the nested fixed wrapper and only clamp `top`.** Rejected: height stayed 0, so clamp still placed an empty box and the inner panel grew down.

**Always open below the chip.** Rejected: the chip is on the bottom input row, so below is the clipped side.

## Consequences

- Short viewports pin the panel to an 8px top gutter and scroll inside it.
- The add menu stays a document-body portal so panel overflow does not clip it.
