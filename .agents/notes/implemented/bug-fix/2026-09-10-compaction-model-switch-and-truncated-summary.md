# Agent Note: Compact before a pending model switch and land truncated summaries

Status: implemented

English | [中文](2026-09-10-compaction-model-switch-and-truncated-summary.zh.md)

## Problem

Switching from a large model to a smaller one left pre-step pressure priced against the last request header, so the overflowing request was sent first. Manual `/compact` then applied a compaction-owned 8192 output cap and discarded a `max-tokens` finish even when text existed. Thinking models spent that cap on reasoning, and the compact control reported that no useful summary could be produced.

## Decision

Pre-step pressure prices a pending `model/selection` when present, otherwise the latest request header. Overflow recovery still uses that header, then AgentOptions. Unset `maxTokens` leaves the adapter default on the summarization call. A `max-tokens` finish lands the text already produced; an empty truncated result still fails closed.

## Alternatives considered

**Keep pricing pressure on the last header:** rejected because a UI model switch is not yet a request header at `agent/pre-step`, so the small-model window never triggers condensation before the overflowing request.

**Price pressure from AgentOptions:** rejected because those fields are spawn defaults, not the live picker.

**Keep the 8192 summarization cap and fail closed on truncation:** rejected because hidden reasoning tokens consume that cap and the compact command then leaves the conversation unchanged.

**Always accept truncated summaries, including empty output:** rejected because an empty checkpoint cannot replace the shadowed span.

## Consequences

Large-to-small switches condense against the upcoming window before the next request. Manual compact can finish on thinking models. A configured `maxTokens` remains an explicit cap. Truncated-but-nonempty checkpoints may omit later summary sections.
