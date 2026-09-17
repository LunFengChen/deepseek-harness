/**
 * Split a credential blob into distinct API keys.
 * @module @x1a0f3n9/dsh-web-search-pool/keys
 */

/**
 * Split `raw` on commas or whitespace and drop blanks and duplicates, keeping
 * first-seen order. Empty input yields an empty list.
 *
 * @param raw - one key, or several joined by comma, space, or newline.
 * @returns distinct non-empty keys.
 */
export function splitKeys(raw: string): string[] {
  const seen = new Set<string>()
  const keys: string[] = []
  for (const part of raw.split(/[\s,]+/)) {
    if (part.length === 0 || seen.has(part)) continue
    seen.add(part)
    keys.push(part)
  }
  return keys
}
