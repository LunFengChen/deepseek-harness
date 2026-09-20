/**
 * Per-model reasoning-effort maps edited on the custom-provider Models card.
 *
 * Level names match `llm-pi-ai`'s thinking-level vocabulary. The client package
 * does not import that adapter: a host-side catalog change still has to name
 * the same keys here before the card can offer them.
 */

/** Every thinking level the Models card can declare, in escalation order. */
export const REASONING_EFFORT_LEVELS = [
  'off',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
] as const

/** One thinking level the Models card can declare. */
export type ReasoningEffortLevel = (typeof REASONING_EFFORT_LEVELS)[number]

/** Declared levels and the spellings dispatch sends on the wire. */
export type ReasoningEffortsMap = Partial<Record<ReasoningEffortLevel, string | null>>

const LEVEL_SET = new Set<string>(REASONING_EFFORT_LEVELS)

/**
 * Read a stored `reasoningEfforts` object, or `undefined` when the model uses
 * the default of no selectable levels.
 * @param value - a model draft's `reasoningEfforts` field.
 * @returns the declared map, or `undefined` for absent / disabled / empty.
 */
export function reasoningEffortsMap(value: unknown): ReasoningEffortsMap | undefined {
  if (value === undefined || value === false || typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined
  }
  const map: ReasoningEffortsMap = {}
  for (const [level, wire] of Object.entries(value as Record<string, unknown>)) {
    if (!LEVEL_SET.has(level)) continue
    if (wire === null) {
      map[level as ReasoningEffortLevel] = null
      continue
    }
    if (typeof wire === 'string') map[level as ReasoningEffortLevel] = wire
  }
  return Object.keys(map).length === 0 ? undefined : map
}

/**
 * Whether a stored field is a custom declaration the radio should select.
 * @param value - a model draft's `reasoningEfforts` field.
 * @returns true when the field carries at least one known level.
 */
export function hasCustomReasoningEfforts(value: unknown): boolean {
  return reasoningEffortsMap(value) !== undefined
}

/**
 * Adapter refusals for a custom `reasoningEfforts` map that schema cannot name
 * by row. Absent and `false` are the default of no levels.
 * @param value - a model draft's `reasoningEfforts` field.
 * @returns the failure key, or `undefined` when the adapter will accept it.
 */
export function validateReasoningEfforts(
  value: unknown,
): 'modelReasoningEmpty' | 'modelReasoningWireRequired' | undefined {
  if (value === undefined || value === false) return undefined
  const map = reasoningEffortsMap(value)
  if (map === undefined) return 'modelReasoningEmpty'
  let thinking = false
  for (const [level, wire] of Object.entries(map)) {
    if (wire === '') return 'modelReasoningWireRequired'
    if (level !== 'off' && (wire === undefined || wire === null)) return 'modelReasoningWireRequired'
    if (level !== 'off') thinking = true
  }
  return thinking ? undefined : 'modelReasoningEmpty'
}
