# Agent Note: failover-queue 503 skips llm-retry

Status: implemented

English | [中文](2026-09-20-failover-queue-server-immediate.zh.md)

## Problem

`v0.1.11` skipped `llm-retry` only for `AUTH` / `RATE_LIMIT` / `NO_ADAPTER`. A provider 503 is classified as `SERVER`. That code, plus `TIMEOUT` and `TRANSPORT`, called `next()` into `llm-retry` (`maxRetries` 20, backoff up to 10s). The composer showed a retry delay and stayed on P1 until those twenty attempts finished.

## Decision

`v0.1.12` default `immediateCodes` is `AUTH`, `RATE_LIMIT`, `NO_ADAPTER`, `SERVER`, `TIMEOUT`, `TRANSPORT`. Those codes skip remaining same-route retries, open the circuit on the first hit, and retry the next P. `EMPTY_RESPONSE` still stays on same-route `llm-retry`. xfdsh pins `@x1a0f3n9/dsh-failover-queue@0.1.12`. Circuit failback after `cooldownMs` is unchanged; see [failover-queue probes recovered P1](2026-09-19-failover-queue-circuit-failback.md).

## Verification

Plugin unit tests assert each immediate code returns `{ kind: 'retry' }` without calling `llm-retry`, and that `EMPTY_RESPONSE` still calls `next()`. A 503 on P1 must overlay P2 on the same request.

## Alternatives considered

**Keep waiting out `llm-retry` on `SERVER`, then fail over.** Rejected: twenty jittered 10s delays leave the user on a dead P1 for minutes.

**Lower `llm-retry` `maxRetries` for every failure.** Rejected: `EMPTY_RESPONSE` is often transient on the same route and still wants same-route retries.

**Skip `llm-retry` for every failure code.** Rejected: that would turn a one-shot empty completion into an unnecessary P2 jump.

## Consequences

- The first 503 / timeout / transport error opens P1 and retries P2 in the same request.
- After `cooldownMs`, P1 becomes HalfOpen and the next request probes it.
- A cordis.yml `immediateCodes` list still replaces the default.
