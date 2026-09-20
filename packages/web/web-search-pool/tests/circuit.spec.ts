import { describe, expect, it } from 'vitest'
import { SearchPoolCircuit } from '@x1a0f3n9/dsh-web-search-pool'

const options = { failureThreshold: 3, windowMs: 1000, cooldownMs: 500, quotaCooldownMs: 2000 }

describe('SearchPoolCircuit', () => {
  it('opens immediately on quota and auth, then closes after quotaCooldownMs', () => {
    let now = 0
    const circuit = new SearchPoolCircuit(options, () => now)
    circuit.recordFailure('k', 'quota')
    expect(circuit.isOpen('k')).toBe(true)
    now = 1999
    expect(circuit.isOpen('k')).toBe(true)
    now = 2000
    expect(circuit.isOpen('k')).toBe(false)
    circuit.recordFailure('a', 'auth')
    expect(circuit.isOpen('a')).toBe(true)
  })

  it('opens after threshold transients inside the window and resets on success', () => {
    let now = 0
    const circuit = new SearchPoolCircuit(options, () => now)
    circuit.recordFailure('t', 'transient')
    circuit.recordFailure('t', 'transient')
    expect(circuit.isOpen('t')).toBe(false)
    now = 10
    circuit.recordFailure('t', 'transient')
    expect(circuit.isOpen('t')).toBe(true)
    now = 510
    expect(circuit.isOpen('t')).toBe(false)
    circuit.recordSuccess('t')
    circuit.recordFailure('t', 'transient')
    expect(circuit.isOpen('t')).toBe(false)
  })

  it('uses Date.now when no clock is injected', () => {
    const circuit = new SearchPoolCircuit(options)
    expect(circuit.isOpen('missing')).toBe(false)
  })

  it('drops transients that fall outside the window', () => {
    let now = 0
    const circuit = new SearchPoolCircuit(options, () => now)
    circuit.recordFailure('t', 'transient')
    circuit.recordFailure('t', 'transient')
    now = 1001
    circuit.recordFailure('t', 'transient')
    expect(circuit.isOpen('t')).toBe(false)
  })
})
