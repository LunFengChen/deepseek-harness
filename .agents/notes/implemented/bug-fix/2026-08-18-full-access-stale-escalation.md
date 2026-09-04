# Agent Note: Full-access sessions ignore stale sandbox escalation targets

Status: implemented

English | [中文](2026-08-18-full-access-stale-escalation.zh.md)

## Problem

A model can retain `sandbox_permissions` and `justification` from a denied retry after the session has already switched to `danger-full-access`. The strict escalation API correctly rejects every target from that maximum mode, but the rejection happens before the command or file operation runs, so a valid full-access session fails with `sandbox escalation ... is not strictly wider`.

## Decision

The shared sandbox vocabulary exposes `isEscalationSatisfiedByStandingMode`. When the effective mode is `danger-full-access` and the requested target is one of the advertised targets, `dsh-tool-bash`, `dsh-tool-pwsh`, and `dsh-tool-fs` keep the standing full-access policy and skip approval. Argument pairing validation still runs first, and targets outside the closed vocabulary continue through `approveEscalation`, preserving fail-closed behavior for malformed or injected values. The strict-widening table remains unchanged.

## Alternatives considered

**Allow equal or narrower modes in `approveEscalation`.** Rejected because the shared API is deliberately a strict-widening primitive; changing it would weaken every caller and make same-level requests appear to be approved escalations.

**Hide `sandbox_permissions` from schemas under full access.** Rejected because the effective mode is per-session while schemas are composition-global, and stale or injected arguments can still reach execution even when a field is not advertised.

**Add a special case independently to each tool.** Rejected because bash, PowerShell, and filesystem consumers would drift; the closed-target predicate belongs beside the shared escalation vocabulary.

## Consequences

Full-access sessions no longer fail before executing when the model repeats a valid escalation target, including when approval prompts are unavailable or disabled. Narrower sessions retain strict approval and rejection behavior, and unknown targets remain fail-closed. The extra shared predicate is limited to the two schema-advertised targets and does not alter the security meaning of the sandbox modes.
