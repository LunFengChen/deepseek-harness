import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import WebRuntime from '@x1a0f3n9/dsh-web'
import {
  FREE_DEFAULT_BING_BASE_URL,
  FREE_DEFAULT_DDG_BASE_URL,
  FREE_DEFAULT_USER_AGENT,
  FREE_PROVIDER_ID,
  FreeSearchProvider,
  bingSearchUrl,
  ddgSearchUrl,
} from '@x1a0f3n9/dsh-web-search-free'
import * as freePlugin from '@x1a0f3n9/dsh-web-search-free'

const options = {
  bingBaseURL: 'https://bing.test',
  ddgBaseURL: 'https://ddg.test',
  userAgent: 'test-agent',
}

const bingHtml = '<li class="b_algo"><h2><a href="https://bing-hit.test">Bing hit</a></h2><p>from bing</p></li>'
const ddgHtml = '<a class="result__a" href="https://ddg-hit.test">DDG hit</a><a class="result__snippet">from ddg</a>'

function htmlResponse(body: string, init: ResponseInit = {}): Response {
  return new Response(body, { status: 200, headers: { 'content-type': 'text/html' }, ...init })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('search URL builders', () => {
  it('appends Bing /search and optional count', () => {
    expect(bingSearchUrl('https://www.bing.com', 'hello world', undefined)).toBe('https://www.bing.com/search?q=hello+world')
    expect(bingSearchUrl('https://www.bing.com/', 'q', 5)).toBe('https://www.bing.com/search?q=q&count=5')
  })

  it('appends DuckDuckGo /html/', () => {
    expect(ddgSearchUrl('https://html.duckduckgo.com', 'hello world')).toBe('https://html.duckduckgo.com/html/?q=hello+world')
  })
})

describe('FreeSearchProvider availability', () => {
  it('is available with parseable bases and a user agent', () => {
    expect(new FreeSearchProvider(options).available()).toBe(true)
  })

  it('is unavailable when a base URL is unparseable', () => {
    expect(new FreeSearchProvider({ ...options, bingBaseURL: 'not a url' }).available()).toBe(false)
    expect(new FreeSearchProvider({ ...options, ddgBaseURL: 'not a url' }).available()).toBe(false)
  })

  it('is unavailable when the user agent is empty', () => {
    expect(new FreeSearchProvider({ ...options, userAgent: '' }).available()).toBe(false)
  })

  it('is misconfigured when numResults is set but not a positive integer', () => {
    expect(new FreeSearchProvider({ ...options, numResults: -1 }).available()).toBe(false)
    expect(new FreeSearchProvider({ ...options, numResults: 1.5 }).available()).toBe(false)
  })
})

describe('FreeSearchProvider request mapping', () => {

  it('forwards an AbortSignal to fetch', async () => {
    const fetchMock = vi.fn(async () => htmlResponse(bingHtml))
    vi.stubGlobal('fetch', fetchMock)
    const signal = new AbortController().signal
    await new FreeSearchProvider(options).search({ query: 'q' }, signal)
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(init.signal).toBe(signal)
  })

  it('queries Bing first and does not call DuckDuckGo when Bing has sources', async () => {
    const fetchMock = vi.fn(async () => htmlResponse(bingHtml))
    vi.stubGlobal('fetch', fetchMock)
    const result = await new FreeSearchProvider(options).search({ query: 'hello', maxResults: 5 })
    expect(result).toEqual({
      sources: [{ url: 'https://bing-hit.test', title: 'Bing hit', snippet: 'from bing' }],
      truncated: false,
    })
    expect(result.content).toBeUndefined()
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://bing.test/search?q=hello&count=5')
    expect(init).toMatchObject({ method: 'GET' })
    expect((init.headers as Record<string, string>)['user-agent']).toBe('test-agent')
    expect(init.redirect).toBe('follow')
  })

  it('falls back to the configured numResults when a request omits maxResults', async () => {
    const fetchMock = vi.fn(async () => htmlResponse(bingHtml))
    vi.stubGlobal('fetch', fetchMock)
    await new FreeSearchProvider({ ...options, numResults: 7 }).search({ query: 'q' })
    const [url] = fetchMock.mock.calls[0] as unknown as [string]
    expect(url).toBe('https://bing.test/search?q=q&count=7')
  })

  it('lets a request maxResults win over the configured numResults', async () => {
    const fetchMock = vi.fn(async () => htmlResponse(bingHtml))
    vi.stubGlobal('fetch', fetchMock)
    await new FreeSearchProvider({ ...options, numResults: 7 }).search({ query: 'q', maxResults: 3 })
    const [url] = fetchMock.mock.calls[0] as unknown as [string]
    expect(url).toBe('https://bing.test/search?q=q&count=3')
  })

  it('falls through to DuckDuckGo when Bing returns no sources', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('bing.test')) return htmlResponse('<html>empty</html>')
      return htmlResponse(ddgHtml)
    })
    vi.stubGlobal('fetch', fetchMock)
    const result = await new FreeSearchProvider(options).search({ query: 'q' })
    expect(result.sources).toEqual([{ url: 'https://ddg-hit.test', title: 'DDG hit', snippet: 'from ddg' }])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://ddg.test/html/?q=q')
  })

  it('falls through to DuckDuckGo when Bing returns HTTP error', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('bing.test')) return htmlResponse('nope', { status: 403 })
      return htmlResponse(ddgHtml)
    })
    vi.stubGlobal('fetch', fetchMock)
    const result = await new FreeSearchProvider(options).search({ query: 'q' })
    expect(result.sources[0]?.url).toBe('https://ddg-hit.test')
  })

  it('falls through to DuckDuckGo when Bing network-fails', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('bing.test')) throw new TypeError('connection refused')
      return htmlResponse(ddgHtml)
    })
    vi.stubGlobal('fetch', fetchMock)
    const result = await new FreeSearchProvider(options).search({ query: 'q' })
    expect(result.sources[0]?.url).toBe('https://ddg-hit.test')
  })

  it('returns empty sources when both engines succeed without hits', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => htmlResponse('<html></html>')))
    await expect(new FreeSearchProvider(options).search({ query: 'q' }))
      .resolves.toEqual({ sources: [], truncated: false })
  })

  it('maps dual engine failure to WEB_PROVIDER_ERROR', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('connection refused'))))
    await expect(new FreeSearchProvider(options).search({ query: 'q' }))
      .rejects.toThrow(expect.objectContaining({
        code: 'WEB_PROVIDER_ERROR',
        message: expect.stringContaining('Bing search request failed'),
      }))
  })

  it('maps an abort on Bing to WEB_ABORTED without calling DuckDuckGo', async () => {
    const fetchMock = vi.fn(() => Promise.reject(new DOMException('aborted', 'AbortError')))
    vi.stubGlobal('fetch', fetchMock)
    await expect(new FreeSearchProvider(options).search({ query: 'q' }))
      .rejects.toThrow(expect.objectContaining({ code: 'WEB_ABORTED' }))
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('maps an abort on DuckDuckGo after Bing emptiness to WEB_ABORTED', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('bing.test')) return htmlResponse('<html></html>')
      throw new DOMException('aborted', 'AbortError')
    })
    vi.stubGlobal('fetch', fetchMock)
    await expect(new FreeSearchProvider(options).search({ query: 'q' }))
      .rejects.toThrow(expect.objectContaining({ code: 'WEB_ABORTED' }))
  })

  it('surfaces an abort during body read as WEB_ABORTED', async () => {
    const body = { text: () => Promise.reject(new DOMException('aborted', 'AbortError')), ok: true, status: 200 }
    vi.stubGlobal('fetch', vi.fn(async () => body as unknown as Response))
    await expect(new FreeSearchProvider(options).search({ query: 'q' }))
      .rejects.toThrow(expect.objectContaining({ code: 'WEB_ABORTED' }))
  })


  it('returns empty sources when Bing succeeds with no hits and DuckDuckGo fails', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('bing.test')) return htmlResponse('<html></html>')
      throw new TypeError('connection refused')
    })
    vi.stubGlobal('fetch', fetchMock)
    await expect(new FreeSearchProvider(options).search({ query: 'q' }))
      .resolves.toEqual({ sources: [], truncated: false })
  })

  it('returns empty sources when Bing fails and DuckDuckGo succeeds with no hits', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('bing.test')) return htmlResponse('nope', { status: 403 })
      return htmlResponse('<html></html>')
    })
    vi.stubGlobal('fetch', fetchMock)
    await expect(new FreeSearchProvider(options).search({ query: 'q' }))
      .resolves.toEqual({ sources: [], truncated: false })
  })

  it('maps invalid base URLs through both engines to WEB_PROVIDER_ERROR', async () => {
    await expect(new FreeSearchProvider({
      bingBaseURL: 'not a url',
      ddgBaseURL: 'also bad',
      userAgent: 'test-agent',
    }).search({ query: 'q' })).rejects.toThrow(expect.objectContaining({
      code: 'WEB_PROVIDER_ERROR',
      message: expect.stringContaining('Bing search request failed'),
    }))
  })

  it('maps an unreadable success body to DuckDuckGo fallback, then WEB_PROVIDER_ERROR', async () => {
    const body = { text: () => Promise.reject(new TypeError('bad body')), ok: true, status: 200 }
    vi.stubGlobal('fetch', vi.fn(async () => body as unknown as Response))
    await expect(new FreeSearchProvider(options).search({ query: 'q' }))
      .rejects.toThrow(expect.objectContaining({
        code: 'WEB_PROVIDER_ERROR',
        message: expect.stringContaining('unreadable response body'),
      }))
  })
})

describe('web-search-free plugin registration', () => {
  it('registers the provider into ctx.web (HMR-safe)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => htmlResponse(bingHtml)))
    const ctx = new Context()
    await ctx.plugin(WebRuntime, { searchProvider: FREE_PROVIDER_ID })
    const fiber = await ctx.plugin(freePlugin, {
      bingBaseURL: options.bingBaseURL,
      ddgBaseURL: options.ddgBaseURL,
      userAgent: options.userAgent,
    })
    await expect(ctx.web.search({ query: 'q' })).resolves.toMatchObject({ truncated: false })
    await fiber.dispose()
    await expect(ctx.web.search({ query: 'q' }))
      .rejects.toThrow(expect.objectContaining({ code: 'WEB_PROVIDER_CONFIGURED_MISSING' }))
  })

  it('has no default export (namespace plugin export shape)', () => {
    expect('default' in freePlugin).toBe(false)
  })

  it('uses public defaults when config omits bases and user agent', async () => {
    const fetchMock = vi.fn(async () => htmlResponse(bingHtml))
    vi.stubGlobal('fetch', fetchMock)
    const ctx = new Context()
    await ctx.plugin(WebRuntime, { searchProvider: FREE_PROVIDER_ID })
    const fiber = await ctx.plugin(freePlugin, {})
    await ctx.web.search({ query: 'q', maxResults: 4 })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`${FREE_DEFAULT_BING_BASE_URL}/search?q=q&count=4`)
    expect((init.headers as Record<string, string>)['user-agent']).toBe(FREE_DEFAULT_USER_AGENT)
    expect(FREE_DEFAULT_DDG_BASE_URL).toContain('duckduckgo')
    await fiber.dispose()
  })

  it('threads numResults config into the Bing count parameter', async () => {
    const fetchMock = vi.fn(async () => htmlResponse(bingHtml))
    vi.stubGlobal('fetch', fetchMock)
    const ctx = new Context()
    await ctx.plugin(WebRuntime, { searchProvider: FREE_PROVIDER_ID })
    const fiber = await ctx.plugin(freePlugin, { numResults: 9 })
    await ctx.web.search({ query: 'q' })
    const [url] = fetchMock.mock.calls[0] as unknown as [string]
    expect(url).toContain('count=9')
    await fiber.dispose()
  })
})
