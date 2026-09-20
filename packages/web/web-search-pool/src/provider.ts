/**
 * `SearchPoolProvider`: one `WebSearchProvider` that fails over across vendor
 * adapters and per-adapter key lists, with a quota-aware circuit.
 * @module @x1a0f3n9/dsh-web-search-pool/provider
 */

import { WebError } from '@x1a0f3n9/dsh-web'
import type { WebSearchProvider, WebSearchRequest, WebSearchResult } from '@x1a0f3n9/dsh-web'
import { classifyAdapterError, searchWithAdapter } from './backends.ts'
import { SearchPoolCircuit } from './circuit.ts'
import type {
  SearchPoolBackendKind,
  SearchPoolCircuitConfig,
  SearchPoolStrategy,
} from './types.ts'

/** Stable id this provider registers under. */
export const SEARCH_POOL_PROVIDER_ID = 'search-pool'

/** Default circuit: 3 transients in 60s open 60s; quota/auth open 1h. */
export const SEARCH_POOL_DEFAULT_CIRCUIT: SearchPoolCircuitConfig = {
  failureThreshold: 3,
  windowMs: 60_000,
  cooldownMs: 60_000,
  quotaCooldownMs: 3_600_000,
}

/** One backend after config/env resolution. Keys are read per search. */
export interface SearchPoolBackendSpec {
  /** Circuit and error prefix. */
  id: string
  /** Vendor adapter. */
  kind: SearchPoolBackendKind
  /** Skip this backend when true and `keys()` is empty. */
  needsKey: boolean
  /** Current key list; empty means keyless. */
  keys: () => string[]
  /** Optional origin override. */
  baseURL?: string
}

/** Resolved provider options (the plugin's `apply` supplies defaults). */
export interface SearchPoolProviderOptions {
  /** `failover` walks in list order; `rotate` round-robins the start index. */
  strategy: SearchPoolStrategy
  /** Backends in preference order. */
  backends: readonly SearchPoolBackendSpec[]
  /** Circuit windows and cooldowns. */
  circuit: SearchPoolCircuitConfig
  /** Clock for the circuit; tests inject a fake. */
  now?: () => number
}

/**
 * Multi-backend search provider. `available()` is true when any backend is
 * keyless or currently has at least one key. Mid-request 429/quota tries the
 * next key, then the next backend.
 */
export class SearchPoolProvider implements WebSearchProvider {
  readonly id = SEARCH_POOL_PROVIDER_ID
  private readonly circuit: SearchPoolCircuit
  private rotateOffset = 0
  private readonly now: () => number

  /**
   * @param options - strategy, backends, and circuit config.
   */
  constructor(private readonly options: SearchPoolProviderOptions) {
    this.now = options.now ?? Date.now
    this.circuit = new SearchPoolCircuit(options.circuit, this.now)
  }

  available(): boolean {
    return this.options.backends.some(backend => this.backendReady(backend))
  }

  async search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult> {
    const ready = this.options.backends.filter(backend => this.backendReady(backend))
    if (ready.length === 0) {
      throw new WebError('Search pool has no usable backend', 'WEB_PROVIDER_UNAVAILABLE')
    }
    const ordered = this.order(ready)
    const errors: string[] = []
    for (const backend of ordered) {
      const keys = backend.keys()
      const attempts = keys.length > 0 ? keys : ['']
      for (const [index, apiKey] of attempts.entries()) {
        const circuitId = keys.length > 0 ? `${backend.id}:${String(index)}` : backend.id
        if (this.circuit.isOpen(circuitId)) {
          errors.push(`${backend.id}: circuit open`)
          continue
        }
        try {
          const result = await searchWithAdapter({
            kind: backend.kind,
            apiKey,
            ...backend.baseURL !== undefined ? { baseURL: backend.baseURL } : {},
          }, request, signal)
          this.circuit.recordSuccess(circuitId)
          return result
        } catch (error: unknown) {
          if (error instanceof WebError && error.code === 'WEB_ABORTED') throw error
          const classified = classifyAdapterError(error)
          this.circuit.recordFailure(circuitId, classified.kind)
          errors.push(`${backend.id}: ${classified.message}`)
        }
      }
    }
    throw new WebError(
      `Search pool exhausted: ${errors.join('; ')}`,
      'WEB_PROVIDER_ERROR',
    )
  }

  private backendReady(backend: SearchPoolBackendSpec): boolean {
    if (!backend.needsKey) return true
    return backend.keys().length > 0
  }

  private order(backends: SearchPoolBackendSpec[]): SearchPoolBackendSpec[] {
    if (this.options.strategy === 'failover') return backends
    const start = this.rotateOffset % backends.length
    this.rotateOffset = (this.rotateOffset + 1) % backends.length
    return [...backends.slice(start), ...backends.slice(0, start)]
  }
}
