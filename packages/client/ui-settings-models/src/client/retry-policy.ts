/**
 * Provider-owned request-retry drafts edited on the Models settings cards.
 *
 * Omission uses the adapter defaults (ten retries, 1 s to 60 s). A stored
 * object is a custom normal-mode policy with a retry count and delay.
 */

/** Adapter default for eligible retries after the first request. */
export const DEFAULT_RETRY_MAX_RETRIES = 10
/** Adapter default for the first local backoff delay, in milliseconds. */
export const DEFAULT_RETRY_INITIAL_DELAY_MS = 1_000
/** Adapter default for the longest local or accepted provider delay, in milliseconds. */
export const DEFAULT_RETRY_MAX_DELAY_MS = 60_000
/** Node `setTimeout` clamp; the host schema refuses a larger delay. */
const MAX_TIMER_DELAY_MS = 2_147_483_647

/** Custom normal-mode policy the Models cards write. */
export type RetryPolicyDraft = {
  readonly mode: 'normal'
  readonly maxRetries: number
  readonly backoff: {
    readonly initialDelayMs: number
    readonly maxDelayMs: number
  }
}

/** Locale keys `validateRetryPolicy` can return. */
export type RetryPolicyFailure = 'retryCountInvalid' | 'retryDelayInvalid'

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * The adapter-default policy the Custom radio materializes so Apply is valid.
 * @returns a normal-mode draft matching omitted `retryPolicy`.
 */
export function defaultRetryPolicy(): RetryPolicyDraft {
  return {
    mode: 'normal',
    maxRetries: DEFAULT_RETRY_MAX_RETRIES,
    backoff: {
      initialDelayMs: DEFAULT_RETRY_INITIAL_DELAY_MS,
      maxDelayMs: DEFAULT_RETRY_MAX_DELAY_MS,
    },
  }
}

/**
 * Whether a stored field is a custom policy the radio should select.
 * @param value - a provider draft's `retryPolicy` field.
 * @returns true when the field is a non-array object.
 */
export function hasCustomRetryPolicy(value: unknown): boolean {
  return isObject(value)
}

function parseCount(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value >= 0 ? value : undefined
  }
  if (typeof value !== 'string') return undefined
  const text = value.trim()
  if (!/^(0|[1-9]\d*)$/.test(text)) return undefined
  const count = Number(text)
  return Number.isSafeInteger(count) ? count : undefined
}

function parseDelay(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 && value <= MAX_TIMER_DELAY_MS ? value : undefined
  }
  if (typeof value !== 'string') return undefined
  const text = value.trim()
  if (text.length === 0 || !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(text)) return undefined
  return parseDelay(Number(text))
}

function backoffDelay(value: unknown): unknown {
  if (!isObject(value)) return undefined
  return value['initialDelayMs']
}

/**
 * Read a stored `retryPolicy` object into the card's normal-mode draft.
 * @param value - a provider draft's `retryPolicy` field.
 * @returns the draft, or `undefined` when the field is absent / not an object.
 */
export function retryPolicyDraft(value: unknown): RetryPolicyDraft | undefined {
  if (!isObject(value)) return undefined
  const backoff = isObject(value['backoff']) ? value['backoff'] : {}
  const maxRetries = parseCount(value['maxRetries']) ?? DEFAULT_RETRY_MAX_RETRIES
  const initialDelayMs = parseDelay(backoff['initialDelayMs']) ?? DEFAULT_RETRY_INITIAL_DELAY_MS
  return {
    mode: 'normal',
    maxRetries,
    backoff: {
      initialDelayMs,
      maxDelayMs: Math.max(DEFAULT_RETRY_MAX_DELAY_MS, initialDelayMs),
    },
  }
}

/**
 * Build the object the cards store for one pair of count and delay fields.
 * @param maxRetries - parsed retry count, or `undefined` when the field is blank / illegal.
 * @param initialDelayMs - parsed initial delay, or `undefined` when the field is blank / illegal.
 * @returns a complete draft, or a marker object the validator refuses.
 */
export function retryPolicyFromFields(
  maxRetries: number | undefined,
  initialDelayMs: number | undefined,
): unknown {
  if (maxRetries === undefined || initialDelayMs === undefined) return { mode: 'normal' }
  return {
    mode: 'normal',
    maxRetries,
    backoff: {
      initialDelayMs,
      maxDelayMs: Math.max(DEFAULT_RETRY_MAX_DELAY_MS, initialDelayMs),
    },
  }
}

/**
 * Parse one retry-count field.
 * @param value - the input's current text or stored number.
 * @returns the count, or `undefined` when it is not a non-negative safe integer.
 */
export function parseRetryCount(value: unknown): number | undefined {
  return parseCount(value)
}

/**
 * Parse one retry-delay field.
 * @param value - the input's current text or stored number.
 * @returns milliseconds, or `undefined` when it is not a positive finite delay.
 */
export function parseRetryDelay(value: unknown): number | undefined {
  return parseDelay(value)
}

/**
 * Adapter refusals for a custom `retryPolicy` the cards are about to write.
 * Absent is the default of adapter policy. A custom object must name a count
 * and a positive delay.
 * @param value - a provider draft's `retryPolicy` field.
 * @returns the failure key, or `undefined` when the adapter will accept it.
 */
export function validateRetryPolicy(value: unknown): RetryPolicyFailure | undefined {
  if (value === undefined) return undefined
  if (!isObject(value)) return 'retryCountInvalid'
  if (value['mode'] === 'always') return undefined
  if (parseCount(value['maxRetries']) === undefined) return 'retryCountInvalid'
  if (parseDelay(backoffDelay(value['backoff'])) === undefined) return 'retryDelayInvalid'
  return undefined
}
