/**
 * Shared JSON/text fetch for credentialed pool adapters. Redirects fail before
 * a Location is contacted.
 * @module @x1a0f3n9/dsh-web-search-pool/http
 */

import { WebError } from '@x1a0f3n9/dsh-web'
import type { SearchPoolFailureKind } from './types.ts'

/** Attribution header sent on pool-owned HTTP. Bump with the package version. */
export const SEARCH_POOL_USER_AGENT = 'deepseek-harness/0.0.1'

/** HTTP failure already classified for the circuit. */
export class SearchPoolHttpError extends Error {
  /**
   * @param message - human-readable prefix including HTTP status when known.
   * @param kind - circuit classification.
   * @param status - HTTP status when the server responded.
   */
  constructor(
    message: string,
    readonly kind: SearchPoolFailureKind,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'SearchPoolHttpError'
  }
}

/**
 * Map an HTTP status onto circuit kinds: 401/403 auth, 402/429 quota, else transient.
 *
 * @param status - response status.
 * @returns the circuit kind.
 */
export function classifyHttpStatus(status: number): SearchPoolFailureKind {
  if (status === 401 || status === 403) return 'auth'
  if (status === 402 || status === 429) return 'quota'
  return 'transient'
}

/**
 * True for a fetch/`AbortSignal` abort, surfaced as `WEB_ABORTED`.
 *
 * @param error - rejection from `fetch` or body read.
 * @returns whether this is a user/timeout abort.
 */
function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

/**
 * GET/POST text with `redirect: 'error'`. Non-2xx throws {@link SearchPoolHttpError}.
 *
 * @param url - absolute request URL.
 * @param init - fetch init without `redirect` (this helper pins it).
 * @param signal - optional abort.
 * @returns response body text.
 */
export async function poolFetchText(
  url: string,
  init: RequestInit,
  signal?: AbortSignal,
): Promise<string> {
  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      redirect: 'error',
      ...signal !== undefined ? { signal } : {},
    })
  } catch (error: unknown) {
    if (isAbortError(error)) throw new WebError('Search pool aborted', 'WEB_ABORTED', { cause: error })
    throw new SearchPoolHttpError(`search request failed: ${String(error)}`, 'transient')
  }

  let text: string
  try {
    text = await response.text()
  } catch (error: unknown) {
    if (isAbortError(error)) throw new WebError('Search pool aborted', 'WEB_ABORTED', { cause: error })
    throw new SearchPoolHttpError(`unreadable response body: ${String(error)}`, 'transient')
  }

  if (!response.ok) {
    const quotaHint = /insufficient|quota|billing|rate.?limit/i.test(text)
    const kind = quotaHint ? 'quota' : classifyHttpStatus(response.status)
    const detail = text.slice(0, 160)
    throw new SearchPoolHttpError(
      `HTTP ${String(response.status)}${detail.length > 0 ? `: ${detail}` : ''}`,
      kind,
      response.status,
    )
  }
  return text
}

/**
 * GET/POST JSON with `redirect: 'error'`.
 *
 * @param url - absolute request URL.
 * @param init - fetch init without `redirect`.
 * @param signal - optional abort.
 * @returns parsed JSON.
 */
export async function poolFetchJson(
  url: string,
  init: RequestInit,
  signal?: AbortSignal,
): Promise<unknown> {
  const text = await poolFetchText(url, init, signal)
  try {
    return JSON.parse(text) as unknown
  } catch (error: unknown) {
    throw new SearchPoolHttpError(`non-JSON response: ${String(error)}`, 'transient')
  }
}
