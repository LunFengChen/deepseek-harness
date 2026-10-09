# Agent Note: Fold only newly aged-out history into the head checkpoint

Status: implemented

English | [中文](2026-10-08-compaction-fold-new-history.zh.md)

## Problem

After a head checkpoint lands, step-boundary pressure still selects that checkpoint, and `/compact` selects it with a zero retained tail. The backend re-summarizes the same replacement, often fails the shrink check, and either loops on the next pre-step or shows `/compact` a summary error even though no new history can fold.

## Decision

`rangeLacksFoldableHistory` is true when every node in the selected span is a compact-checkpoint. Size is not a gate. Pressure `compactIfNeeded` and idle `compactNow` skip that span. Overflow `compactIfNeeded` still force-compacts it, including the short overflow fallback.

Retries run only while the selected span still contains non-checkpoint history. When leftover pressure is the retained tail or the request envelope, `compactIfNeeded` returns the last successful result instead of throwing that the session remains above threshold.

`compactNow` returns `null` without a bracket for a checkpoint-only span. A mixed span whose framed summary is not cheaper records `compaction/start` plus an error `compaction/end` and still returns `null`; `SummaryDidNotShrinkError` is the `summary` cause. Other summarizer failures stay `ManualCompactionError` `summary`. Shrink remains a commit check.

This partially supersedes the retries paragraph in the [compaction capability seam](../feature/2026-06-18-compaction-capability-seam.md).

## Alternatives considered

**Skip only checkpoints already under the summary cap:** rejected because an oversized checkpoint still re-summarizes and loops.

**Drop the shrink check:** rejected because a replacement that is not cheaper must not land, and overflow still needs a cheaper fallback.

**Keep `/compact` summary errors for non-shrinking checkpoints:** rejected because the user sees a failure when nothing useful can change.

**Re-summarize the head checkpoint until pressure falls:** rejected; that is the loop this note closes.

## Consequences

Automatic condensation folds newly aged-out non-checkpoint history into the existing head checkpoint and then stops. `/compact` on checkpoint-only history reports no compactable history. Overflow can still replace a fat checkpoint. Envelope-only leftover pressure no longer throws after a successful compact. The default summarization `maxTokens` is `2048` and does not inherit `headroomTokens`.

## Testing

Unit tests pin checkpoint-only skip on pressure and `/compact`, overflow still compacting that span, leftover-checkpoint skip after a successful compact, leftover foldable history throwing after retries, and non-shrinking `compactNow` returning `null`.
