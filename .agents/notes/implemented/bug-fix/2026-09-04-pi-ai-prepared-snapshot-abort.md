# Agent Note: Bind pi-ai dispatch snapshots and caller cancellation

Status: implemented

English | [中文](2026-09-04-pi-ai-prepared-snapshot-abort.zh.md)

## Problem

The pi-ai adapter resolved model metadata from one profile generation but dispatched a prepared call through a later generation. It also passed the diagnostics object where the stream converter expected caller cancellation, so pre-aborted requests could be reported as provider errors and image reads lost cancellation.

## Decision

`PiAiAdapter.prepareCall()` captures the resolved profile/model collection and dispatches through that snapshot. Direct streams capture the current snapshot through the same private path. Durable image conversion receives the watchdog signal, and `toStreamChunks()` keeps diagnostics as its third argument while receiving the caller signal separately for in-band abort classification.

## Alternatives considered

**Re-read profiles at dispatch:** rejected because model metadata and the endpoint could come from different configuration generations during one prepared call.

**Classify aborts only in the outer adapter catch:** rejected because pi-ai reports many provider failures as terminal stream events that never reach that catch as thrown errors.

**Remove diagnostics from stream conversion:** rejected because HTTP status, request id, and event facts are needed to explain provider failures without leaking credentials.

## Consequences

Prepared calls remain on one model/profile generation while later calls see configuration changes. Pre-aborted and concurrently aborted requests produce the Harness `ABORTED` finish. Attachment reads can stop with the request watchdog, and existing diagnostics callers retain the third-argument API.
