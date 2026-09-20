# Agent Note: longer default provider retry budget

Status: implemented

English | [中文](2026-09-14-longer-default-provider-retry.zh.md)

## Problem

Transient model failures need more than five retries. Minute-long waits between later attempts stall the turn, so the default should retry more often with a short exponential cap.

## Decision

Adapter omission uses normal mode with twenty retries, 500 ms initial delay, and 10 s maximum delay. Exponential backoff is min(500 ms × 2^(n-1), 10 s) with 10 percent jitter, about 2.8 minutes of local wait across twenty retries. `Retry-After` up to 10 s is honored; a larger `Retry-After` still skips retry in normal mode. Models cards still omit `retryPolicy` for Default; Custom still writes `maxDelayMs` as max(10 s, initialDelayMs). Retryable codes and always mode stay unchanged.

## Alternatives considered

**Default to always mode.** Rejected: a permanent failure would hang the turn until cancel.

**Ten retries with 1 s to 60 s.** Rejected: later retries waited a full minute, which is too slow for twenty short attempts.

**Keep five retries and only shorten delay.** Rejected: the request is more attempts, not a smaller budget.

**Add a max-delay field on the Models cards.** Rejected: Custom already sets count and first delay, and the floor follows the adapter cap.

## Consequences

- Default transient recovery waits about 2.8 minutes plus each attempt's request time.
- Local retries start at 500 ms and cap at 10 s, so later attempts do not sit a minute.
- Rate-limit `Retry-After` above 10 s is still skipped in normal mode.
- Custom card policies inherit the 10 s floor unless the first delay is larger.
