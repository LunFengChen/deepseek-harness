/**
 * Tail-page decoder for JSONL session logs. It scans cheap Zstandard frame
 * boundaries and decompresses only the newest frames that cover one history
 * page, without constructing a {@link SessionLogScanner} from seq 0. Path
 * reads scan those frames from the file instead of one whole-artifact Buffer.
 */

import { open as fsOpen, type FileHandle } from 'node:fs/promises'
import { assertV3RowAdmission } from '@x1a0f3n9/dsh-session-format-v2-to-v3'
import {
  decodeSeqRanges,
  interruptedTurnClosers,
  isAppendSurfaceEvent,
  SessionSeq,
  SessionLogOffset,
} from '@x1a0f3n9/dsh-session'
import type {
  SessionEvent,
  SessionHeader,
} from '@x1a0f3n9/dsh-session'
import type {
  SessionHistorySuffix,
  SessionHistorySuffixOptions,
} from '@x1a0f3n9/dsh-session-persistence'
import { parseHeaderRecord, type JsonlCompression } from './format.ts'
import {
  decompressZstdFrame,
  decompressZstdPrefix,
  scanZstdFrames,
  scanZstdFramesFromReader,
  type ZstdFrameRange,
} from './zstd.ts'

const MESSAGE_TYPES = new Set(['user/message', 'assistant/message'])
const PLAIN_SUFFIX_CHUNK_BYTES = 256 * 1024

/**
 * Decode one history-page suffix from a current-generation JSONL artifact.
 * @param bytes - complete file bytes, possibly with a torn final Zstandard frame.
 * @param compression - physical encoding of this generation.
 * @param options - page bounds and cancellation.
 * @returns header, covering events, and the logical cursor.
 */
export async function readJsonlHistorySuffix(
  bytes: Buffer,
  compression: JsonlCompression,
  options: SessionHistorySuffixOptions,
): Promise<SessionHistorySuffix> {
  return compression === 'zstd'
    ? readZstdSuffix(bytes, options)
    : readPlainSuffix(bytes, options)
}

/**
 * Decode one history-page suffix from a generation file without materializing
 * the complete artifact as one Buffer.
 * @param path - current-generation JSONL path.
 * @param compression - physical encoding of this generation.
 * @param options - page bounds and cancellation.
 * @returns header, covering events, and the logical cursor.
 */
export async function readJsonlHistorySuffixFromPath(
  path: string,
  compression: JsonlCompression,
  options: SessionHistorySuffixOptions,
): Promise<SessionHistorySuffix> {
  options.signal?.throwIfAborted()
  const handle = await fsOpen(path, 'r')
  try {
    const size = (await handle.stat()).size
    options.signal?.throwIfAborted()
    return compression === 'zstd'
      ? await readZstdSuffixFromHandle(handle, size, options)
      : await readPlainSuffixFromHandle(handle, size, options)
  } finally {
    await handle.close()
  }
}

/**
 * Decode a Zstandard log by scanning frame boundaries and decompressing only
 * the newest event frames that cover the requested page.
 * @param bytes - concatenated frames, possibly with a torn final frame.
 * @param options - page bounds and cancellation.
 * @returns the covering suffix.
 */
async function readZstdSuffix(
  bytes: Buffer,
  options: SessionHistorySuffixOptions,
): Promise<SessionHistorySuffix> {
  options.signal?.throwIfAborted()
  const scan = scanZstdFrames(bytes)
  return collectZstdSuffix(
    scan.frames,
    scan.tornStart,
    bytes.length,
    (start, end) => Promise.resolve(bytes.subarray(start, end)),
    options,
  )
}

/**
 * Decode a Zstandard log from a file handle by scanning frame boundaries and
 * decompressing only the header plus the newest covering event frames.
 * @param handle - readable generation file.
 * @param fileSize - exclusive end of the readable range.
 * @param options - page bounds and cancellation.
 * @returns the covering suffix.
 */
async function readZstdSuffixFromHandle(
  handle: FileHandle,
  fileSize: number,
  options: SessionHistorySuffixOptions,
): Promise<SessionHistorySuffix> {
  const scan = await scanZstdFramesFromReader(
    fileSize,
    (start, end) => readHandleRange(handle, start, end, options.signal),
    options.signal,
  )
  return collectZstdSuffix(
    scan.frames,
    scan.tornStart,
    fileSize,
    (start, end) => readHandleRange(handle, start, end, options.signal),
    options,
  )
}

/**
 * Collect one suffix page from already-located Zstandard frames.
 * @param frames - complete frames in file order.
 * @param tornStart - start of an incomplete final frame, when present.
 * @param fileSize - exclusive end of the readable range.
 * @param readSlice - exclusive-end byte reader.
 * @param options - page bounds and cancellation.
 * @returns the covering suffix.
 */
async function collectZstdSuffix(
  frames: readonly ZstdFrameRange[],
  tornStart: number | undefined,
  fileSize: number,
  readSlice: (start: number, end: number) => Promise<Buffer>,
  options: SessionHistorySuffixOptions,
): Promise<SessionHistorySuffix> {
  const headerFrame = frames[0]
  if (headerFrame === undefined) throw new Error('empty or header-less Zstandard session log')
  const headerPlain = await decompressZstdFrame(await readSlice(headerFrame.start, headerFrame.end))
  assertZstdHeaderFrame(headerPlain)
  const header = parseHeaderRecord(headerPlain).meta
  const eventFrames = frames.slice(1)
  const collected: SessionEvent[][] = []

  if (tornStart !== undefined) {
    options.signal?.throwIfAborted()
    let recovered: Buffer = Buffer.alloc(0)
    try {
      recovered = Buffer.from(await decompressZstdPrefix(await readSlice(tornStart, fileSize)))
    } catch {
      if (options.signal?.aborted === true) options.signal.throwIfAborted()
    }
    const tornEvents = parseEventRecords(recovered)
    if (tornEvents.length > 0) collected.push(tornEvents)
  }

  if (eventFrames.length > 0) {
    const last = eventFrames[eventFrames.length - 1]
    /* v8 ignore next -- length > 0 guarantees a last complete event frame. */
    if (last === undefined) throw new Error('empty or header-less Zstandard session log')
    options.signal?.throwIfAborted()
    collected.unshift(parseEventRecords(
      await decompressZstdFrame(await readSlice(last.start, last.end)),
    ))
    for (let index = eventFrames.length - 2; index >= 0; index -= 1) {
      if (suffixComplete(collected.flat(), options)) break
      const frame = eventFrames[index]
      /* v8 ignore next -- the countdown stays inside the scanned event-frame list. */
      if (frame === undefined) continue
      options.signal?.throwIfAborted()
      collected.unshift(parseEventRecords(
        await decompressZstdFrame(await readSlice(frame.start, frame.end)),
      ))
    }
  }

  return finishSuffix(header, collected.flat(), options.signal)
}

/**
 * Walk complete JSONL records from the end of an uncompressed log.
 * @param bytes - header line plus event rows, possibly with a torn final line.
 * @param options - page bounds and cancellation.
 * @returns the covering suffix.
 */
function readPlainSuffix(
  bytes: Buffer,
  options: SessionHistorySuffixOptions,
): Promise<SessionHistorySuffix> {
  options.signal?.throwIfAborted()
  const headerEnd = bytes.indexOf(0x0A)
  if (headerEnd === -1) throw new Error('empty or header-less session log')
  const header = parseHeaderRecord(bytes.subarray(0, headerEnd + 1)).meta
  const records = eventsFromPlainBody(bytes.subarray(headerEnd + 1), options)
  return Promise.resolve(finishSuffix(header, records, options.signal))
}

/**
 * Walk complete JSONL records from the end of an uncompressed generation file.
 * @param handle - readable generation file.
 * @param fileSize - exclusive end of the readable range.
 * @param options - page bounds and cancellation.
 * @returns the covering suffix.
 */
async function readPlainSuffixFromHandle(
  handle: FileHandle,
  fileSize: number,
  options: SessionHistorySuffixOptions,
): Promise<SessionHistorySuffix> {
  options.signal?.throwIfAborted()
  const { header, headerEnd } = await readPlainHeader(handle, fileSize, options.signal)
  if (headerEnd >= fileSize) return finishSuffix(header, [], options.signal)

  let windowStart = fileSize
  let tail = Buffer.alloc(0)
  while (true) {
    options.signal?.throwIfAborted()
    const atHeader = windowStart <= headerEnd
    const aligned = alignedPlainBody(tail, atHeader)
    if (aligned.length > 0) {
      const records = eventsFromPlainBody(aligned, options)
      if (suffixComplete(records, options) || atHeader) {
        return finishSuffix(header, records, options.signal)
      }
    } else if (atHeader) {
      return finishSuffix(header, [], options.signal)
    }
    const readStart = Math.max(headerEnd, windowStart - PLAIN_SUFFIX_CHUNK_BYTES)
    const older = await readHandleRange(handle, readStart, windowStart, options.signal)
    tail = Buffer.concat([older, tail])
    windowStart = readStart
  }
}

/**
 * Read the header line from the start of an uncompressed log.
 * @param handle - readable generation file.
 * @param fileSize - exclusive end of the readable range.
 * @param signal - optional cancellation.
 * @returns parsed header and exclusive end offset of its line.
 */
async function readPlainHeader(
  handle: FileHandle,
  fileSize: number,
  signal: AbortSignal | undefined,
): Promise<{ header: SessionHeader; headerEnd: number }> {
  let offset = 0
  let acc = Buffer.alloc(0)
  while (offset < fileSize) {
    signal?.throwIfAborted()
    const end = Math.min(fileSize, offset + 8192)
    acc = Buffer.concat([acc, await readHandleRange(handle, offset, end, signal)])
    const newline = acc.indexOf(0x0A)
    if (newline !== -1) {
      return {
        header: parseHeaderRecord(acc.subarray(0, newline + 1)).meta,
        headerEnd: newline + 1,
      }
    }
    offset = end
  }
  throw new Error('empty or header-less session log')
}

/**
 * Complete JSONL body bytes that start on a record boundary.
 * @param tail - bytes from the current window start through EOF.
 * @param atHeader - whether the window start is the first event byte.
 * @returns newline-terminated records, possibly empty.
 */
function alignedPlainBody(tail: Buffer, atHeader: boolean): Buffer {
  const completeEnd = lastCompleteRecordEnd(tail)
  if (completeEnd === 0) return Buffer.alloc(0)
  if (atHeader) return tail.subarray(0, completeEnd)
  const firstNewline = tail.indexOf(0x0A)
  if (firstNewline + 1 >= completeEnd) return Buffer.alloc(0)
  return tail.subarray(firstNewline + 1, completeEnd)
}

/**
 * Walk complete JSONL records from the end of one uncompressed body.
 * @param body - event-body bytes after the header line.
 * @param options - page bounds and cancellation.
 * @returns decoded events covering the requested page.
 */
function eventsFromPlainBody(
  body: Buffer,
  options: SessionHistorySuffixOptions,
): SessionEvent[] {
  const records: SessionEvent[] = []
  let lineEnd = lastCompleteRecordEnd(body)
  while (lineEnd > 0) {
    options.signal?.throwIfAborted()
    // Buffer.lastIndexOf treats a negative offset as from-end, so lineEnd 1
    // would otherwise rediscover the leading newline and never advance.
    const previous = lineEnd <= 1 ? -1 : body.lastIndexOf(0x0A, lineEnd - 2)
    const lineStart = previous === -1 ? 0 : previous + 1
    records.unshift(...parseEventRecords(body.subarray(lineStart, lineEnd)))
    if (suffixComplete(records, options)) break
    if (lineStart === 0) break
    lineEnd = lineStart
  }
  return records
}

/**
 * Read an exclusive byte range from a file handle.
 * @param handle - readable file.
 * @param start - inclusive start offset.
 * @param end - exclusive end offset.
 * @param signal - optional cancellation.
 * @returns the bytes present in that range.
 */
async function readHandleRange(
  handle: FileHandle,
  start: number,
  end: number,
  signal?: AbortSignal,
): Promise<Buffer> {
  signal?.throwIfAborted()
  const length = end - start
  /* v8 ignore next -- callers pass a forward range from stat.size. */
  if (length <= 0) return Buffer.alloc(0)
  const buffer = Buffer.alloc(length)
  let offset = 0
  while (offset < length) {
    signal?.throwIfAborted()
    const { bytesRead } = await handle.read(buffer, offset, length - offset, start + offset)
    /* v8 ignore next -- a concurrent truncate is the only zero read against stat.size. */
    if (bytesRead === 0) break
    offset += bytesRead
  }
  /* v8 ignore next -- zero-read above is the only short return. */
  return offset === length ? buffer : buffer.subarray(0, offset)
}

/**
 * Attach in-memory interrupted-turn closers when the open turn started in this
 * suffix, and report the logical cursor including those closers.
 * @param header - parsed current-generation header.
 * @param events - dense durable suffix events in seq order.
 * @param signal - optional cancellation.
 * @returns the persistence suffix view.
 */
function finishSuffix(
  header: SessionHeader,
  events: SessionEvent[],
  signal?: AbortSignal,
): SessionHistorySuffix {
  signal?.throwIfAborted()
  const closers = closersForSuffix(events)
  const logical = closers.length === 0 ? events : [...events, ...closers]
  return {
    header,
    inheritedEventCount: SessionLogOffset(0),
    events: logical,
    cursor: logical.at(-1)?.seq ?? -1,
  }
}

/**
 * Synthesize crash closers only when this suffix contains the still-open
 * `turn/start`. An older open turn whose start sits before the page is left
 * unbalanced so the reader does not invent a cut that is not in the window.
 * @param events - durable suffix events.
 * @returns synthetic closers, or none.
 */
function closersForSuffix(events: readonly SessionEvent[]): SessionEvent[] {
  let openTurnStartedHere = false
  let open = false
  for (const event of events) {
    if (event.type === 'turn/start') {
      open = true
      openTurnStartedHere = true
    } else if (event.type === 'turn/end') {
      open = false
      openTurnStartedHere = false
    }
  }
  return open && openTurnStartedHere ? interruptedTurnClosers(events) : []
}

/**
 * Whether `events` already covers the requested page, including the case
 * where the suffix reaches seq 0.
 * @param events - currently decoded dense suffix.
 * @param options - page bounds.
 * @returns true when no older frame or line is required.
 */
function suffixComplete(
  events: readonly SessionEvent[],
  options: SessionHistorySuffixOptions,
): boolean {
  if (options.throughSeq === -1) return true
  if (events.length === 0) return false
  const origin = events[0]?.seq
  /* v8 ignore next -- parseEventRecords only pushes events that carry seq. */
  if (origin === undefined) return false
  const last = events.at(-1)?.seq
  /* v8 ignore next -- a non-empty suffix has a last event. */
  if (last === undefined) return false
  const through = options.throughSeq ?? last
  const endSeq = Math.min(Math.min(through, last), (options.beforeSeq ?? through + 1) - 1)
  if (endSeq < origin) return origin === 0
  let count = 0
  let cutSeq: number = origin
  let hitMax = false
  for (let seq = endSeq; seq >= origin; seq -= 1) {
    const event = events[seq - origin]
    if (event === undefined || event.seq !== seq) {
      throw new Error(`corrupt session log: suffix is not dense at seq ${String(seq)}`)
    }
    const groupStart = messageGroupStart(event)
    if (groupStart === undefined) continue
    count += 1
    if (count >= options.maxMessages) {
      cutSeq = groupStart
      hitMax = true
      break
    }
  }
  if (!hitMax) return origin === 0
  return cutSeq >= origin
}

/**
 * Inclusive start seq of one append-surface user/assistant message group.
 * @param event - candidate journal event.
 * @returns the earliest owned source seq, or `undefined` when the event does
 *   not count toward `maxMessages`.
 */
function messageGroupStart(event: SessionEvent): number | undefined {
  if (!MESSAGE_TYPES.has(event.type) || !isAppendSurfaceEvent(event)) return undefined
  let groupStart = event.seq
  const sources = event.sourceEventSeqs
  if (sources !== undefined) {
    for (const source of sources) {
      if (source < groupStart) groupStart = source
    }
  }
  return groupStart
}

/**
 * Parse complete JSONL event rows from one plaintext buffer, skipping a
 * nested session header if a frame accidentally repeats it.
 * @param plaintext - zero or more newline-terminated records.
 * @returns decoded events in file order.
 */
function parseEventRecords(plaintext: Buffer): SessionEvent[] {
  const events: SessionEvent[] = []
  let start = 0
  for (let index = 0; index < plaintext.length; index += 1) {
    if (plaintext[index] !== 0x0A) continue
    const line = plaintext.subarray(start, index)
    start = index + 1
    if (line.length === 0) continue
    let parsed: unknown
    try {
      parsed = JSON.parse(line.toString('utf8')) as unknown
    } catch {
      throw new Error('corrupt session log: unparsable committed event')
    }
    if (typeof parsed === 'object' && parsed !== null && (parsed as { type?: unknown }).type === 'session') {
      continue
    }
    events.push(decodeSuffixEvent(parsed))
  }
  return events
}

/**
 * Admit one current-generation event row and expand compressed source ranges.
 * @param parsed - JSON value of one event line.
 * @returns the logical event used for pagination.
 */
function decodeSuffixEvent(parsed: unknown): SessionEvent {
  assertV3RowAdmission(parsed)
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('corrupt session log: event row is not a JSON object')
  }
  const record = parsed as Record<string, unknown>
  if (record['sourceEventSeqs'] === undefined) return record as unknown as SessionEvent
  const seq = SessionSeq(record['seq'] as number)
  return {
    ...record,
    seq,
    sourceEventSeqs: decodeSeqRanges(record['sourceEventSeqs'], seq),
  } as unknown as SessionEvent
}

/**
 * Exclusive end of the last newline-terminated record.
 * @param buffer - event-body bytes after the header line.
 * @returns 0 when no complete record exists.
 */
function lastCompleteRecordEnd(buffer: Buffer): number {
  const last = buffer.lastIndexOf(0x0A)
  return last === -1 ? 0 : last + 1
}

/**
 * Require the first Zstandard frame to contain exactly the header record.
 * @param plaintext - decompressed first frame.
 */
function assertZstdHeaderFrame(plaintext: Buffer): void {
  if (plaintext.length === 0 || plaintext.indexOf(0x0A) !== plaintext.length - 1) {
    throw new Error('corrupt Zstandard session log: first frame is not exactly one header line')
  }
}
