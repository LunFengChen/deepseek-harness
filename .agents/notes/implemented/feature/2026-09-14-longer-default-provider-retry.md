# Agent Note: longer default provider retry budget

Status: implemented

English | [中文](2026-09-14-longer-default-provider-retry.zh.md)

## Problem

Omitted `retryPolicy` retried five times with 500 ms to 10 s backoff, about 15.5 s of local wait. Provider `Retry-After` above 10 s was not waited, so common rate-limit windows skipped retry entirely. Settings Custom could raise the count and first delay, but the 10 s cap still dropped those Retry-After values.

## Decision

Adapter omission uses normal mode with ten retries, 1 s initial delay, and 60 s maximum delay. Exponential backoff is min(1000 ms × 2^(n-1), 60 s) with 10 percent jitter, about five minutes of local wait across ten retries. `Retry-After` up to 60 s is honored. Models cards still omit `retryPolicy` for Default; Custom still writes `maxDelayMs` as max(60 s, initialDelayMs). Retryable codes and always mode stay unchanged.

## Alternatives considered

**Default to always mode.** Rejected: a permanent failure would hang the turn until cancel.

**Raise only maxRetries and keep the 10 s cap.** Rejected: `Retry-After` above 10 s would still skip retry.

**Cap at 30 s.** Rejected: rate-limit `Retry-After` is often a full minute.

**Add a max-delay field on the Models cards.** Rejected: the request was a longer default; Custom already sets count and first delay, and the floor now follows the adapter cap.

## Consequences

- Default transient recovery waits about five minutes plus each attempt's request time.
- Rate-limit `Retry-After` up to 60 s is waited instead of skipped.
- Custom card policies inherit the 60 s floor unless the first delay is larger.
