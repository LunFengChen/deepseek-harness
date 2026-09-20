import { afterEach, describe, expect, it, vi } from 'vitest'
import { WebError } from '@x1a0f3n9/dsh-web'
import {
  classifyHttpStatus,
  poolFetchJson,
  poolFetchText,
  SearchPoolHttpError,
} from '@x1a0f3n9/dsh-web-search-pool'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('classifyHttpStatus', () => {
  it('maps auth, quota, and transient statuses', () => {
    expect(classifyHttpStatus(401)).toBe('auth')
    expect(classifyHttpStatus(403)).toBe('auth')
    expect(classifyHttpStatus(402)).toBe('quota')
    expect(classifyHttpStatus(429)).toBe('quota')
    expect(classifyHttpStatus(500)).toBe('transient')
    expect(classifyHttpStatus(200)).toBe('transient')
  })
})

describe('poolFetchText / poolFetchJson', () => {
  it('returns the body and pins redirect: error', async () => {
    const fetchMock = vi.fn(async () => new Response('{"ok":true}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(poolFetchJson('https://api.test/search', { method: 'GET' }))
      .resolves.toEqual({ ok: true })
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(init.redirect).toBe('error')
  })

  it('classifies HTTP errors and quota-hint bodies', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('rate limit exceeded', { status: 500 })))
    await expect(poolFetchText('https://api.test/search', { method: 'GET' }))
      .rejects.toSatisfy((error: unknown) => error instanceof SearchPoolHttpError
        && error.kind === 'quota'
        && error.status === 500
        && error.message.includes('HTTP 500'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 401 })))
    await expect(poolFetchText('https://api.test/search', { method: 'GET' }))
      .rejects.toBeInstanceOf(SearchPoolHttpError)
  })

  it('maps abort to WEB_ABORTED and other fetch failures to transient', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new DOMException('aborted', 'AbortError')
    }))
    await expect(poolFetchText('https://api.test/search', { method: 'GET' }))
      .rejects.toMatchObject({ code: 'WEB_ABORTED' })
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('offline')
    }))
    await expect(poolFetchText('https://api.test/search', { method: 'GET' }))
      .rejects.toMatchObject({ kind: 'transient' })
  })

  it('maps an unreadable body and abort-during-body', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      text: () => Promise.reject(new TypeError('bad body')),
    } as unknown as Response)))
    await expect(poolFetchText('https://api.test/search', { method: 'GET' }))
      .rejects.toSatisfy((error: unknown) => error instanceof SearchPoolHttpError
        && error.kind === 'transient'
        && error.message.includes('unreadable'))
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      text: () => Promise.reject(new DOMException('aborted', 'AbortError')),
    } as unknown as Response)))
    await expect(poolFetchText('https://api.test/search', { method: 'GET' }))
      .rejects.toBeInstanceOf(WebError)
  })

  it('rejects non-JSON success bodies', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not-json', { status: 200 })))
    await expect(poolFetchJson('https://api.test/search', { method: 'GET' }))
      .rejects.toSatisfy((error: unknown) => error instanceof SearchPoolHttpError
        && error.kind === 'transient'
        && error.message.includes('non-JSON'))
  })

  it('forwards AbortSignal to fetch', async () => {
    const fetchMock = vi.fn(async () => new Response('ok', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const signal = new AbortController().signal
    await poolFetchText('https://api.test/search', { method: 'GET' }, signal)
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(init.signal).toBe(signal)
  })
})
