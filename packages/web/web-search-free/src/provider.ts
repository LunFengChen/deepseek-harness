/**
 * `FreeSearchProvider`: a keyless `WebSearchProvider` that reads Bing HTML first
 * and DuckDuckGo HTML if Bing yields no sources. It maps recovered URLs, titles,
 * and snippets onto the seam vocabulary and omits `content` because neither
 * engine returns a generated answer.
 *
 * @module @x1a0f3n9/dsh-web-search-free/provider
 */

import { WebError } from '@x1a0f3n9/dsh-web'
import type {
  WebSearchProvider,
  WebSearchRequest,
  WebSearchResult,
  WebSearchSource,
} from '@x1a0f3n9/dsh-web'
import { parseBingHtml, parseDdgHtml } from './html.ts'

/** Stable id this provider registers under. */
export const FREE_PROVIDER_ID = 'free'

/** Default Bing search origin; `/search` is the operation. */
export const FREE_DEFAULT_BING_BASE_URL = 'https://www.bing.com'

/** Default DuckDuckGo HTML origin; `/html/` is the operation. */
export const FREE_DEFAULT_DDG_BASE_URL = 'https://html.duckduckgo.com'

/**
 * HTML engines treat a product-only UA as a bot. Identify the product inside a
 * Mozilla-compatible token so the request is still attributable.
 */
export const FREE_DEFAULT_USER_AGENT = 'Mozilla/5.0 (compatible; deepseek-harness/0.0.1; +https://github.com/LunFengChen/deepseek-harness)'

/** Resolved provider options (the plugin's `apply` supplies constant defaults). */
export interface FreeSearchProviderOptions {
  /** Bing origin; `/search` is appended. */
  bingBaseURL: string
  /** DuckDuckGo HTML origin; `/html/` is appended. */
  ddgBaseURL: string
  /** `User-Agent` sent on every request. */
  userAgent: string
  /** Default result count when a request carries no `maxResults`. */
  numResults?: number
}

type EngineOutcome =
  | { readonly kind: 'ok'; readonly sources: readonly WebSearchSource[] }
  | { readonly kind: 'error'; readonly message: string }

/** The keyless Bing-then-DuckDuckGo search provider. */
export class FreeSearchProvider implements WebSearchProvider {
  readonly id = FREE_PROVIDER_ID

  constructor(private readonly options: FreeSearchProviderOptions) {}

  available(): boolean {
    return isValidBaseUrl(this.options.bingBaseURL)
      && isValidBaseUrl(this.options.ddgBaseURL)
      && this.options.userAgent.length > 0
      && (this.options.numResults === undefined || isPositiveInteger(this.options.numResults))
  }

  async search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult> {
    const limit = request.maxResults ?? this.options.numResults
    const bing = await this.runEngine('bing', request.query, limit, signal)
    if (bing.kind === 'ok' && bing.sources.length > 0) return { sources: [...bing.sources], truncated: false }
    const ddg = await this.runEngine('ddg', request.query, limit, signal)
    if (ddg.kind === 'ok' && ddg.sources.length > 0) return { sources: [...ddg.sources], truncated: false }
    if (bing.kind === 'ok' || ddg.kind === 'ok') return { sources: [], truncated: false }
    throw new WebError(
      `Free search failed: Bing: ${bing.message}; DuckDuckGo: ${ddg.message}`,
      'WEB_PROVIDER_ERROR',
    )
  }

  private async runEngine(
    engine: 'bing' | 'ddg',
    query: string,
    limit: number | undefined,
    signal: AbortSignal | undefined,
  ): Promise<EngineOutcome> {
    const label = engine === 'bing' ? 'Bing' : 'DuckDuckGo'
    try {
      const html = await this.fetchHtml(engine, query, limit, signal)
      const sources = engine === 'bing' ? parseBingHtml(html) : parseDdgHtml(html)
      return { kind: 'ok', sources }
    } catch (error: unknown) {
      if (isAbortedWebError(error)) throw error
      if (error instanceof WebError) return { kind: 'error', message: error.message }
      return { kind: 'error', message: `${label} search request failed: ${String(error)}` }
    }
  }

  private async fetchHtml(
    engine: 'bing' | 'ddg',
    query: string,
    limit: number | undefined,
    signal: AbortSignal | undefined,
  ): Promise<string> {
    const label = engine === 'bing' ? 'Bing' : 'DuckDuckGo'
    const url = engine === 'bing'
      ? bingSearchUrl(this.options.bingBaseURL, query, limit)
      : ddgSearchUrl(this.options.ddgBaseURL, query)
    let response: Response
    try {
      response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'accept': 'text/html,application/xhtml+xml',
          'user-agent': this.options.userAgent,
        },
        ...signal !== undefined ? { signal } : {},
      })
    } catch (error: unknown) {
      if (isAbortError(error)) throw new WebError(`${label} search aborted`, 'WEB_ABORTED', { cause: error })
      throw new WebError(`${label} search request failed: ${String(error)}`, 'WEB_PROVIDER_ERROR', { cause: error })
    }

    let body: string
    try {
      body = await response.text()
    } catch (error: unknown) {
      if (isAbortError(error)) throw new WebError(`${label} search aborted`, 'WEB_ABORTED', { cause: error })
      throw new WebError(`${label} returned an unreadable response body: ${String(error)}`, 'WEB_PROVIDER_ERROR', { cause: error })
    }

    if (!response.ok) {
      throw new WebError(`${label} search HTTP ${String(response.status)}`, 'WEB_PROVIDER_ERROR')
    }
    return body
  }
}

/** Build the Bing `/search` URL, attaching `count` when a positive limit is known. */
export function bingSearchUrl(baseURL: string, query: string, limit: number | undefined): string {
  const url = new URL('search', withTrailingSlash(baseURL))
  url.searchParams.set('q', query)
  if (limit !== undefined) url.searchParams.set('count', String(limit))
  return url.href
}

/** Build the DuckDuckGo `/html/` URL. */
export function ddgSearchUrl(baseURL: string, query: string): string {
  const url = new URL('html/', withTrailingSlash(baseURL))
  url.searchParams.set('q', query)
  return url.href
}

function withTrailingSlash(baseURL: string): string {
  return baseURL.endsWith('/') ? baseURL : `${baseURL}/`
}

/** True when `baseURL` parses as an absolute URL (a cheap local config check). */
function isValidBaseUrl(baseURL: string): boolean {
  return URL.canParse(baseURL)
}

/** True for a request limit that can be sent to Bing (a positive whole number). */
function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0
}

/** True for a fetch/`AbortSignal` abort, surfaced as `WEB_ABORTED`. */
function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function isAbortedWebError(error: unknown): boolean {
  return error instanceof WebError && error.code === 'WEB_ABORTED'
}
