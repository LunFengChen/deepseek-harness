# Agent Note: failover-queue probes recovered P1

Status: implemented

English | [中文](2026-09-19-failover-queue-circuit-failback.zh.md)

## Problem

`v0.1.10` kept a sticky `currentIndex`. After P1 failed, later requests stayed on P2 even when P1 was healthy again. CC Switch always prefers the first available queue member and probes an Open breaker after its timeout.

## Decision

`v0.1.11` gives each route a Closed / Open / HalfOpen breaker. `agent/request` overlays the first available P (P1 first). Immediate codes (`AUTH` / `RATE_LIMIT` / `NO_ADAPTER`) prepend past `llm-retry`, open the circuit, and retry the next P. A completed `assistant/message` records success; two HalfOpen successes close the breaker so the next pick is P1. Queue rows show green / yellow / red health. xfdsh pins `github:LunFengChen/dsh-failover-queue#v0.1.11`.

## Verification

Plugin unit tests cover Open after an immediate failure, HalfOpen after `cooldownMs`, two successes back to Closed, and `pickFirstAvailable` returning P1 once it is HalfOpen. `xfdsh web` on port 7777: fail P1, the chip shows P2 with a red P1 dot; after 60s the next send probes P1 and the chip returns to P1 green.

## Alternatives considered

**Keep sticky `currentIndex` and add a manual "back to P1" control.** Rejected: CC Switch failback is automatic.

**Background Stream Check probes ("Hi", 10–50 tokens).** Rejected: they spend quota. HalfOpen on the next real request is enough.

## Consequences

- Failover is not sticky. P1 is preferred whenever its breaker is Closed or HalfOpen.
- Breakers are memory-only; a process restart starts Closed.
- `RATE_LIMIT` now fails over before `llm-retry` same-route backoff.
