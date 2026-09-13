/**
 * HTML parsers for the keyless Bing and DuckDuckGo search backends.
 * Layout-sensitive: tests pin the selectors against fixture markup, not live pages.
 *
 * @module @x1a0f3n9/dsh-web-search-free/html
 */

import type { WebSearchSource } from '@x1a0f3n9/dsh-web'

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

/** True when `value` is an absolute http(s) URL. */
export function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

/**
 * Decode a common subset of HTML entities in attribute values and text.
 *
 * @param text - raw HTML text that may contain named or numeric entities.
 * @returns the decoded text; unknown entities are left unchanged.
 */
export function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body: string) => {
    if (body.startsWith('#')) {
      const hex = body[1] === 'x' || body[1] === 'X'
      const code = Number.parseInt(hex ? body.slice(2) : body.slice(1), hex ? 16 : 10)
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return match
      return String.fromCodePoint(code)
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match
  })
}

/**
 * Strip tags and collapse whitespace from an HTML fragment.
 *
 * @param html - an HTML fragment that may contain tags and entities.
 * @returns plain text, or `undefined` when nothing remains.
 */
export function visibleText(html: string): string | undefined {
  const text = decodeHtmlEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
  return text.length > 0 ? text : undefined
}

/**
 * Read one HTML attribute value, decoding entities.
 *
 * @param attrs - the raw attribute string inside a start tag.
 * @param name - the attribute name to read.
 * @returns the decoded value, or `undefined` when the attribute is absent.
 */
export function attributeValue(attrs: string, name: string): string | undefined {
  const match = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(attrs)
  const raw = match?.[1] ?? match?.[2]
  return raw === undefined ? undefined : decodeHtmlEntities(raw)
}

/**
 * Recover the destination URL from a Bing result href, including `/ck/a` tracking links.
 *
 * @param href - the `href` attribute from a Bing result anchor.
 * @returns an absolute http(s) URL, or `undefined` when none can be recovered.
 */
export function decodeBingHref(href: string): string | undefined {
  const trimmed = decodeHtmlEntities(href.trim())
  let url: URL
  try {
    url = new URL(trimmed, 'https://www.bing.com/')
  } catch {
    return undefined
  }
  const tracked = url.searchParams.get('u')
  if (tracked !== null && tracked.length > 0) {
    const decoded = decodeBingTrackedParam(tracked)
    if (decoded !== undefined) return decoded
  }
  if (isHttpUrl(trimmed) && !trimmed.includes('bing.com/ck/') && !isBingHost(url.hostname)) return trimmed
  if (isHttpUrl(url.href) && !isBingHost(url.hostname)) return url.href
  if (isHttpUrl(trimmed) && !trimmed.includes('bing.com/ck/')) return trimmed
  return undefined
}

/**
 * Recover the destination URL from a DuckDuckGo HTML result href, including `uddg=`.
 *
 * @param href - the `href` attribute from a DuckDuckGo result anchor.
 * @returns an absolute http(s) URL, or `undefined` when none can be recovered.
 */
export function decodeDdgHref(href: string): string | undefined {
  const trimmed = decodeHtmlEntities(href.trim())
  const absolute = trimmed.startsWith('//') ? `https:${trimmed}` : trimmed
  let url: URL
  try {
    url = new URL(absolute, 'https://html.duckduckgo.com/')
  } catch {
    return undefined
  }
  const uddg = url.searchParams.get('uddg')
  if (uddg !== null && isHttpUrl(uddg)) return uddg
  if (isHttpUrl(absolute) && !url.hostname.endsWith('duckduckgo.com')) return absolute
  return isHttpUrl(absolute) ? absolute : undefined
}

/**
 * Parse Bing SERP HTML into portable sources.
 *
 * @param html - a Bing `/search` HTML document.
 * @returns sources that have a recoverable http(s) URL; snippet-less hits are kept.
 */
export function parseBingHtml(html: string): WebSearchSource[] {
  const sources: WebSearchSource[] = []
  const seen = new Set<string>()
  const blockRe = /<li\b[^>]*\bb_algo\b[^>]*>([\s\S]*?)<\/li>/gi
  for (const match of html.matchAll(blockRe)) {
    const block = String(match[1])
    const heading = /<h2\b[^>]*>[\s\S]*?<a\b([^>]*)>([\s\S]*?)<\/a>/i.exec(block)
    const href = heading === null ? undefined : attributeValue(String(heading[1]), 'href')
    const title = heading === null ? undefined : visibleText(String(heading[2]))
    const cite = visibleText(/<cite\b[^>]*>([\s\S]*?)<\/cite>/i.exec(block)?.[1] ?? '')
    const snippet = visibleText(
      /<p\b[^>]*>([\s\S]*?)<\/p>/i.exec(block)?.[1]
        ?? /class="[^"]*\bb_lineclamp\d*\b[^"]*"[^>]*>([\s\S]*?)<\/(?:p|div)>/i.exec(block)?.[1]
        ?? '',
    )
    const url = (href === undefined ? undefined : decodeBingHref(href)) ?? urlFromCite(cite)
    pushSource(sources, seen, url, title, snippet)
  }
  return sources
}

/**
 * Parse DuckDuckGo HTML SERP markup into portable sources.
 *
 * @param html - a DuckDuckGo `/html/` document.
 * @returns sources that have a recoverable http(s) URL; snippet-less hits are kept.
 */
export function parseDdgHtml(html: string): WebSearchSource[] {
  const sources: WebSearchSource[] = []
  const seen = new Set<string>()
  const linkRe = /<a\b([^>]*\bresult__a\b[^>]*)>([\s\S]*?)<\/a>/gi
  for (const match of html.matchAll(linkRe)) {
    const attrs = String(match[1])
    const title = visibleText(String(match[2]))
    const href = attributeValue(attrs, 'href')
    const url = href === undefined ? undefined : decodeDdgHref(href)
    const start = Number(match.index)
    const after = html.slice(start + match[0].length, start + match[0].length + 1200)
    const snippet = visibleText(
      /<a\b[^>]*\bresult__snippet\b[^>]*>([\s\S]*?)<\/a>/i.exec(after)?.[1]
        ?? /class="[^"]*\bresult__snippet\b[^"]*"[^>]*>([\s\S]*?)<\//i.exec(after)?.[1]
        ?? '',
    )
    pushSource(sources, seen, url, title, snippet)
  }
  return sources
}

/** Bing tracking `u` values are base64 (optionally prefixed with two marker bytes). */
function decodeBingTrackedParam(value: string): string | undefined {
  if (isHttpUrl(value)) return value
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  for (const candidate of [padded.slice(2), padded]) {
    if (candidate.length === 0) continue
    const decoded = Buffer.from(candidate, 'base64').toString('utf8')
    if (isHttpUrl(decoded)) return decoded
  }
  return undefined
}

function isBingHost(hostname: string): boolean {
  return hostname === 'bing.com' || hostname.endsWith('.bing.com')
}

function urlFromCite(cite: string | undefined): string | undefined {
  if (cite === undefined) return undefined
  if (isHttpUrl(cite)) return cite
  const host = String(cite.split(/[›»|/]/)[0]).trim()
  if (/^[\w.-]+\.[a-z]{2,}$/i.test(host)) return `https://${host}`
  return undefined
}

function pushSource(
  sources: WebSearchSource[],
  seen: Set<string>,
  url: string | undefined,
  title: string | undefined,
  snippet: string | undefined,
): void {
  if (url === undefined || seen.has(url)) return
  seen.add(url)
  sources.push({
    url,
    ...title !== undefined ? { title } : {},
    ...snippet !== undefined ? { snippet } : {},
  })
}
