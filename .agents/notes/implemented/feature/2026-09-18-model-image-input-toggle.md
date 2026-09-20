# Agent Note: per-model Supports images switch

Status: implemented

English | [中文](2026-09-18-model-image-input-toggle.zh.md)

## Problem

A custom pi-ai model is text-only until its stored `input` list includes `image`. The Models page had no control for that field, so a vision model on a hand-declared gateway (for example `grok-4.6` on a custom OpenAI-compatible route) refused attached images with "the current model does not support images" even when the upstream model is vision-capable. Builtin catalog routes already declare image input; the gap is user-owned model rows.

## Decision

Each model row's capacities fold has a **Supports images** switch.

- On writes `input: [text, image]` for pi-ai rows and `inputModalities: [text, image]` for DeepSeek rows.
- Off deletes that field. Resolution then inherits the installed catalog or the route `defaultInput`, which is `['text']` for a custom pi-ai route.
- The switch is on only when the stored list currently contains `image`. An unknown id starts off.
- Fetch + Add selected copies `input: [text, image]` onto a new row when discovery reports `inputModalities` including `image`.
- `llm-pi-ai` discovery copies installed-catalog `input` onto a listing id the registry already describes, preferring an entry that includes `image` when several providers share the id. Catalog-backed discovery includes `inputModalities` on every catalog model.

`read_image` and prompt admission still require the exact routed model to include `image`. This switch is how a custom row makes that claim. Related: [unified image request pipeline](2026-08-20-unified-image-request-pipeline.md), [draft provider endpoint interrogation](../architecture/2026-08-04-draft-provider-endpoint-interrogation.md).

## Alternatives considered

**Default every custom OpenAI-compatible model to vision.** Rejected: an over-claimed image becomes durable session history, then the provider rejects the turn.

**A route-level `defaultInput` control.** Rejected: one gateway route commonly mixes vision and text-only models.

**Infer capability from the model id string.** Rejected: ids are not capability claims, and a wrong guess is worse than an explicit off switch.

**Keep the field in `settings.yaml` only.** Rejected: that is how the custom `grok-4.6` failure happened.

## Consequences

- Users can declare image input on the Models page without editing yaml.
- Turning the switch off does not write `input: [text]`. A catalog id whose stored row omits `input` can still inherit vision from the installed catalog.
- A gateway listing id that no installed catalog names still needs the switch, or a yaml `input` list, before images are admitted.
- Custom OpenAI-compatible routes are not defaulted to vision.

## Testing

`packages/client/ui-settings-models/tests/image-input.spec.ts` covers the stored-field helper. The Models card specs write and drop `input` / `inputModalities` from the switch, and copy image input from an adopted discovery candidate. `packages/llm/llm/tests/topology.spec.ts` keeps `inputModalities` when normalizing discovery results. `packages/llm/llm-pi-ai/tests/discovery.spec.ts` covers catalog-backed `inputModalities` and overlay of a matching listing id.
