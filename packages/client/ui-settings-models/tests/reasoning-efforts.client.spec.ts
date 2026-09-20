/** Per-model reasoning-effort maps on the custom-provider Models card. */
import { describe, expect, it } from 'vitest'
import {
  hasCustomReasoningEfforts,
  reasoningEffortsMap,
  validateReasoningEfforts,
} from '../src/client/reasoning-efforts.ts'

describe('reasoningEffortsMap', () => {
  it('reads known levels and ignores everything else', () => {
    expect(reasoningEffortsMap(undefined)).toBeUndefined()
    expect(reasoningEffortsMap(false)).toBeUndefined()
    expect(reasoningEffortsMap(null)).toBeUndefined()
    expect(reasoningEffortsMap([])).toBeUndefined()
    expect(reasoningEffortsMap({})).toBeUndefined()
    expect(reasoningEffortsMap({ unknown: 'x' })).toBeUndefined()
    expect(reasoningEffortsMap({ high: 1 })).toBeUndefined()
    expect(reasoningEffortsMap({ unknown: 'x', high: 'high', off: null }))
      .toEqual({ high: 'high', off: null })
    expect(hasCustomReasoningEfforts({ high: 'high' })).toBe(true)
    expect(hasCustomReasoningEfforts({})).toBe(false)
  })
})

describe('validateReasoningEfforts', () => {
  it('accepts none and a map with a thinking level', () => {
    expect(validateReasoningEfforts(undefined)).toBeUndefined()
    expect(validateReasoningEfforts(false)).toBeUndefined()
    expect(validateReasoningEfforts({ high: 'high' })).toBeUndefined()
    expect(validateReasoningEfforts({ off: null, xhigh: 'xhigh' })).toBeUndefined()
  })

  it('refuses an empty custom map and a blank wire value', () => {
    expect(validateReasoningEfforts({})).toBe('modelReasoningEmpty')
    expect(validateReasoningEfforts({ off: null })).toBe('modelReasoningEmpty')
    expect(validateReasoningEfforts({ high: '' })).toBe('modelReasoningWireRequired')
    expect(validateReasoningEfforts({ high: null })).toBe('modelReasoningWireRequired')
  })
})
