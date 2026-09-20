/**
 * Tail-page decoder for JSONL session logs. It scans cheap Zstandard frame
 * boundaries and decompresses only the newest frames that cover one history
 * page, without constructing a {@link SessionLogScanner} from seq 0.
 */

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
import { decompressZstdFrame, decompressZstdPrefix, scanZstdFrames } from './zstd.ts'

const MESSAGE_TYPES = new Set(['user/message', 'assistant/message'])

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
  const { frames, tornStart } = scanZstdFrames(bytes)
  const headerFrame = frames[0]
  if (headerFrame === undefined) throw new Error('empty or header-less Zstandard session log')
  const headerPlain = await decompressZstdFrame(bytes.subarray(headerFrame.start, headerFrame.end))
  assertZstdHeaderFrame(headerPlain)
  const header = parseHeaderRecord(headerPlain).meta
  const eventFrames = frames.slice(1)
  const collected: SessionEvent[][] = []

  if (tornStart !== undefined) {
    options.signal?.throwIfAborted()
    let recovered: Buffer = Buffer.alloc(0)
    try {
      recovered = Buffer.from(await decompressZstdPrefix(bytes.subarray(tornStart)))
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
      await decompressZstdFrame(bytes.subarray(last.start, last.end)),
    ))
    for (let index = eventFrames.length - 2; index >= 0; index -= 1) {
      if (suffixComplete(collected.flat(), options)) break
      const frame = eventFrames[index]
      /* v8 ignore next -- the countdown stays inside the scanned event-frame list. */
      if (frame === undefined) continue
      options.signal?.throwIfAborted()
      collected.unshift(parseEventRecords(
        await decompressZstdFrame(bytes.subarray(frame.start, frame.end)),
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
  const body = bytes.subarray(headerEnd + 1)
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
  return Promise.resolve(finishSuffix(header, records, options.signal))
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
