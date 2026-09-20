import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import WebRuntime from '@x1a0f3n9/dsh-web'
import {
  defaultApiKeyEnvNames,
  resolveBackendKeys,
  SEARCH_POOL_DEFAULT_BACKENDS,
  SEARCH_POOL_DEFAULT_CIRCUIT,
  SEARCH_POOL_PROVIDER_ID,
  SearchPoolProvider,
} from '@x1a0f3n9/dsh-web-search-pool'
import * as poolPlugin from '@x1a0f3n9/dsh-web-search-pool'

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' }, ...init })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

const tavilyHit = { results: [{ url: 'https://ok.test', title: 'ok' }] }

describe('SearchPoolProvider', () => {
  it('is available when any backend is keyless or has keys', () => {
    expect(new SearchPoolProvider({
      strategy: 'failover',
      circuit: SEARCH_POOL_DEFAULT_CIRCUIT,
      backends: [{ id: 'free', kind: 'free', needsKey: false, keys: () => [] }],
    }).available()).toBe(true)
    expect(new SearchPoolProvider({
      strategy: 'failover',
      circuit: SEARCH_POOL_DEFAULT_CIRCUIT,
      backends: [{ id: 'tavily', kind: 'tavily', needsKey: true, keys: () => [] }],
    }).available()).toBe(false)
    expect(new SearchPoolProvider({
      strategy: 'failover',
      circuit: SEARCH_POOL_DEFAULT_CIRCUIT,
      backends: [{ id: 'tavily', kind: 'tavily', needsKey: true, keys: () => ['k'] }],
    }).available()).toBe(true)
  })

  it('fails over from a 429 key to the next key, then the next backend', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const auth = new Headers(init?.headers).get('authorization')
      if (auth === 'Bearer k1') return new Response('quota', { status: 429 })
      if (auth === 'Bearer k2') return new Response('offline', { status: 500 })
      return jsonResponse({ organic: [{ link: 'https://ok.test', title: 'ok' }] })
    })
    vi.stubGlobal('fetch', fetchMock)
    const provider = new SearchPoolProvider({
      strategy: 'failover',
      circuit: SEARCH_POOL_DEFAULT_CIRCUIT,
      backends: [
        { id: 'tavily', kind: 'tavily', needsKey: true, keys: () => ['k1', 'k2'], baseURL: 'http://tv.test' },
        { id: 'serper', kind: 'serper', needsKey: true, keys: () => ['s1'], baseURL: 'http://sr.test' },
      ],
    })
    await expect(provider.search({ query: 'q' })).resolves.toMatchObject({ sources: [{ url: 'https://ok.test' }] })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('skips an open circuit and exhausts with WEB_PROVIDER_ERROR', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 401 })))
    const provider = new SearchPoolProvider({
      strategy: 'failover',
      circuit: { ...SEARCH_POOL_DEFAULT_CIRCUIT, quotaCooldownMs: 60_000 },
      backends: [{ id: 'tavily', kind: 'tavily', needsKey: true, keys: () => ['k'], baseURL: 'http://tv.test' }],
    })
    await expect(provider.search({ query: 'q' })).rejects.toMatchObject({ code: 'WEB_PROVIDER_ERROR' })
    await expect(provider.search({ query: 'q' })).rejects.toThrow(/circuit open/)
  })

  it('rethrows abort without trying the next backend', async () => {
    const fetchMock = vi.fn(async () => {
      throw new DOMException('aborted', 'AbortError')
    })
    vi.stubGlobal('fetch', fetchMock)
    const provider = new SearchPoolProvider({
      strategy: 'failover',
      circuit: SEARCH_POOL_DEFAULT_CIRCUIT,
      backends: [
        { id: 'tavily', kind: 'tavily', needsKey: true, keys: () => ['k'], baseURL: 'http://tv.test' },
        { id: 'serper', kind: 'serper', needsKey: true, keys: () => ['s'], baseURL: 'http://sr.test' },
      ],
    })
    await expect(provider.search({ query: 'q' })).rejects.toMatchObject({ code: 'WEB_ABORTED' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('treats empty sources as success and does not fail over', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('tv.test')) return jsonResponse({ results: [] })
      return jsonResponse({ organic: [{ link: 'https://s.test' }] })
    })
    vi.stubGlobal('fetch', fetchMock)
    const provider = new SearchPoolProvider({
      strategy: 'failover',
      circuit: SEARCH_POOL_DEFAULT_CIRCUIT,
      backends: [
        { id: 'tavily', kind: 'tavily', needsKey: true, keys: () => ['k'], baseURL: 'http://tv.test' },
        { id: 'serper', kind: 'serper', needsKey: true, keys: () => ['s'], baseURL: 'http://sr.test' },
      ],
    })
    await expect(provider.search({ query: 'q' })).resolves.toEqual({ sources: [], truncated: false })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('round-robins the start backend under rotate', async () => {
    const seen: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      seen.push(url)
      return jsonResponse(tavilyHit)
    }))
    const provider = new SearchPoolProvider({
      strategy: 'rotate',
      circuit: SEARCH_POOL_DEFAULT_CIRCUIT,
      backends: [
        { id: 'a', kind: 'tavily', needsKey: true, keys: () => ['ka'], baseURL: 'http://a.test' },
        { id: 'b', kind: 'tavily', needsKey: true, keys: () => ['kb'], baseURL: 'http://b.test' },
      ],
    })
    await provider.search({ query: 'q' })
    await provider.search({ query: 'q' })
    await provider.search({ query: 'q' })
    expect(seen[0]).toContain('a.test')
    expect(seen[1]).toContain('b.test')
    expect(seen[2]).toContain('a.test')
  })

  it('wraps a raw abort from fetch as WEB_ABORTED', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new DOMException('aborted', 'AbortError')
    }))
    const provider = new SearchPoolProvider({
      strategy: 'failover',
      circuit: SEARCH_POOL_DEFAULT_CIRCUIT,
      backends: [{ id: 'tavily', kind: 'tavily', needsKey: true, keys: () => ['k'], baseURL: 'http://tv.test' }],
    })
    await expect(provider.search({ query: 'q' })).rejects.toMatchObject({ code: 'WEB_ABORTED' })
  })

  it('throws WEB_PROVIDER_UNAVAILABLE when no backend is ready', async () => {
    const provider = new SearchPoolProvider({
      strategy: 'failover',
      circuit: SEARCH_POOL_DEFAULT_CIRCUIT,
      backends: [{ id: 'tavily', kind: 'tavily', needsKey: true, keys: () => [] }],
    })
    await expect(provider.search({ query: 'q' }))
      .rejects.toMatchObject({ code: 'WEB_PROVIDER_UNAVAILABLE' })
  })
})

describe('key resolution', () => {
  it('lists default env names per kind', () => {
    expect(defaultApiKeyEnvNames('tavily')).toEqual(['TAVILY_API_KEYS', 'TAVILY_API_KEY'])
    expect(defaultApiKeyEnvNames('perplexity')).toEqual(['PERPLEXITY_API_KEY'])
    expect(defaultApiKeyEnvNames('exa')).toEqual(['EXA_API_KEY'])
    expect(defaultApiKeyEnvNames('serper')).toEqual(['SERPER_API_KEY'])
    expect(defaultApiKeyEnvNames('brave')).toEqual(['BRAVE_API_KEY'])
    expect(defaultApiKeyEnvNames('jina')).toEqual(['JINA_API_KEY'])
    expect(defaultApiKeyEnvNames('free')).toEqual([])
  })

  it('prefers a literal apiKey, then merges Tavily env lists', () => {
    const ctx = new Context()
    expect(resolveBackendKeys(ctx, { kind: 'tavily', apiKey: 'a, a b' })).toEqual(['a', 'b'])
    const prevKeys = process.env.TAVILY_API_KEYS
    const prevKey = process.env.TAVILY_API_KEY
    const prevExa = process.env.EXA_API_KEY
    process.env.TAVILY_API_KEYS = 'one,two'
    process.env.TAVILY_API_KEY = 'three'
    process.env.EXA_API_KEY = 'exa-env'
    try {
      expect(resolveBackendKeys(ctx, { kind: 'tavily' })).toEqual(['one', 'two', 'three'])
      expect(resolveBackendKeys(ctx, { kind: 'tavily', apiKeyEnv: 'TAVILY_API_KEYS' })).toEqual(['one', 'two', 'three'])
      expect(resolveBackendKeys(ctx, { kind: 'tavily', apiKey: '', apiKeyEnv: 'TAVILY_API_KEY' })).toEqual(['three'])
      expect(resolveBackendKeys(ctx, { kind: 'exa', apiKeyEnv: 'EXA_API_KEY' })).toEqual(['exa-env'])
      expect(resolveBackendKeys(ctx, { kind: 'free' })).toEqual([])
    } finally {
      if (prevKeys === undefined) delete process.env.TAVILY_API_KEYS
      else process.env.TAVILY_API_KEYS = prevKeys
      if (prevKey === undefined) delete process.env.TAVILY_API_KEY
      else process.env.TAVILY_API_KEY = prevKey
      if (prevExa === undefined) delete process.env.EXA_API_KEY
      else process.env.EXA_API_KEY = prevExa
    }
  })
})

describe('web-search-pool plugin registration', () => {
  it('registers the provider into ctx.web (HMR-safe) and has no default export', async () => {
    expect('default' in poolPlugin).toBe(false)
    expect(poolPlugin.name).toBe('web-search-pool')
    expect(poolPlugin.inject).toEqual(['web'])
    expect(SEARCH_POOL_DEFAULT_BACKENDS.map(b => b.id)).toEqual([
      'tavily', 'perplexity', 'exa', 'serper', 'brave', 'jina', 'free',
    ])
    const bingHtml = '<li class="b_algo"><h2><a href="https://bing-hit.test">Bing hit</a></h2><p>from bing</p></li>'
    vi.stubGlobal('fetch', vi.fn(async () => new Response(bingHtml, { status: 200 })))
    const ctx = new Context()
    await ctx.plugin(WebRuntime, { searchProvider: SEARCH_POOL_PROVIDER_ID })
    const fiber = await ctx.plugin(poolPlugin, { backends: [] })
    await expect(ctx.web.search({ query: 'q' })).resolves.toMatchObject({
      sources: [{ url: 'https://bing-hit.test' }],
    })
    await fiber.dispose()
    await expect(ctx.web.search({ query: 'q' }))
      .rejects.toMatchObject({ code: 'WEB_PROVIDER_CONFIGURED_MISSING' })
  })

  it('threads strategy, circuit, and backend config, including env keys', async () => {
    const prev = process.env.SERPER_API_KEY
    process.env.SERPER_API_KEY = 'env-serper'
    try {
      const fetchMock = vi.fn(async () => jsonResponse({ organic: [{ link: 'https://s.test' }] }))
      vi.stubGlobal('fetch', fetchMock)
      const ctx = new Context()
      await ctx.plugin(WebRuntime, { searchProvider: SEARCH_POOL_PROVIDER_ID })
      const fiber = await ctx.plugin(poolPlugin, {
        strategy: 'failover',
        circuitFailureThreshold: 2,
        circuitWindowMs: 1000,
        circuitCooldownMs: 1000,
        quotaCooldownMs: 2000,
        backends: [{ id: 'serper', kind: 'serper', baseURL: 'http://serper.test' }],
      })
      await ctx.web.search({ query: 'q' })
      const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
      expect(url).toBe('http://serper.test/search')
      expect(new Headers(init.headers).get('x-api-key')).toBe('env-serper')
      await fiber.dispose()
    } finally {
      if (prev === undefined) delete process.env.SERPER_API_KEY
      else process.env.SERPER_API_KEY = prev
    }
  })

  it('apply fills omitted strategy, circuit, and default backends', async () => {
    const bingHtml = '<li class="b_algo"><h2><a href="https://bing-hit.test">Bing hit</a></h2><p>from bing</p></li>'
    vi.stubGlobal('fetch', vi.fn(async () => new Response(bingHtml, { status: 200 })))
    const ctx = new Context()
    await ctx.plugin(WebRuntime, { searchProvider: SEARCH_POOL_PROVIDER_ID })
    poolPlugin.apply(ctx, {})
    await expect(ctx.web.search({ query: 'q' })).resolves.toMatchObject({
      sources: [{ url: 'https://bing-hit.test' }],
    })
  })

  it('defaults backend id to kind and honors needsKey: false', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(tavilyHit))
    vi.stubGlobal('fetch', fetchMock)
    const ctx = new Context()
    await ctx.plugin(WebRuntime, { searchProvider: SEARCH_POOL_PROVIDER_ID })
    const fiber = await ctx.plugin(poolPlugin, {
      strategy: 'rotate',
      backends: [{ kind: 'tavily', needsKey: false, baseURL: 'http://anon.tavily.test' }],
    })
    await ctx.web.search({ query: 'q' })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('http://anon.tavily.test/search')
    expect(new Headers(init.headers).get('authorization')).toMatch(/^Bearer/)
    await fiber.dispose()
  })

  it('keeps name/inject/Config through unwrapExports and boots via Loader', async () => {
    expect('default' in poolPlugin).toBe(false)
    const loader = Object.create(Loader.prototype) as Loader
    const unwrapped = loader.unwrapExports(poolPlugin) as Record<string, unknown>
    expect(unwrapped).toBe(poolPlugin)
    expect(unwrapped.name).toBe('web-search-pool')
    expect(unwrapped.inject).toEqual(['web'])
    expect(typeof unwrapped.apply).toBe('function')
    expect(unwrapped.Config).toBe(poolPlugin.Config)
  })
})

describe('web-search-pool Loader composition', () => {
  it('registers through a real cordis.yml and returns search sources', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-search-pool-'))
    const ctx = new Context()
    try {
      const configPath = join(root, 'cordis.yml')
      await writeFile(configPath, [
        "- name: '@x1a0f3n9/dsh-web'",
        '  config:',
        '    searchProvider: search-pool',
        "- name: '@x1a0f3n9/dsh-web-search-pool'",
        '  config:',
        '    backends:',
        '      - id: tavily',
        '        kind: tavily',
        '        apiKey: loader-key',
        '        baseURL: http://tavily.test',
        '',
      ].join('\n'))
      vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(tavilyHit)))
      ctx.baseUrl = `${pathToFileURL(root).href}/`
      await ctx.plugin(Loader)
      ctx.loader.builtins.include = Include
      const modules = new Map<string, unknown>([
        ['@x1a0f3n9/dsh-web', WebRuntime],
        ['@x1a0f3n9/dsh-web-search-pool', poolPlugin],
      ])
      ctx.loader.internal = {
        version: 'v2',
        async import(specifier: string) {
          if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
          return modules.get(specifier)
        },
      } as unknown as NonNullable<typeof ctx.loader.internal>
      await ctx.loader.create({
        name: 'cordis:include',
        config: { path: pathToFileURL(configPath).href },
      })
      await ctx.loader.await()
      await expect(ctx.web.search({ query: 'q' })).resolves.toMatchObject({
        sources: [{ url: 'https://ok.test' }],
      })
    } finally {
      await ctx.fiber.dispose()
      await rm(root, { recursive: true, force: true })
    }
  })
})
