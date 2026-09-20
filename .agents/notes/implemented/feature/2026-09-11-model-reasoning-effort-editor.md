# Agent Note: custom model reasoning effort editor

Status: implemented

English | [中文](2026-09-11-model-reasoning-effort-editor.zh.md)

## Problem

Hand-declared `llm-pi-ai` models do not inherit thinking levels. The composer slider only reads `reasoning.efforts`, so a custom Grok route with no `reasoningEfforts` shows no thinking strength. Editing YAML works, but Settings → Models already owns the custom model list and omitted this field.

## Decision

Each custom model row on Settings → Models offers two choices: Default (none) omits `reasoningEfforts`; Custom writes the selected levels and wire values onto that model. There is no provider-scoped control and no guessed preset. The preinstalled `dsh-reasoning-effort` slider stays a reader of the catalog.

## Verification

`pnpm exec vitest run packages/client/ui-settings-models/tests/reasoning-efforts.client.spec.ts packages/client/ui-settings-models/tests/provider-form.client.spec.tsx packages/client/ui-settings-models/tests/components.client.spec.tsx` covers map parsing, empty-custom refusal, apply of `{ high, xhigh }`, and returning to Default (none).

## Alternatives considered

**Guess Grok or DeepSeek presets from the model id.** Rejected: the user asked for Default (none) and Custom only.

**Preinstall a declaration plugin such as `dsh-thinking-effort`.** Rejected for this field: the model list is already on Settings → Models, and a second settings page hides the same edit.

**Change `dsh-reasoning-effort` to invent levels.** Rejected: that plugin reads `reasoning.efforts`; writing catalog data belongs on the model row.

**A single provider-level input.** Rejected: models under one route disagree, including image models that must stay at none.

## Consequences

- Custom Grok and other hand-declared models can expose thinking strength without editing `settings.yaml` by hand.
- Default (none) keeps the previous catalog behavior.
- Selecting Custom does not write an empty map; Apply stays enabled until a thinking level besides `off` is checked.
- Saving Custom with only `off` is refused in the card.
