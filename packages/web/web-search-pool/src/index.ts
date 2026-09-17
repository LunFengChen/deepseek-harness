/**
 * Multi-backend `WebSearchProvider` plugin. It contributes to the `ctx.web`
 * registry without owning the service. Failover, key rotation, and the circuit
 * live in this provider; leaf Exa/Perplexity/`free` packages stay independently
 * pin-able.
 *
 * @module @x1a0f3n9/dsh-web-search-pool
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { launchEnvironmentOf } from '@x1a0f3n9/dsh-launch-environment'
import type {} from '@x1a0f3n9/dsh-web'
import { SEARCH_POOL_DEFAULT_CIRCUIT, SearchPoolProvider } from './provider.ts'
import { splitKeys } from './keys.ts'
import type {
  SearchPoolBackendConfig,
  SearchPoolBackendKind,
  SearchPoolCircuitConfig,
  SearchPoolStrategy,
} from './types.ts'

export {
  SEARCH_POOL_PROVIDER_ID,
  SEARCH_POOL_DEFAULT_CIRCUIT,
  SearchPoolProvider,
} from './provider.ts'
export type { SearchPoolBackendSpec, SearchPoolProviderOptions } from './provider.ts'
export { splitKeys } from './keys.ts'
export { SearchPoolCircuit } from './circuit.ts'
export {
  classifyHttpStatus,
  poolFetchJson,
  poolFetchText,
  SEARCH_POOL_USER_AGENT,
  SearchPoolHttpError,
} from './http.ts'
export {
  BRAVE_DEFAULT_BASE_URL,
  JINA_DEFAULT_BASE_URL,
  SERPER_DEFAULT_BASE_URL,
  TAVILY_DEFAULT_BASE_URL,
  classifyAdapterError,
  parseJinaMarkdown,
  searchWithAdapter,
} from './backends.ts'
export type {
  SearchPoolBackendConfig,
  SearchPoolBackendKind,
  SearchPoolCircuitConfig,
  SearchPoolFailureKind,
  SearchPoolStrategy,
} from './types.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'web-search-pool'

/** The web seam this provider registers into. */
export const inject = ['web']

const BACKEND_KINDS = ['tavily', 'perplexity', 'exa', 'serper', 'brave', 'jina', 'free'] as const

/** Shipped backend list: keyed vendors first, keyless `free` last. */
export const SEARCH_POOL_DEFAULT_BACKENDS: SearchPoolBackendConfig[] = [
  { id: 'tavily', kind: 'tavily', apiKeyEnv: 'TAVILY_API_KEYS' },
  { id: 'perplexity', kind: 'perplexity', apiKeyEnv: 'PERPLEXITY_API_KEY' },
  { id: 'exa', kind: 'exa', apiKeyEnv: 'EXA_API_KEY' },
  { id: 'serper', kind: 'serper', apiKeyEnv: 'SERPER_API_KEY' },
  { id: 'brave', kind: 'brave', apiKeyEnv: 'BRAVE_API_KEY' },
  { id: 'jina', kind: 'jina', apiKeyEnv: 'JINA_API_KEY' },
  { id: 'free', kind: 'free', needsKey: false },
]

/** Plugin config (all optional — `apply` fills env-var and constant defaults). */
export interface Config {
  /** `failover` (default) walks the list; `rotate` round-robins the start. */
  strategy?: SearchPoolStrategy
  /** Backends in preference order. Omitted = {@link SEARCH_POOL_DEFAULT_BACKENDS}. */
  backends?: SearchPoolBackendConfig[]
  /** Transient failures in `circuitWindowMs` that open the circuit. Defaults to 3. */
  circuitFailureThreshold?: number
  /** Sliding window that counts transient failures, in ms. Defaults to 60000. */
  circuitWindowMs?: number
  /** Cooldown after a transient-open circuit, in ms. Defaults to 60000. */
  circuitCooldownMs?: number
  /** Cooldown after quota or auth, in ms. Defaults to 3600000. */
  quotaCooldownMs?: number
}

/** Plugin config schema. */
export const Config: z<Config> = z.object({
  strategy: z.union(['failover', 'rotate'] as const).default('failover'),
  backends: z.array(z.object({
    id: z.string(),
    kind: z.union(BACKEND_KINDS),
    apiKey: z.string().role('secret'),
    apiKeyEnv: z.string(),
    baseURL: z.string(),
    needsKey: z.boolean(),
  })),
  circuitFailureThreshold: z.number().step(1).min(1).default(SEARCH_POOL_DEFAULT_CIRCUIT.failureThreshold),
  circuitWindowMs: z.number().step(1).min(1).default(SEARCH_POOL_DEFAULT_CIRCUIT.windowMs),
  circuitCooldownMs: z.number().step(1).min(1).default(SEARCH_POOL_DEFAULT_CIRCUIT.cooldownMs),
  quotaCooldownMs: z.number().step(1).min(1).default(SEARCH_POOL_DEFAULT_CIRCUIT.quotaCooldownMs),
})

/**
 * Default environment names for a vendor kind. Tavily reads both the list
 * variable and the singular fallback.
 *
 * @param kind - vendor adapter.
 * @returns env names to concatenate and split.
 */
export function defaultApiKeyEnvNames(kind: SearchPoolBackendKind): string[] {
  switch (kind) {
    case 'tavily':
      return ['TAVILY_API_KEYS', 'TAVILY_API_KEY']
    case 'perplexity':
      return ['PERPLEXITY_API_KEY']
    case 'exa':
      return ['EXA_API_KEY']
    case 'serper':
      return ['SERPER_API_KEY']
    case 'brave':
      return ['BRAVE_API_KEY']
    case 'jina':
      return ['JINA_API_KEY']
    case 'free':
      return []
    /* v8 ignore next 4 -- closed union; assertNever keeps a future kind a type error */
    default: {
      const exhaustive: never = kind
      return exhaustive
    }
  }
}

/**
 * Resolve the current key list for one backend from literal config, then env.
 *
 * @param ctx - plugin context supplying the launch environment.
 * @param backend - one config row.
 * @returns distinct keys; empty when none are set.
 */
export function resolveBackendKeys(ctx: Context, backend: SearchPoolBackendConfig): string[] {
  if (backend.apiKey !== undefined && backend.apiKey.length > 0) return splitKeys(backend.apiKey)
  const names = backend.apiKeyEnv !== undefined
    ? [backend.apiKeyEnv, ...backend.kind === 'tavily' && backend.apiKeyEnv !== 'TAVILY_API_KEY' ? ['TAVILY_API_KEY'] : []]
    : defaultApiKeyEnvNames(backend.kind)
  const env = launchEnvironmentOf(ctx)
  const parts: string[] = []
  for (const name of names) {
    const value = env.get(name)?.value
    if (value !== undefined && value.length > 0) parts.push(value)
  }
  return splitKeys(parts.join(','))
}

function needsKey(backend: SearchPoolBackendConfig): boolean {
  return backend.needsKey ?? backend.kind !== 'free'
}

function circuitConfig(config: Config): SearchPoolCircuitConfig {
  return {
    failureThreshold: config.circuitFailureThreshold ?? SEARCH_POOL_DEFAULT_CIRCUIT.failureThreshold,
    windowMs: config.circuitWindowMs ?? SEARCH_POOL_DEFAULT_CIRCUIT.windowMs,
    cooldownMs: config.circuitCooldownMs ?? SEARCH_POOL_DEFAULT_CIRCUIT.cooldownMs,
    quotaCooldownMs: config.quotaCooldownMs ?? SEARCH_POOL_DEFAULT_CIRCUIT.quotaCooldownMs,
  }
}

/** Register the search-pool provider with `ctx.web`. */
export function apply(ctx: Context, config: Config): void {
  const backends = config.backends !== undefined && config.backends.length > 0
    ? config.backends
    : SEARCH_POOL_DEFAULT_BACKENDS
  ctx.web.registerSearchProvider(new SearchPoolProvider({
    strategy: config.strategy ?? 'failover',
    circuit: circuitConfig(config),
    backends: backends.map(backend => ({
      id: backend.id ?? backend.kind,
      kind: backend.kind,
      needsKey: needsKey(backend),
      keys: () => resolveBackendKeys(ctx, backend),
      ...backend.baseURL !== undefined ? { baseURL: backend.baseURL } : {},
    })),
  }))
}
