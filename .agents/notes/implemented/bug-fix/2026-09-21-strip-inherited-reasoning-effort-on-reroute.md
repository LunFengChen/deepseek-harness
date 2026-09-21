# Agent Note: strip inherited reasoning effort on route-only overlays

Status: implemented

English | [中文](2026-09-21-strip-inherited-reasoning-effort-on-reroute.zh.md)

## Problem

Failover and similar `agent/request` overlays copy `provider`/`model` and leave `reasoningEffort` in place. A P1 custom effort such as `xhigh` then reaches P2. The LLM layer rejects an explicit unsupported effort with `UNSUPPORTED_REASONING_EFFORT` instead of clamping. `installModelSelection` already drops inherited effort when applying the selected model, but a later overlay can put the seed effort back onto a different route.

## Decision

After the `agent/request` waterfall and before `prepareCall`, if the proposed route differs from the seed route and `reasoningEffort` is still the seed value, delete that field. The next model then materializes its own adapter default, or omits effort when it has none. An overlay that sets a different effort keeps it. The LLM layer still fails loud on an explicit unsupported effort.

## Verification

`packages/core/agent-loop/tests/request-reconstruction.spec.ts` sends `xhigh` on P1, then a waterfall that only changes provider/model. P2 must receive its adapter default, not `xhigh`, and the logged header marks that default as adapter-owned.

## Alternatives considered

**Clamp unsupported effort inside `resolveCallConfig`.** Rejected: an explicit choice for the current model must remain a loud capability error.

**Teach failover-queue to clear effort.** Rejected as the only fix: any route-only overlay has the same inheritance, so the loop owns the defense. The plugin can still clear effort later.

**Drop every effort whenever the route changes.** Rejected: a listener that picks a new effort for the new model must be able to send it.

## Consequences

- Failover from a thinking model to a model without that effort no longer dies on the inherited field.
- Same-route per-turn effort changes are unchanged.
- Explicit maxTokens still survives a provider switch; effort does not, because effort ids are model-owned.
