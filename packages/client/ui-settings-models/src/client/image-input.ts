/**
 * Per-model image-input declaration edited on the Models cards.
 *
 * pi-ai stores the field as `input`; the DeepSeek adapter stores it as
 * `inputModalities`. Both accept `text` and `image`. A missing field is not
 * "text only": resolution may still inherit a catalog or route default.
 */

/** The stored list that admits both text and images. */
export const IMAGE_INPUT = ['text', 'image'] as const

/** Settings field each adapter family uses for request modalities. */
export type ImageInputField = 'input' | 'inputModalities'

/**
 * Whether a stored modality list currently includes `image`.
 * @param value - a model draft's `input` or `inputModalities` field.
 * @returns true only when the value is an array that contains `image`.
 */
export function acceptsImages(value: unknown): boolean {
  return Array.isArray(value) && value.includes('image')
}

/**
 * Copy a model draft with image input declared or cleared on one field.
 * @param model - the row as currently drafted.
 * @param field - adapter-owned modality field name.
 * @param enabled - whether the row should declare image input.
 * @returns a new draft; other fields are unchanged.
 */
export function withImageInput(
  model: Record<string, unknown>,
  field: ImageInputField,
  enabled: boolean,
): Record<string, unknown> {
  const copy = { ...model }
  if (enabled) copy[field] = [...IMAGE_INPUT]
  else Reflect.deleteProperty(copy, field)
  return copy
}
