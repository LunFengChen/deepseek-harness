# Agent Note: Continue sessions across text-only model switches

Status: implemented

English | [中文](2026-09-02-text-only-image-continuation.zh.md)

## Problem

A session can contain durable image blocks from an earlier vision-capable model. Selecting a text-only model then made later prompts fail during admission, and command submissions with image drafts could be blocked even when the command's text was executable. The image history remained valid for the session, but its presence incorrectly became a requirement for the current route.

## Decision

Image capability is enforced at the final LLM dispatch projection, not at prompt admission. A text-only route receives deterministic text placeholders for direct and nested historical images; the append-only session log and the composer image draft remain unchanged. Durable image validation and attachment persistence still happen before a user message is admitted.

Slash commands continue when their route does not declare image acceptance. The command source emits an informational notice, executes the text without serialized images, and leaves the image draft attached. Commands that declare image acceptance continue to receive serialized images.

The adapter remains the final route-specific enforcement point. A provider that falsely declares image support can still reject its request, and correcting that metadata makes subsequent requests use the text-only projection.

## Alternatives considered

**Automatically switch to an image-capable model.** This overrides an explicit model choice and can unexpectedly change cost, behavior, or credentials. The selected model is respected instead.

**Delete or rewrite image history when selecting a text-only model.** This loses durable user data and makes later model switches irreversible. Request-time projection preserves the history for a future vision-capable route.

**Reject the whole prompt or command when images are present.** This strands text work behind unrelated historical or draft images. Admission now validates the content it owns and lets the final request projection handle modality differences.

## Consequences

A session can continue after switching from a vision-capable model to a text-only model, even when its history contains images. Text-only requests carry stable image descriptions rather than visual payloads. Unsupported-image commands execute their text and retain their images, so users can switch commands or models without reattaching anything. The informational notices do not imply that an image was deleted.
