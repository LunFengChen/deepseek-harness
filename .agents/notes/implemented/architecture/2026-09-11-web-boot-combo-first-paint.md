# Agent Note: Web boot first-paint combos

Status: implemented

English | [中文](2026-09-11-web-boot-combo-first-paint.zh.md)

## Problem

Every enabled `dsh.client` package shared one or two application combo scripts. HTML preloaded those combos, and the first `arrive()` executed the whole payload before any plugin factory registered. A 6.7 MiB document-preview bundle therefore blocked session-list first paint even though the sidebar does not need it. The boot kernel also awaited the complete roster before `uiRenderer.mount`, so optional preinstalled plugins stayed on the critical path.

## Decision

**Startup combos split on URL length, combined source size, and the immediately tier.** Application rows with `immediately: true` stay in their own combo(s). Remaining rows split before a map-form URL exceeds 3 KiB or combined source exceeds 512 KiB. A single oversized bundle occupies its own combo rather than joining neighbors.

**HTML preloads only immediately-tier application combos.** Deferred combos still exist on the graph and load when the first member arrives. Bootstrap combos remain parser-blocking.

**The boot kernel hydrates as soon as `uiRenderer` exists.** `loader.create` runs the immediately-tier wave first. `mountApp` registers the `uiRenderer` inject waiter concurrently with that wave, so React can hydrate before deferred combos start. Deferred entries are created after the immediately wave. `run()` still awaits the full roster and still fails the boot audit if any entry is not active.

**The root outlet waits for the first live registration.** `BootHandoff` hydrates the boot DOM and stays there until `slots.entries('root')` is non-empty. Progressive mount can outrun layout. An empty root at mount is a wait; calling `renderSlot('root')` while empty still throws. Abdicated root registrations still render the crash face.

## Alternatives considered

**Disable heavy preinstalled plugins by default.** Rejected because the product requirement is that those plugins stay enabled; first paint has to improve with them present.

**Add a third `deferred` batch phase.** Rejected because the existing application phase already supports multiple descriptors. Immediate-vs-deferred membership is a composition rule, not a new wire phase.

**Drop application combo preloads entirely and fetch each plugin URL.** Rejected because immediately-tier rows still benefit from one shared transport, and HMR already uses one-resource URLs after invalidation.

**Skip the boot audit for non-immediate failures.** Rejected in this change so a broken later plugin still fails loudly after mount; first paint is the scope.

## Consequences

- A large client bundle does not share a startup script with sidebar/layout factories.
- First paint can occur before document-preview, market, and similar deferred combos finish parsing.
- A later FAILED fiber still replaces the page with the boot failure report after that first paint.
- Tests that assumed every application combo was preloaded now distinguish immediately-tier batches.
- `BootHandoff` keeps `[data-dsh-boot]` until a live `root` registration arrives.

## Testing

The [UI renderer plugin spec](../../../../packages/client/ui-renderer/tests/ui-renderer.client.spec.tsx) hydrates the boot page with an empty `root`, then occupies it. Direct `renderSlot('root')` still throws when empty in the [registry spec](../../../../packages/client/ui-renderer/tests/registry.client.spec.ts).
