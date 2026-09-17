import { afterEach, describe, expect, it, vi } from 'vitest'
import { WebError } from '@x1a0f3n9/dsh-web'
import {
  BRAVE_DEFAULT_BASE_URL,
  JINA_DEFAULT_BASE_URL,
  TAVILY_DEFAULT_BASE_URL,
  classifyAdapterError,
  parseJinaMarkdown,
  searchWithAdapter,
  SearchPoolHttpError,
} from '@x1a0f3n9/dsh-web-search-pool'

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' }, ...init })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('parseJinaMarkdown', () => {
  it('collects title, url, and following snippet lines up to maxResults', () => {
    const md = [
      '[1. Alpha](https://a.test)',
      'first sentence',
      'Search results',
      '1) ignored',
      '[Beta](https://b.test)',
      'second',
      '[Gamma](https://c.test)',
      'third',
    ].join('\n')
    expect(parseJinaMarkdown(md, 2)).toEqual([
      { url: 'https://a.test', title: 'Alpha', snippet: 'first sentence' },
      { url: 'https://b.test', title: 'Beta', snippet: 'second' },
    ])
  })

  it('omits blank titles and snippets', () => {
    expect(parseJinaMarkdown('preamble\n[*](https://a.test)\n', 5)).toEqual([{ url: 'https://a.test' }])
  })

  it('drops overflow hits when maxResults is already full at push', () => {
    expect(parseJinaMarkdown('[A](https://a.test)\n[B](https://b.test)\n', 1)).toEqual([
      { url: 'https://a.test', title: 'A' },
    ])
  })
})

describe('searchWithAdapter', () => {
  it('maps a Tavily JSON body including an answer', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      answer: 'sum',
      results: [
        { url: 'https://a.test', title: 'A', content: 'long'.repeat(200) },
        { url: 'https://bare.tavily.test' },
        { title: 'no url' },
      ],
    }))
    vi.stubGlobal('fetch', fetchMock)
    const result = await searchWithAdapter({ kind: 'tavily', apiKey: 'tv' }, { query: 'q', maxResults: 3 })
    expect(result.content).toBe('sum')
    expect(result.sources[0]?.url).toBe('https://a.test')
    expect(result.sources[0]?.snippet?.length).toBe(500)
    expect(result.sources).toEqual([
      expect.objectContaining({ url: 'https://a.test', title: 'A' }),
      { url: 'https://bare.tavily.test' },
    ])
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`${TAVILY_DEFAULT_BASE_URL}/search`)
    expect(init.redirect).toBe('error')
    expect(JSON.parse(init.body as string)).toMatchObject({ query: 'q', max_results: 3, search_depth: 'basic' })
  })

  it('maps empty Tavily and Serper payloads without an answer', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(null)))
    await expect(searchWithAdapter({ kind: 'tavily', apiKey: 'tv' }, { query: 'q' }))
      .resolves.toEqual({ sources: [], truncated: false })
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ organic: 'nope' })))
    await expect(searchWithAdapter({ kind: 'serper', apiKey: 'sk' }, { query: 'q' }))
      .resolves.toEqual({ sources: [], truncated: false })
  })

  it('maps Serper organic hits and an answer box', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      organic: [
        { link: 'https://s.test', title: 'S', snippet: 'sn', date: '2026-01-01' },
        { link: 'https://bare.serper.test' },
        { title: 'skip' },
      ],
      answerBox: { answer: 'box' },
    })))
    const result = await searchWithAdapter({ kind: 'serper', apiKey: 'sk', baseURL: 'https://serper.test' }, { query: 'q' })
    expect(result).toEqual({
      content: 'box',
      truncated: false,
      sources: [
        { url: 'https://s.test', title: 'S', snippet: 'sn', publishedAt: '2026-01-01' },
        { url: 'https://bare.serper.test' },
      ],
    })
  })

  it('maps Brave web results', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      web: { results: [{ url: 'https://b.test', title: 'B', description: 'd', age: '1d' }, { url: 'https://bare.brave.test' }, {}] },
    }))
    vi.stubGlobal('fetch', fetchMock)
    const result = await searchWithAdapter({ kind: 'brave', apiKey: 'br' }, { query: 'q', maxResults: 2 })
    expect(result.sources).toEqual([
      { url: 'https://b.test', title: 'B', snippet: 'd', publishedAt: '1d' },
      { url: 'https://bare.brave.test' },
    ])
    const [url] = fetchMock.mock.calls[0] as unknown as [string]
    expect(url).toBe(`${BRAVE_DEFAULT_BASE_URL}/res/v1/web/search?q=q&count=2`)
  })

  it('parses Jina markdown', async () => {
    const fetchMock = vi.fn(async () => new Response('[Hit](https://j.test)\nbody', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const result = await searchWithAdapter({ kind: 'jina', apiKey: 'jn' }, { query: 'hello world' })
    expect(result.sources).toEqual([{ url: 'https://j.test', title: 'Hit', snippet: 'body' }])
    const [url] = fetchMock.mock.calls[0] as unknown as [string]
    expect(url).toBe(`${JINA_DEFAULT_BASE_URL}/${encodeURIComponent('hello world')}`)
  })

  it('constructs Exa, Perplexity, and free providers', async () => {
    const fetchMock = vi.fn(async (input: string) => {
      if (input.includes('exa')) return jsonResponse({ results: [{ url: 'https://e.test', highlights: ['h'] }] })
      if (input.includes('perplexity')) {
        return jsonResponse({ choices: [{ message: { content: 'ans' } }], citations: ['https://p.test'] })
      }
      return new Response('<li class="b_algo"><h2><a href="https://f.test">F</a></h2><p>sn</p></li>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)
    await expect(searchWithAdapter({ kind: 'exa', apiKey: 'ek' }, { query: 'q' }))
      .resolves.toMatchObject({ sources: [{ url: 'https://e.test', snippet: 'h' }] })
    await expect(searchWithAdapter({ kind: 'exa', apiKey: 'ek' }, { query: 'q', maxResults: 3 }))
      .resolves.toMatchObject({ sources: [{ url: 'https://e.test', snippet: 'h' }] })
    await expect(searchWithAdapter({ kind: 'perplexity', apiKey: 'pk' }, { query: 'q' }))
      .resolves.toMatchObject({ content: 'ans' })
    await expect(searchWithAdapter({ kind: 'free', apiKey: '' }, { query: 'q', maxResults: 2 }))
      .resolves.toMatchObject({ sources: [{ url: 'https://f.test' }] })
  })
})

describe('classifyAdapterError', () => {
  it('passes SearchPoolHttpError through and classifies WebError messages', () => {
    const original = new SearchPoolHttpError('x', 'quota', 429)
    expect(classifyAdapterError(original)).toBe(original)
    expect(classifyAdapterError(new WebError('Exa API error (HTTP 429)', 'WEB_PROVIDER_ERROR')).kind).toBe('quota')
    expect(classifyAdapterError(new WebError('Exa API error (HTTP 401)', 'WEB_PROVIDER_ERROR')).kind).toBe('auth')
    expect(classifyAdapterError(new WebError('Exa API error (HTTP 403)', 'WEB_PROVIDER_ERROR')).kind).toBe('auth')
    expect(classifyAdapterError(new WebError('Exa API error (HTTP 402)', 'WEB_PROVIDER_ERROR')).kind).toBe('quota')
    expect(classifyAdapterError(new WebError('HTTP 500: quota exceeded', 'WEB_PROVIDER_ERROR')).kind).toBe('quota')
    expect(classifyAdapterError(new WebError('quota exceeded', 'WEB_PROVIDER_ERROR')).kind).toBe('quota')
    expect(classifyAdapterError(new WebError('Exa API error (HTTP 500)', 'WEB_PROVIDER_ERROR')).kind).toBe('transient')
    expect(classifyAdapterError(new Error('offline')).kind).toBe('transient')
    expect(classifyAdapterError('bare').kind).toBe('transient')
  })

  it('rethrows WEB_ABORTED', () => {
    const aborted = new WebError('aborted', 'WEB_ABORTED')
    expect(() => classifyAdapterError(aborted)).toThrow(aborted)
  })
})
