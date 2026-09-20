/**
 * Config and failure types for the multi-backend search pool.
 * @module @x1a0f3n9/dsh-web-search-pool/types
 */

/** How the pool picks the next healthy backend. */
export type SearchPoolStrategy = 'failover' | 'rotate'

/**
 * Vendor adapter the pool can dispatch. Leaf `ctx.web` providers remain
 * independently pin-able; these ids are pool-internal.
 */
export type SearchPoolBackendKind =
  | 'tavily'
  | 'perplexity'
  | 'exa'
  | 'serper'
  | 'brave'
  | 'jina'
  | 'free'

/**
 * Classifies a backend attempt so the circuit can open on quota/auth without
 * retrying a dead key, and retry transients on the next key or backend.
 */
export type SearchPoolFailureKind = 'quota' | 'transient' | 'auth'

/** One pool backend as declared in plugin config. */
export interface SearchPoolBackendConfig {
  /** Stable id used in circuit keys and error prefixes. Defaults to `kind`. */
  id?: string
  /** Vendor adapter to run. */
  kind: SearchPoolBackendKind
  /** Literal key or comma/whitespace-separated key list. Prefer `apiKeyEnv`. */
  apiKey?: string
  /**
   * Environment variable holding one key or a comma/whitespace-separated list.
   * Tavily also reads `$TAVILY_API_KEY` when this is unset.
   */
  apiKeyEnv?: string
  /** Vendor origin override; each adapter appends its operation path. */
  baseURL?: string
  /**
   * When true (the default except `free`), the backend is skipped until at
   * least one key resolves. `free` is keyless.
   */
  needsKey?: boolean
}

/** Circuit windows and cooldowns. Every field is a Config value. */
export interface SearchPoolCircuitConfig {
  /** Transient failures in `windowMs` that open the circuit. */
  failureThreshold: number
  /** Sliding window that counts transient failures. */
  windowMs: number
  /** How long a transient-open circuit stays closed to new attempts. */
  cooldownMs: number
  /** How long a quota or auth failure keeps that key/backend closed. */
  quotaCooldownMs: number
}
