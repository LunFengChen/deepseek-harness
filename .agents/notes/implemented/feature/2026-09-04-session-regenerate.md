# Agent Note: Regenerate a session turn in place

Status: implemented

English | [中文](2026-09-04-session-regenerate.zh.md)

## Problem

A user can permanently remove an unsatisfactory question and its later history, but restarting the same question required a slow fork and made the original conversation harder to continue. Historical image references also cannot be submitted directly through the browser prompt API.

## Decision

The Chat UI exposes a refresh action on durable user and steering messages. After the existing risk confirmation is acknowledged, the client first resolves every durable image reference into prompt content, then permanently truncates the selected message and all later history, and finally queues the reconstructed prompt in the same session. If an image cannot be read, the tail is not deleted and the failure is reported to the console.

The action is implemented in the first-party Chat plugin rather than imported as a separate session-action plugin. This keeps deletion and regeneration on the same Session Controller contract and preserves the existing text-only model behavior for historical images.

## Alternatives considered

**Fork the session and submit the question there.** Rejected because forking is slower and leaves the user with a second conversation instead of replacing the failed tail.

**Submit only extracted text.** Rejected because it silently drops historical images that the user intentionally included.

**Delete before reading attachments.** Rejected because the durable references would no longer be available if prompt reconstruction failed.

**Install an external delete/regenerate plugin.** Rejected because deletion is already a native Session Controller operation and the first-party implementation can preserve the same runtime, image, and model-switch semantics.

## Consequences

- Regeneration is permanent: the selected user message and every later event are removed before the replacement prompt is queued.
- The UI uses the existing trash confirmation surface and a refresh icon with the same acknowledgement requirement.
- Historical images are re-uploaded as prompt data before truncation; models without image support can continue through the existing text-only projection path.
- A failed attachment read leaves history unchanged, while a failed prompt after successful deletion is surfaced by the session error path and console diagnostic.
