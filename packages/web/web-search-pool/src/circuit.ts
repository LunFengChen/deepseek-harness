/**
 * Per-key/backend circuit: quota and auth open immediately; transients open
 * after a threshold inside a sliding window.
 * @module @x1a0f3n9/dsh-web-search-pool/circuit
 */

import type { SearchPoolCircuitConfig, SearchPoolFailureKind } from './types.ts'

interface Slot {
  openUntil: number
  failures: number[]
}

/** Tracks open/closed state for each `${backendId}` or `${backendId}:${keyIndex}`. */
export class SearchPoolCircuit {
  private readonly slots = new Map<string, Slot>()

  /**
   * @param options - thresholds and cooldowns from plugin config.
   * @param now - clock used for windowing; tests inject a fake.
   */
  constructor(
    private readonly options: SearchPoolCircuitConfig,
    private readonly now: () => number = Date.now,
  ) {}

  /**
   * True when this id must not be attempted yet.
   *
   * @param id - circuit id for one backend or one key of a backend.
   * @returns whether the cooldown is still running.
   */
  isOpen(id: string): boolean {
    const slot = this.slots.get(id)
    return slot !== undefined && this.now() < slot.openUntil
  }

  /**
   * Clear failures after a successful search so the next error starts a new window.
   *
   * @param id - circuit id that just succeeded.
   */
  recordSuccess(id: string): void {
    this.slots.delete(id)
  }

  /**
   * Open immediately on quota/auth; count transients and open at the threshold.
   *
   * @param id - circuit id that just failed.
   * @param kind - quota/auth vs transient.
   */
  recordFailure(id: string, kind: SearchPoolFailureKind): void {
    const now = this.now()
    const slot = this.slots.get(id) ?? { openUntil: 0, failures: [] }
    if (kind === 'quota' || kind === 'auth') {
      slot.openUntil = now + this.options.quotaCooldownMs
      slot.failures = []
      this.slots.set(id, slot)
      return
    }
    const windowStart = now - this.options.windowMs
    slot.failures = slot.failures.filter(at => at >= windowStart)
    slot.failures.push(now)
    if (slot.failures.length >= this.options.failureThreshold) {
      slot.openUntil = now + this.options.cooldownMs
      slot.failures = []
    }
    this.slots.set(id, slot)
  }
}
