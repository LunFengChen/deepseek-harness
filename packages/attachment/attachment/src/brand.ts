/** Attachment identifier brand. @module @x1a0f3n9/dsh-attachment/brand */

import type { Branded } from '@x1a0f3n9/dsh-brand'

/** Opaque content-addressed identifier for one immutable attachment object. */
export type AttachmentId = Branded<'AttachmentId'>

/**
 * Brand a validated storage identifier.
 * @param value - backend-produced opaque identifier.
 * @returns the branded identifier.
 */
export function AttachmentId(value: string): AttachmentId {
  return value as AttachmentId
}

/** Opaque deterministic identity for one request-image transformation. */
export type ImageVariantId = Branded<'ImageVariantId'>

/**
 * Brand a validated request-image transformation identifier.
 * @param value - attachment-provider-produced opaque identifier.
 * @returns the branded identifier.
 */
export function ImageVariantId(value: string): ImageVariantId {
  return value as ImageVariantId
}
