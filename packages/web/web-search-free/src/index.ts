/**
 * Keyless Bing/DuckDuckGo `WebSearchProvider` plugin. It contributes to the
 * `ctx.web` registry without owning the service.
 *
 * @module @x1a0f3n9/dsh-web-search-free
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@x1a0f3n9/dsh-web'
import {
  FreeSearchProvider,
  FREE_DEFAULT_BING_BASE_URL,
  FREE_DEFAULT_DDG_BASE_URL,
  FREE_DEFAULT_USER_AGENT,
} from './provider.ts'

export {
  FREE_DEFAULT_BING_BASE_URL,
  FREE_DEFAULT_DDG_BASE_URL,
  FREE_DEFAULT_USER_AGENT,
  FREE_PROVIDER_ID,
  FreeSearchProvider,
  bingSearchUrl,
  ddgSearchUrl,
} from './provider.ts'
export type { FreeSearchProviderOptions } from './provider.ts'
export {
  decodeBingHref,
  decodeDdgHref,
  decodeHtmlEntities,
  isHttpUrl,
  parseBingHtml,
  parseDdgHtml,
  visibleText,
} from './html.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'web-search-free'

/** The web seam this provider registers into. */
export const inject = ['web']

/** Plugin config (all optional — `apply` fills constant defaults). */
export interface Config {
  /** Bing origin; `/search` is appended. Defaults to the public site. */
  bingBaseURL?: string
  /** DuckDuckGo HTML origin; `/html/` is appended. Defaults to the public site. */
  ddgBaseURL?: string
  /** `User-Agent` sent on every request. Defaults to a Mozilla-compatible product token. */
  userAgent?: string
  /** Default result count when a request carries no `maxResults`. Omitted = none. */
  numResults?: number
}

export const Config: z<Config> = z.object({
  bingBaseURL: z.string(),
  ddgBaseURL: z.string(),
  userAgent: z.string(),
  numResults: z.number().step(1).min(1),
})

/** Register the keyless search provider with `ctx.web`. */
export function apply(ctx: Context, config: Config): void {
  ctx.web.registerSearchProvider(new FreeSearchProvider({
    bingBaseURL: config.bingBaseURL ?? FREE_DEFAULT_BING_BASE_URL,
    ddgBaseURL: config.ddgBaseURL ?? FREE_DEFAULT_DDG_BASE_URL,
    userAgent: config.userAgent ?? FREE_DEFAULT_USER_AGENT,
    ...config.numResults !== undefined ? { numResults: config.numResults } : {},
  }))
}
