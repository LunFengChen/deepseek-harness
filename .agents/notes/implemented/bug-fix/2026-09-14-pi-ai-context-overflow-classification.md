# Agent Note: classify Grok and pi-ai context overflow

Status: implemented

English | [中文](2026-09-14-pi-ai-context-overflow-classification.zh.md)

## Problem

Grok and other pi-ai OpenAI-compatible routes could finish a turn instead of compacting. xAI reports `maximum prompt length`; some gateways return Chinese overflow copy; a `length` stop with no output, or with input already filling most of the catalog window, became `max-tokens`. Compaction only retries `CONTEXT_WINDOW_EXCEEDED`, so those turns stopped.

## Decision

`isContextWindowExceededError` recognizes xAI prompt-length wording, Groq-style shorten-the-messages copy, and Chinese context-limit phrasing. pi-ai maps a zero-output `length` stop, and a `length` stop whose input occupies at least 80% of the resolved catalog window, to `CONTEXT_WINDOW_EXCEEDED`. HTTP 400 overflow text is classified before the generic invalid-request label.

## Alternatives considered

**Treat every `length` stop as overflow.** Rejected: a genuine output cap with spare context is still `max-tokens`.

**Raise the default catalog `contextWindow` so usage-based detection matches Grok 4.6.** Rejected: that would delay pressure compaction for smaller custom models; operators still set `contextWindow` on the route.

## Consequences

- Grok `maximum prompt length` and localized overflow errors enter overflow recovery instead of stopping as `INVALID_REQUEST`.
- A truncated generation that produced tokens while most of the catalog window is still free stays `max-tokens`.
- Recovery still needs a compactable range; an indivisible prefix that cannot shrink still preserves the original error.
