/** Tail-page JSONL reads must not restore the log from seq 0. */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { SESSION_FORMAT_VERSION, SessionId, SessionSeq } from '@x1a0f3n9/dsh-session'
import type { SessionEvent, SessionHeader } from '@x1a0f3n9/dsh-session'
import {
  SessionFormatUnsupportedError,
  SessionPersistenceNotFoundError,
} from '@x1a0f3n9/dsh-session-persistence'
import JsonlSessionPersistence from '@x1a0f3n9/dsh-session-persistence-jsonl'
import * as format from '../src/format.ts'
import { eventLines, generationLogPath, toHeaderLine } from '../src/format.ts'
import { readJsonlHistorySuffix } from '../src/history-suffix.ts'
import * as zstd from '../src/zstd.ts'
import { compressZstdFrame } from '../src/zstd.ts'
import { meta, oneTurnLog } from '../../session-persistence/tests/contract.ts'

const dirs: string[] = []

async function freshRoot(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-history-suffix-'))
  dirs.push(dir)
  return dir
}

function headerBytes(header: SessionHeader): Buffer {
  return Buffer.from(`${JSON.stringify(toHeaderLine(header))}\n`)
}

function plainLog(header: SessionHeader, events: readonly SessionEvent[]): Buffer {
  const body = events.length === 0 ? '' : `${eventLines(events)}\n`
  return Buffer.concat([headerBytes(header), Buffer.from(body)])
}

function remapTurn(seq0: number, turn: number): SessionEvent[] {
  return oneTurnLog().map((event, index) => {
    const seq = SessionSeq(seq0 + index)
    if (event.type === 'turn/start') {
      return { ...event, seq, time: seq + 1, data: { turn } }
    }
    if (event.type === 'turn/end') {
      return { ...event, seq, time: seq + 1, data: { turn, reason: event.data.reason } }
    }
    if (event.type === 'step/start' || event.type === 'step/end') {
      return { ...event, seq, time: seq + 1, data: { ...event.data, turn } }
    }
    return { ...event, seq, time: seq + 1 }
  })
}

afterEach(async () => {
  const leftover = dirs.splice(0)
  vi.restoreAllMocks()
  await Promise.all(leftover.map(dir => rm(dir, { recursive: true, force: true })))
})

describe('readJsonlHistorySuffix', () => {
  it('decodes only the newest Zstandard frames for one page', async () => {
    const header = meta('suffix-zstd', '/work')
    const frames = [await compressZstdFrame(headerBytes(header))]
    const turns = 40
    for (let turn = 1; turn <= turns; turn += 1) {
      frames.push(await compressZstdFrame(Buffer.from(`${eventLines(remapTurn((turn - 1) * 6, turn))}\n`)))
    }
    const decompress = vi.spyOn(zstd, 'decompressZstdFrame')
    const scanner = vi.spyOn(format, 'SessionLogScanner')
    const suffix = await readJsonlHistorySuffix(Buffer.concat(frames), 'zstd', { maxMessages: 50 })

    expect(scanner).not.toHaveBeenCalled()
    expect(decompress.mock.calls.length).toBeGreaterThan(1)
    expect(decompress.mock.calls.length).toBeLessThan(turns)
    expect(suffix.cursor).toBe(turns * 6 - 1)
    expect(suffix.inheritedEventCount).toBe(0)
    expect(suffix.events[0]?.seq).toBeGreaterThan(0)
    const messages = suffix.events.filter(event => (
      event.type === 'user/message' || event.type === 'assistant/message'
    ))
    expect(messages.length).toBeGreaterThanOrEqual(50)
  })

  it('walks an uncompressed log from the end and ignores a torn final line', async () => {
    const header = meta('suffix-none', '/work')
    const events = [...remapTurn(0, 1), ...remapTurn(6, 2), ...remapTurn(12, 3)]
    const bytes = Buffer.concat([
      plainLog(header, events),
      Buffer.from('{"type":"turn/start","seq":18'),
    ])
    const suffix = await readJsonlHistorySuffix(bytes, 'none', { maxMessages: 2 })
    expect(suffix.cursor).toBe(17)
    expect(suffix.events[0]?.seq).toBeGreaterThan(0)
    expect(suffix.events.some(event => event.seq === 0)).toBe(false)
  })

  it('returns an empty page payload when throughSeq is -1 but still exposes the cursor', async () => {
    const header = meta('suffix-empty-page', '/work')
    const suffix = await readJsonlHistorySuffix(plainLog(header, remapTurn(0, 1)), 'none', {
      maxMessages: 50,
      throughSeq: -1,
    })
    expect(suffix.cursor).toBe(5)
    expect(suffix.events.at(-1)?.seq).toBe(5)
  })

  it('collects older lines when beforeSeq sits behind the newest record', async () => {
    const header = meta('suffix-before', '/work')
    const events = [...remapTurn(0, 1), ...remapTurn(6, 2), ...remapTurn(12, 3)]
    const suffix = await readJsonlHistorySuffix(plainLog(header, events), 'none', {
      maxMessages: 2,
      beforeSeq: 12,
    })
    expect(suffix.events.at(-1)?.seq).toBe(17)
    expect(suffix.events.some(event => event.seq === 7)).toBe(true)
    expect(suffix.events.some(event => event.seq === 0)).toBe(false)
  })

  it('adds interrupted-turn closers when the open turn starts in the suffix', async () => {
    const header = meta('suffix-closers', '/work')
    const events = [
      ...remapTurn(0, 1),
      { type: 'turn/start', seq: SessionSeq(6), time: 7, data: { turn: 2 } },
    ] as SessionEvent[]
    const suffix = await readJsonlHistorySuffix(plainLog(header, events), 'none', { maxMessages: 50 })
    expect(suffix.events.some(event => event.type === 'turn/end' && event.seq > 6)).toBe(true)
    expect(suffix.cursor).toBeGreaterThan(6)
  })

  it('skips a nested session header line and expands sourceEventSeqs ranges', async () => {
    const header = meta('suffix-sources', '/work')
    const context: SessionEvent = {
      type: 'request/context',
      seq: SessionSeq(0),
      time: 1,
      data: { provider: 'p', model: 'm' },
    } as SessionEvent
    const message: SessionEvent = {
      type: 'user/message',
      seq: SessionSeq(1),
      time: 2,
      data: oneTurnLog()[1]?.data,
      surfaceOp: 'append',
      sourceEventSeqs: [SessionSeq(0)],
    } as SessionEvent
    const nestedHeader = JSON.stringify(toHeaderLine(header))
    const bytes = Buffer.from([
      JSON.stringify(toHeaderLine(header)),
      nestedHeader,
      eventLines([context, message]),
    ].join('\n') + '\n')
    const suffix = await readJsonlHistorySuffix(bytes, 'none', { maxMessages: 1 })
    const user = suffix.events.find(event => event.type === 'user/message')
    expect(user?.sourceEventSeqs).toEqual([0])
    expect(suffix.events.some(event => (event as { type: string }).type === 'session')).toBe(false)
  })

  it('refuses a suffix that is not dense', async () => {
    const header = meta('suffix-gap', '/work')
    const gapped = [
      { type: 'turn/start', seq: SessionSeq(0), time: 1, data: { turn: 1 } },
      { type: 'turn/end', seq: SessionSeq(2), time: 3, data: { turn: 1, reason: { kind: 'completed' } } },
    ] as SessionEvent[]
    await expect(readJsonlHistorySuffix(plainLog(header, gapped), 'none', { maxMessages: 50 }))
      .rejects.toThrow(/suffix is not dense/)
  })

  it('refuses an unparsable committed event', async () => {
    const header = meta('suffix-bad-json', '/work')
    const bytes = Buffer.concat([
      headerBytes(header),
      Buffer.from('{not json}\n'),
    ])
    await expect(readJsonlHistorySuffix(bytes, 'none', { maxMessages: 50 }))
      .rejects.toThrow(/unparsable committed event/)
  })

  it('refuses a header-less plaintext log', async () => {
    await expect(readJsonlHistorySuffix(Buffer.from('no-newline'), 'none', { maxMessages: 50 }))
      .rejects.toThrow(/empty or header-less session log/)
  })

  it('refuses a header-less Zstandard log', async () => {
    await expect(readJsonlHistorySuffix(Buffer.alloc(0), 'zstd', { maxMessages: 50 }))
      .rejects.toThrow(/empty or header-less Zstandard session log/)
  })

  it('refuses a first Zstandard frame that is not exactly one header line', async () => {
    const header = meta('suffix-zstd-header', '/work')
    const frame = await compressZstdFrame(Buffer.concat([
      headerBytes(header),
      Buffer.from(`${eventLines(remapTurn(0, 1))}\n`),
    ]))
    await expect(readJsonlHistorySuffix(frame, 'zstd', { maxMessages: 50 }))
      .rejects.toThrow(/first frame is not exactly one header line/)
  })

  it('recovers a torn Zstandard tail without requiring older frames', async () => {
    const header = meta('suffix-zstd-torn', '/work')
    const complete = Buffer.concat([
      await compressZstdFrame(headerBytes(header)),
      await compressZstdFrame(Buffer.from(`${eventLines(remapTurn(0, 1))}\n`)),
    ])
    const suffix = await readJsonlHistorySuffix(
      Buffer.concat([complete, Buffer.from([0x28, 0xb5])]),
      'zstd',
      { maxMessages: 50 },
    )
    expect(suffix.cursor).toBe(5)
  })

  it('honors an aborted signal before decoding', async () => {
    const abort = new AbortController()
    abort.abort()
    await expect(readJsonlHistorySuffix(plainLog(meta('suffix-abort', '/work'), []), 'none', {
      maxMessages: 50,
      signal: abort.signal,
    })).rejects.toThrow()
  })

  it('returns a header-only Zstandard log as an empty suffix', async () => {
    const header = meta('suffix-zstd-header-only', '/work')
    const suffix = await readJsonlHistorySuffix(
      await compressZstdFrame(headerBytes(header)),
      'zstd',
      { maxMessages: 50 },
    )
    expect(suffix.events).toEqual([])
    expect(suffix.cursor).toBe(-1)
  })

  it('skips an empty last Zstandard event frame and keeps reading older ones', async () => {
    const header = meta('suffix-zstd-empty-frame', '/work')
    const bytes = Buffer.concat([
      await compressZstdFrame(headerBytes(header)),
      await compressZstdFrame(Buffer.from(`${eventLines(remapTurn(0, 1))}\n`)),
      await compressZstdFrame(Buffer.from('\n')),
    ])
    const suffix = await readJsonlHistorySuffix(bytes, 'zstd', { maxMessages: 50 })
    expect(suffix.cursor).toBe(5)
    expect(suffix.events[0]?.seq).toBe(0)
  })

  it('keeps recovered torn Zstandard events in the suffix', async () => {
    const header = meta('suffix-zstd-torn-events', '/work')
    const complete = Buffer.concat([
      await compressZstdFrame(headerBytes(header)),
      await compressZstdFrame(Buffer.from(`${eventLines(remapTurn(0, 1))}\n`)),
    ])
    vi.spyOn(zstd, 'decompressZstdPrefix').mockResolvedValue(
      Buffer.from(`${eventLines(remapTurn(6, 2))}\n`),
    )
    const suffix = await readJsonlHistorySuffix(
      Buffer.concat([complete, Buffer.from([0x28, 0xb5])]),
      'zstd',
      { maxMessages: 50 },
    )
    expect(suffix.cursor).toBe(11)
    expect(suffix.events.some(event => event.seq === 6)).toBe(true)
  })

  it('ignores an undecodable torn Zstandard tail', async () => {
    const header = meta('suffix-zstd-torn-throw', '/work')
    const complete = Buffer.concat([
      await compressZstdFrame(headerBytes(header)),
      await compressZstdFrame(Buffer.from(`${eventLines(remapTurn(0, 1))}\n`)),
    ])
    vi.spyOn(zstd, 'decompressZstdPrefix').mockRejectedValue(new Error('torn frame'))
    const suffix = await readJsonlHistorySuffix(
      Buffer.concat([complete, Buffer.from([0x28, 0xb5])]),
      'zstd',
      { maxMessages: 50 },
    )
    expect(suffix.cursor).toBe(5)
  })

  it('propagates abort from a failed torn Zstandard recovery', async () => {
    const header = meta('suffix-zstd-torn-abort', '/work')
    const complete = Buffer.concat([
      await compressZstdFrame(headerBytes(header)),
      await compressZstdFrame(Buffer.from(`${eventLines(remapTurn(0, 1))}\n`)),
    ])
    const abort = new AbortController()
    vi.spyOn(zstd, 'decompressZstdPrefix').mockImplementation(async () => {
      abort.abort()
      throw new Error('torn frame')
    })
    await expect(readJsonlHistorySuffix(
      Buffer.concat([complete, Buffer.from([0x28, 0xb5])]),
      'zstd',
      { maxMessages: 50, signal: abort.signal },
    )).rejects.toThrow()
  })

  it('refuses an empty decompressed Zstandard header frame', async () => {
    const header = meta('suffix-zstd-empty-header', '/work')
    const frame = await compressZstdFrame(headerBytes(header))
    vi.spyOn(zstd, 'decompressZstdFrame').mockResolvedValueOnce(Buffer.alloc(0))
    await expect(readJsonlHistorySuffix(frame, 'zstd', { maxMessages: 50 }))
      .rejects.toThrow(/first frame is not exactly one header line/)
  })

  it('walks a short plaintext log through seq 0', async () => {
    const header = meta('suffix-plain-origin', '/work')
    const suffix = await readJsonlHistorySuffix(plainLog(header, remapTurn(0, 1)), 'none', {
      maxMessages: 50,
    })
    expect(suffix.events[0]?.seq).toBe(0)
    expect(suffix.cursor).toBe(5)
  })

  it('skips a blank plaintext line and a trailing nested session header', async () => {
    const header = meta('suffix-blank-nested', '/work')
    const events = remapTurn(0, 1)
    const bytes = Buffer.from([
      JSON.stringify(toHeaderLine(header)),
      '',
      eventLines(events),
      JSON.stringify(toHeaderLine(header)),
    ].join('\n') + '\n')
    const suffix = await readJsonlHistorySuffix(bytes, 'none', { maxMessages: 50 })
    expect(suffix.cursor).toBe(5)
    expect(suffix.events.some(event => (event as { type: string }).type === 'session')).toBe(false)
  })

  it('keeps the earliest source seq when later citations are newer', async () => {
    const header = meta('suffix-source-order', '/work')
    const message: SessionEvent = {
      type: 'user/message',
      seq: SessionSeq(2),
      time: 3,
      data: oneTurnLog()[1]?.data,
      surfaceOp: 'append',
      sourceEventSeqs: [SessionSeq(0), SessionSeq(1)],
    } as SessionEvent
    const suffix = await readJsonlHistorySuffix(plainLog(header, [message]), 'none', { maxMessages: 1 })
    expect(suffix.events[0]?.sourceEventSeqs).toEqual([0, 1])
  })

  it('stops a plaintext walk on a leading blank line', async () => {
    const header = meta('suffix-blank-only', '/work')
    const suffix = await readJsonlHistorySuffix(
      Buffer.concat([headerBytes(header), Buffer.from('\n')]),
      'none',
      { maxMessages: 50 },
    )
    expect(suffix.events).toEqual([])
    expect(suffix.cursor).toBe(-1)
  })

  it('ignores a plaintext body with no complete event record', async () => {
    const header = meta('suffix-incomplete-body', '/work')
    const suffix = await readJsonlHistorySuffix(
      Buffer.concat([headerBytes(header), Buffer.from('{"type":"turn/start"')]),
      'none',
      { maxMessages: 50 },
    )
    expect(suffix.events).toEqual([])
    expect(suffix.cursor).toBe(-1)
  })

  it('closes an open turn that started inside the suffix', async () => {
    const header = meta('suffix-open-turn', '/work')
    const events = remapTurn(0, 1).filter(event => event.type !== 'turn/end')
    const suffix = await readJsonlHistorySuffix(plainLog(header, events), 'none', { maxMessages: 50 })
    expect(suffix.events.some(event => event.type === 'turn/end')).toBe(true)
    expect(suffix.cursor).toBeGreaterThan(events.at(-1)?.seq ?? -1)
  })

  it('refuses a JSON array event row', async () => {
    const header = meta('suffix-array-row', '/work')
    const bytes = Buffer.concat([headerBytes(header), Buffer.from('[1]\n')])
    await expect(readJsonlHistorySuffix(bytes, 'none', { maxMessages: 50 }))
      .rejects.toThrow(/event row is not a JSON object/)
  })
})

describe('JsonlSessionPersistence.readHistorySuffix', () => {
  let root: string
  let ctx: Context

  beforeEach(async () => {
    root = await freshRoot()
    ctx = new Context()
    await ctx.plugin(JsonlSessionPersistence, { root, compression: 'none' })
  })

  afterEach(async () => {
    await ctx.fiber.dispose()
  })

  it('returns an empty pending suffix before the first durable write', async () => {
    const header = meta('suffix-pending', '/work')
    const handle = await ctx.sessionPersistence.create(header)
    try {
      await expect(ctx.sessionPersistence.readHistorySuffix(header.id, { maxMessages: 50 }))
        .resolves.toMatchObject({ events: [], cursor: -1, header: { id: header.id } })
    } finally {
      await handle.close()
    }
  })

  it('throws when the session does not exist', async () => {
    await expect(ctx.sessionPersistence.readHistorySuffix(SessionId('missing-suffix'), { maxMessages: 50 }))
      .rejects.toBeInstanceOf(SessionPersistenceNotFoundError)
  })

  it('returns undefined for a historical generation so callers can migrate', async () => {
    const header = meta('suffix-historical', '/work')
    const path = generationLogPath(root, header.cwd, header.id, 0, 'none')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, `${JSON.stringify({
      type: 'session',
      version: 0,
      id: header.id,
      createdAt: header.createdAt,
      cwd: header.cwd,
      delegationDepth: 0,
    })}\n`)
    await expect(ctx.sessionPersistence.readHistorySuffix(header.id, { maxMessages: 50 }))
      .resolves.toBeUndefined()
  })

  it('refuses a newer generation filename', async () => {
    const header = meta('suffix-future', '/work')
    const path = generationLogPath(root, header.cwd, header.id, SESSION_FORMAT_VERSION + 1, 'none')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, `${JSON.stringify(toHeaderLine(header))}\n`)
    await expect(ctx.sessionPersistence.readHistorySuffix(header.id, { maxMessages: 50 }))
      .rejects.toBeInstanceOf(SessionFormatUnsupportedError)
  })

  it('reads a current-generation suffix without constructing a SessionLogScanner', async () => {
    const header = meta('suffix-current', '/work')
    const handle = await ctx.sessionPersistence.create(header)
    await handle.append(oneTurnLog())
    await handle.close()
    const scanner = vi.spyOn(format, 'SessionLogScanner')
    const suffix = await ctx.sessionPersistence.readHistorySuffix(header.id, { maxMessages: 50 })
    expect(scanner).not.toHaveBeenCalled()
    expect(suffix?.cursor).toBe(5)
    expect(suffix?.inheritedEventCount).toBe(0)
  })

  it('honors an aborted signal before opening the log', async () => {
    const abort = new AbortController()
    abort.abort()
    await expect(ctx.sessionPersistence.readHistorySuffix(SessionId('suffix-persist-abort'), {
      maxMessages: 50,
      signal: abort.signal,
    })).rejects.toThrow()
  })
})
