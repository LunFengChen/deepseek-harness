# Agent Note: failover-queue add menu is provider then model

Status: implemented

English | [中文](2026-09-19-failover-queue-provider-drilldown.zh.md)

## Problem

`v0.1.8` listed every remaining model in one flat menu. With many providers that is a long ungrouped list.

## Decision

`v0.1.9` opens the add menu on providers. Clicking a provider lists only that provider's remaining models. Escape or the back row returns to the provider list. xfdsh pins `github:LunFengChen/dsh-failover-queue#v0.1.9`.

## Verification

Settings → Failover shows `选择供应商（N）`. Opening it lists providers with model counts. Clicking DeepSeek lists that provider's remaining models, not the full catalog.

## Alternatives considered

**Keep the flat model list and add section headers.** Rejected: the menu still opens fully expanded.

**Accordion groups with several providers expanded.** Rejected: first click should choose a provider.

## Consequences

- Adding a route is two clicks: provider, then model.
- Search still filters the current level: providers first, models after drill-in.
