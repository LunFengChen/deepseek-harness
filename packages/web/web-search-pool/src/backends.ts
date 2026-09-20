/**
 * Vendor adapters the pool dispatches. Credentialed adapters reject redirects.
 * @module @x1a0f3n9/dsh-web-search-pool/backends
 */

import {
  EXA_DEFAULT_BASE_URL,
  EXA_DEFAULT_HIGHLIGHTS_PER_RESULT,
  EXA_DEFAULT_SEARCH_TYPE,
  ExaSearchProvider,
} from '@x1a0f3n9/dsh-web-search-exa'
import {
  PERPLEXITY_DEFAULT_BASE_URL,
  PERPLEXITY_DEFAULT_MAX_TOKENS,
  PERPLEXITY_DEFAULT_MODEL,
  PerplexitySearchProvider,
} from '@x1a0f3n9/dsh-web-search-perplexity'
import {
  FREE_DEFAULT_BING_BASE_URL,
  FREE_DEFAULT_DDG_BASE_URL,
  FREE_DEFAULT_USER_AGENT,
  FreeSearchProvider,
} from '@x1a0f3n9/dsh-web-search-free'
import { WebError } from '@x1a0f3n9/dsh-web'
import type { WebSearchRequest, WebSearchResult, WebSearchSource } from '@x1a0f3n9/dsh-web'
import { poolFetchJson, poolFetchText, SEARCH_POOL_USER_AGENT, SearchPoolHttpError } from './http.ts'
import type { SearchPoolBackendKind } from './types.ts'

/** Default Tavily origin; `/search` is appended. */
export const TAVILY_DEFAULT_BASE_URL = 'https://api.tavily.com'

/** Default Serper origin; `/search` is appended. */
export const SERPER_DEFAULT_BASE_URL = 'https://google.serper.dev'

/** Default Brave origin; `/res/v1/web/search` is appended. */
export const BRAVE_DEFAULT_BASE_URL = 'https://api.search.brave.com'

/** Default Jina search origin; `/{query}` is appended. */
export const JINA_DEFAULT_BASE_URL = 'https://s.jina.ai'

/** Inputs one adapter needs besides the seam request. */
export interface SearchPoolAdapterRequest {
  /** Vendor kind. */
  kind: SearchPoolBackendKind
  /** Optional origin override. */
  baseURL?: string
  /** Selected API key; empty for keyless `free`. */
  apiKey: string
}

const jsonHeaders = (extra: Record<string, string>): Record<string, string> => ({
  'content-type': 'application/json',
  'accept': 'application/json',
  'user-agent': SEARCH_POOL_USER_AGENT,
  ...extra,
})

/**
 * Run one vendor adapter. Leaf first-party providers are constructed per key;
 * Tavily/Serper/Brave/Jina use pool-owned HTTP.
 *
 * @param adapter - kind, optional base, and the key for this attempt.
 * @param request - seam search request.
 * @param signal - optional abort.
 * @returns normalized search result.
 */
export async function searchWithAdapter(
  adapter: SearchPoolAdapterRequest,
  request: WebSearchRequest,
  signal?: AbortSignal,
): Promise<WebSearchResult> {
  switch (adapter.kind) {
    case 'tavily':
      return searchTavily(adapter, request, signal)
    case 'serper':
      return searchSerper(adapter, request, signal)
    case 'brave':
      return searchBrave(adapter, request, signal)
    case 'jina':
      return searchJina(adapter, request, signal)
    case 'exa':
      return new ExaSearchProvider({
        apiKey: adapter.apiKey,
        baseURL: adapter.baseURL ?? EXA_DEFAULT_BASE_URL,
        searchType: EXA_DEFAULT_SEARCH_TYPE,
        highlightsPerResult: EXA_DEFAULT_HIGHLIGHTS_PER_RESULT,
        ...request.maxResults !== undefined ? { numResults: request.maxResults } : {},
      }).search(request, signal)
    case 'perplexity':
      return new PerplexitySearchProvider({
        apiKey: adapter.apiKey,
        baseURL: adapter.baseURL ?? PERPLEXITY_DEFAULT_BASE_URL,
        model: PERPLEXITY_DEFAULT_MODEL,
        maxTokens: PERPLEXITY_DEFAULT_MAX_TOKENS,
      }).search(request, signal)
    case 'free':
      return new FreeSearchProvider({
        bingBaseURL: adapter.baseURL ?? FREE_DEFAULT_BING_BASE_URL,
        ddgBaseURL: FREE_DEFAULT_DDG_BASE_URL,
        userAgent: FREE_DEFAULT_USER_AGENT,
        ...request.maxResults !== undefined ? { numResults: request.maxResults } : {},
      }).search(request, signal)
    /* v8 ignore next 4 -- closed union; assertNever keeps a future kind a type error */
    default: {
      const exhaustive: never = adapter.kind
      throw new WebError(`unknown search-pool backend ${String(exhaustive)}`, 'WEB_PROVIDER_ERROR')
    }
  }
}

/**
 * Map a wrapped leaf `WebError` onto a circuit kind. Abort is rethrown.
 *
 * @param error - rejection from an adapter.
 * @returns a classified HTTP-like error for the circuit.
 */
export function classifyAdapterError(error: unknown): SearchPoolHttpError {
  if (error instanceof SearchPoolHttpError) return error
  if (error instanceof WebError && error.code === 'WEB_ABORTED') throw error
  const message = error instanceof Error ? error.message : String(error)
  const statusMatch = /\bHTTP (\d{3})\b/.exec(message)
  const status = statusMatch !== null ? Number(statusMatch[1]) : undefined
  const kind = status !== undefined
    ? (status === 401 || status === 403
      ? 'auth'
      : status === 402 || status === 429 || /quota|rate.?limit|insufficient/i.test(message)
        ? 'quota'
        : 'transient')
    : /quota|rate.?limit|insufficient/i.test(message) ? 'quota' : 'transient'
  return new SearchPoolHttpError(message, kind, status)
}

function limit(request: WebSearchRequest): number {
  return request.maxResults ?? 8
}

async function searchTavily(
  adapter: SearchPoolAdapterRequest,
  request: WebSearchRequest,
  signal?: AbortSignal,
): Promise<WebSearchResult> {
  const base = adapter.baseURL ?? TAVILY_DEFAULT_BASE_URL
  const payload = await poolFetchJson(`${base}/search`, {
    method: 'POST',
    headers: jsonHeaders({ authorization: `Bearer ${adapter.apiKey}` }),
    body: JSON.stringify({
      query: request.query,
      max_results: limit(request),
      search_depth: 'basic',
    }),
  }, signal)
  const body = asRecord(payload)
  const sources = asArray(body.results).flatMap((entry) => {
    const row = asRecord(entry)
    const url = asString(row.url)
    if (url === undefined) return []
    const title = asString(row.title)
    const content = asString(row.content)
    return [webSource(url, title, content !== undefined ? content.slice(0, 500) : undefined, undefined)]
  })
  const answer = asString(body.answer)
  return {
    sources,
    truncated: false,
    ...answer !== undefined && answer.length > 0 ? { content: answer } : {},
  }
}

async function searchSerper(
  adapter: SearchPoolAdapterRequest,
  request: WebSearchRequest,
  signal?: AbortSignal,
): Promise<WebSearchResult> {
  const base = adapter.baseURL ?? SERPER_DEFAULT_BASE_URL
  const payload = await poolFetchJson(`${base}/search`, {
    method: 'POST',
    headers: jsonHeaders({ 'x-api-key': adapter.apiKey }),
    body: JSON.stringify({ q: request.query, num: limit(request) }),
  }, signal)
  const body = asRecord(payload)
  const sources = asArray(body.organic).flatMap((entry) => {
    const row = asRecord(entry)
    const url = asString(row.link)
    if (url === undefined) return []
    return [webSource(url, asString(row.title), asString(row.snippet), asString(row.date))]
  })
  const answer = asString(asRecord(body.answerBox).answer)
  return {
    sources,
    truncated: false,
    ...answer !== undefined && answer.length > 0 ? { content: answer } : {},
  }
}

async function searchBrave(
  adapter: SearchPoolAdapterRequest,
  request: WebSearchRequest,
  signal?: AbortSignal,
): Promise<WebSearchResult> {
  const base = adapter.baseURL ?? BRAVE_DEFAULT_BASE_URL
  const params = new URLSearchParams({ q: request.query, count: String(limit(request)) })
  const payload = await poolFetchJson(`${base}/res/v1/web/search?${params.toString()}`, {
    method: 'GET',
    headers: {
      'x-subscription-token': adapter.apiKey,
      'accept': 'application/json',
      'user-agent': SEARCH_POOL_USER_AGENT,
    },
  }, signal)
  const web = asRecord(asRecord(payload).web)
  const sources = asArray(web.results).flatMap((entry) => {
    const row = asRecord(entry)
    const url = asString(row.url)
    if (url === undefined) return []
    return [webSource(url, asString(row.title), asString(row.description), asString(row.age))]
  })
  return { sources, truncated: false }
}

async function searchJina(
  adapter: SearchPoolAdapterRequest,
  request: WebSearchRequest,
  signal?: AbortSignal,
): Promise<WebSearchResult> {
  const base = adapter.baseURL ?? JINA_DEFAULT_BASE_URL
  const md = await poolFetchText(`${base}/${encodeURIComponent(request.query)}`, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${adapter.apiKey}`,
      accept: 'text/markdown',
      'user-agent': SEARCH_POOL_USER_AGENT,
    },
  }, signal)
  return { sources: parseJinaMarkdown(md, limit(request)), truncated: false }
}

/**
 * Parse Jina `s.jina.ai` markdown into sources. Each `[title](url)` starts a hit;
 * following non-heading lines join the snippet.
 *
 * @param markdown - response body.
 * @param maxResults - cap on returned sources.
 * @returns parsed sources, possibly empty.
 */
export function parseJinaMarkdown(markdown: string, maxResults: number): WebSearchSource[] {
  const sources: WebSearchSource[] = []
  let current: { url: string; title?: string; desc: string[] } | undefined
  const push = (): void => {
    if (current === undefined || sources.length >= maxResults) {
      current = undefined
      return
    }
    const snippet = current.desc.join(' ').slice(0, 300)
    sources.push({
      url: current.url,
      ...current.title !== undefined && current.title.length > 0 ? { title: current.title } : {},
      ...snippet.length > 0 ? { snippet } : {},
    })
    current = undefined
  }
  for (const line of markdown.split('\n')) {
    if (sources.length >= maxResults) break
    const match = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/.exec(line)
    if (match !== null && match[1] !== undefined && match[2] !== undefined) {
      push()
      const title = match[1].replace(/^[*\d.\s]+/, '').trim()
      current = {
        url: match[2],
        ...title.length > 0 ? { title } : {},
        desc: [],
      }
      continue
    }
    if (current === undefined) continue
    const text = line.replace(/^[-*#>\s]+/, '').trim()
    if (text.length > 0 && !/^\d+[.)]/.test(text) && !/^search results?/i.test(text)) {
      current.desc.push(text)
    }
  }
  push()
  return sources
}

function webSource(
  url: string,
  title: string | undefined,
  snippet: string | undefined,
  publishedAt: string | undefined,
): WebSearchSource {
  return {
    url,
    ...title !== undefined ? { title } : {},
    ...snippet !== undefined ? { snippet } : {},
    ...publishedAt !== undefined ? { publishedAt } : {},
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}
