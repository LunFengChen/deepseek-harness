/** Cold Session history pagination and live-event source. */

import type { Context } from '@deepseek-ai/cordis'
import { Deque } from '@x1a0f3n9/dsh-deque'
import type { AssistantStreamFrame } from '@x1a0f3n9/dsh-agent'
import {
  isAppendSurfaceEvent,
  SessionLogOffset,
  SessionSeq,
} from '@x1a0f3n9/dsh-session'
import type {
  Session,
  SessionEvent,
  SessionHeader,
  SessionId,
  SessionLogOffset as SessionLogOffsetType,
  SessionSeqCursor,
} from '@x1a0f3n9/dsh-session'
import {
  SessionPersistenceNotFoundError,
  type SessionHistorySuffix,
  type SessionHistorySuffixOptions,
} from '@x1a0f3n9/dsh-session-persistence'
import type {} from '@x1a0f3n9/dsh-session-projection-cache'
import { SessionQueryError, type SessionObservation } from '@x1a0f3n9/dsh-session-query'
import type {} from '@x1a0f3n9/dsh-subagent'
import { RemoteError } from '@x1a0f3n9/dsh-typert-protocol'
import type { JsonValue } from '@x1a0f3n9/dsh-util-values'
import type {
  SessionAddress,
  SessionAssistantStreamFrame,
  SessionEventEntry,
  SessionFollowRequest,
  SessionFollowFrame,
  SessionHistoryRecord,
  SessionPage,
  SessionPageRequest,
  SessionProjectionBaseline,
  SessionProjectionValues,
  SessionWireHeader,
  SessionWireEvent,
} from './types.ts'
import { SessionAssistantStreamAccumulator } from './assistant-stream.ts'

const DEFAULT_MAX_MESSAGES = 50
const MESSAGE_TYPES = new Set(['user/message', 'assistant/message'])

/** Implements cold-safe history operations delegated by the Session Controller. */
export class SessionHistoryController {
  private readonly closeFollowers = new Set<() => void>()
  private readonly assistantStreams = new Map<SessionId, SessionAssistantStreamAccumulator>()

  /**
   * @param ctx - Host context carrying Session query and projection services.
   * @param promote - starts ordinary Session activation after snapshot delivery.
   */
  constructor(
    private readonly ctx: Context,
    private readonly promote: (observation: SessionObservation) => void,
  ) {
    ctx.on('agent/assistant-stream', ({ agent, frame }) => {
      let stream = this.assistantStreams.get(agent.session.id)
      if (stream === undefined) {
        stream = new SessionAssistantStreamAccumulator()
        this.assistantStreams.set(agent.session.id, stream)
      }
      stream.accept(frame, cursorBeforeNext(agent.session.seq))
    }, { global: true })
    ctx.on('agent/disposed', ({ agent }) => {
      this.assistantStreams.delete(agent.session.id)
    }, { global: true })
    ctx.effect(() => () => {
      for (const close of this.closeFollowers) close()
      this.closeFollowers.clear()
    }, 'session-controller.history')
  }

  /**
   * Read one message-aligned history page without activating an Agent.
   * @param request - durable address and backwards-page cursor.
   * @param signal - caller cancellation for persistence reads.
   * @returns a contiguous event page.
   */
  async page(request: SessionPageRequest, signal: AbortSignal): Promise<SessionPage> {
    validatePageRequest(request)
    const throughSeq: SessionSeqCursor = request.throughSeq === -1
      ? -1
      : SessionSeq(request.throughSeq)
    const beforeSeq = request.beforeSeq === undefined
      ? undefined
      : SessionLogOffset(request.beforeSeq)
    const maxMessages = request.maxMessages ?? DEFAULT_MAX_MESSAGES
    const suffix = await this.readSuffix(request.address, {
      maxMessages,
      ...request.beforeSeq === undefined ? {} : { beforeSeq: request.beforeSeq },
      throughSeq: request.throughSeq,
      signal,
    })
    if (suffix !== undefined) {
      return this.pageFromSuffix(request.address, suffix, beforeSeq, maxMessages, throughSeq)
    }
    using source = await this.sourceFor(request.address, signal, false)
    signal.throwIfAborted()
    const live = source.source === 'live' ? this.ctx.sessions.get(addressId(request.address)) : undefined
    const sourceCursor = source.cursor
    if (throughSeq > sourceCursor) {
      throw new RemoteError(
        'gateway/bad-request',
        `session page through seq ${String(throughSeq)} is past cursor ${String(sourceCursor)}`,
        {},
      )
    }
    if (throughSeq >= 0) {
      const at = live === undefined
        ? eventAtDense(source.events, throughSeq)
        : live.eventAt(SessionSeq(throughSeq))
      /* v8 ignore next -- Session and persistence validation guarantee a dense event prefix. */
      if (at?.seq !== throughSeq) {
        throw new RemoteError('gateway/internal', `session log does not contain through seq ${String(throughSeq)}`, {})
      }
    }
    const page = live === undefined
      ? paginate(source.events, beforeSeq, maxMessages, throughSeq)
      : paginateLive(live, beforeSeq, maxMessages, throughSeq)
    return {
      records: pageRecords(page.events),
      hasMore: page.hasMore,
    }
  }

  /**
   * Follow events appended after an initial cursor on one durable address.
   * @param request - durable address and last committed sequence already held by the caller.
   * @param signal - stream cancellation owned by the Remote carrier.
   * @returns a complete opening snapshot followed by gap-free durable events and opted-in assistant frames.
   */
  async *follow(request: SessionFollowRequest, signal: AbortSignal): AsyncIterable<SessionFollowFrame> {
    validateFollowRequest(request)
    const { address } = request
    const target = addressId(address)
    const buffered = new Deque<
      | { readonly type: 'event'; readonly event: SessionEvent }
      | {
        readonly type: 'assistant-stream'
        readonly frame: SessionAssistantStreamFrame
        readonly ordinal: number
      }
    >()
    let snapshotCursor: SessionSeqCursor | undefined
    let assistantStreamOrdinal = 0
    let wake: (() => void) | undefined
    const notify = (): void => {
      const resume = wake
      wake = undefined
      resume?.()
    }
    const follower = { closed: false }
    const close = (): void => {
      follower.closed = true
      notify()
    }
    this.closeFollowers.add(close)
    const disposeEvent = this.ctx.on('session/event', (session, event) => {
      if (session.id !== target) return
      buffered.pushBack({ type: 'event', event })
      notify()
    }, { global: true })
    const disposeCreated = this.ctx.on('session/created', (session) => {
      if (session.id !== target) return
      // Constructor seed events have no session/event notification. Normally
      // only the end-seed suffix is new; if persistence advanced after the
      // opening observation, replay everything beyond that snapshot cursor.
      // oxlint-disable-next-line typescript/no-deprecated -- Existing Session history read; migration deferred.
      const suffix = session.snapshotEvents(snapshotCursor === undefined
        ? session.firstLiveSeq
        : SessionLogOffset(snapshotCursor + 1))
      for (let index = suffix.length - 1; index >= 0; index -= 1) {
        buffered.pushFront({ type: 'event', event: suffix[index] as SessionEvent })
      }
      notify()
    }, { global: true })
    const disposeAssistantStream = request.assistantStream !== true
      ? undefined
      : this.ctx.on('agent/assistant-stream', ({ agent, frame }) => {
        if (agent.session.id !== target) return
        buffered.pushBack({
          type: 'assistant-stream',
          frame: wireAssistantStreamFrame(frame, cursorBeforeNext(agent.session.seq)),
          ordinal: ++assistantStreamOrdinal,
        })
        notify()
      }, { global: true })
    const onAbort = (): void => { notify() }
    signal.addEventListener('abort', onAbort, { once: true })
    try {
      const maxMessages = request.maxMessages ?? DEFAULT_MAX_MESSAGES
      const suffix = await this.readSuffix(address, { maxMessages, signal })
      let header: SessionHeader
      let cursor: SessionSeqCursor
      let page: { readonly events: readonly SessionEvent[]; readonly hasMore: boolean }
      let projections: SessionObservation['projections']
      let promoteSource: SessionObservation | undefined
      if (suffix !== undefined) {
        if (suffix.header.cwd === undefined) rejectNotFound(address)
        validateAddress(address, suffix.header, suffix.inheritedEventCount, undefined)
        header = suffix.header
        cursor = suffix.cursor
        page = paginate(suffix.events, undefined, maxMessages, cursor)
        projections = this.ctx.get('sessionProjectionCache')?.cachedSnapshot(
          suffix.header,
          suffix.inheritedEventCount,
        )
      } else {
        const source = await this.sourceFor(address, signal, true)
        signal.throwIfAborted()
        header = source.header
        cursor = source.cursor
        const live = source.source === 'live' ? this.ctx.sessions.get(target) : undefined
        page = live === undefined
          ? paginate(source.events, undefined, maxMessages, cursor)
          : paginateLive(live, undefined, maxMessages, cursor)
        projections = source.projections
        if (address.kind === 'session' && source.source === 'prepared') {
          promoteSource = source
        } else {
          source[Symbol.dispose]()
        }
      }
      snapshotCursor = cursor
      const assistantStream = request.assistantStream === true
        ? this.assistantStreams.get(target)?.snapshot() ?? { revision: 0 }
        : undefined
      // The accumulator snapshot and this watermark are synchronous. Frames
      // through the cut are represented or superseded by that baseline,
      // including larger revisions from a retired Agent; later revision
      // resets reach Client continuity validation.
      const assistantStreamOrdinalCut = assistantStreamOrdinal
      yield {
        type: 'snapshot',
        header: wireHeader(header),
        cursor,
        records: pageRecords(page.events),
        hasMore: page.hasMore,
        projections: projections === undefined
          ? { asOfSeq: cursor, values: {} }
          : projectionBlock(projections),
        ...assistantStream === undefined ? {} : { assistantStream },
      }
      if (promoteSource !== undefined) {
        const promotion = promoteSource.retain()
        promoteSource[Symbol.dispose]()
        try {
          this.promote(promotion)
        } catch (error: unknown) {
          promotion[Symbol.dispose]()
          throw error
        }
      }
      let nextOffset = SessionLogOffset(cursor + 1)
      while (!follower.closed && !signal.aborted) {
        const item = buffered.popFront()
        if (item === undefined) {
          await new Promise<void>((resolve) => { wake = resolve })
          continue
        }
        if (item.type === 'assistant-stream') {
          if (item.ordinal > assistantStreamOrdinalCut) {
            yield { type: 'assistant-stream', frame: item.frame }
          }
          continue
        }
        const expectedSeq = SessionSeq(nextOffset)
        if (item.event.seq < expectedSeq) continue
        if (item.event.seq !== expectedSeq) {
          throw new RemoteError('gateway/internal', `session event stream skipped seq ${String(expectedSeq)}`, {})
        }
        nextOffset = SessionLogOffset(nextOffset + 1)
        yield entryFor(item.event)
      }
    } finally {
      this.closeFollowers.delete(close)
      signal.removeEventListener('abort', onAbort)
      disposeCreated()
      disposeEvent()
      disposeAssistantStream?.()
    }
  }

  private async sourceFor(
    address: SessionAddress,
    signal: AbortSignal,
    withProjections: boolean,
  ): Promise<SessionObservation> {
    const sessionId = addressId(address)
    try {
      const observation = await this.ctx.sessionQuery.observeSession(sessionId, {
        signal,
        projectionMode: withProjections || address.kind === 'subagent' ? 'all' : 'none',
      })
      if (observation.header.cwd === undefined) {
        observation[Symbol.dispose]()
        rejectNotFound(address)
      }
      try {
        validateAddress(
          address,
          observation.header,
          observation.inheritedEventCount,
          observation.projections,
        )
      } catch (error: unknown) {
        observation[Symbol.dispose]()
        throw error
      }
      return observation
    } catch (error: unknown) {
      if (error instanceof SessionQueryError
        && error.code === 'SESSION_QUERY_SESSION_NOT_FOUND') rejectNotFound(address)
      throw error
    }
  }

  /**
   * Read a cheap tail page when the Session is cold and the backend can decode
   * a suffix. Live Sessions and subagent addresses return `undefined`.
   * @param address - durable address being paged or followed.
   * @param options - page bounds and cancellation.
   * @returns the suffix, or `undefined` to fall back to a full observation.
   */
  private async readSuffix(
    address: SessionAddress,
    options: SessionHistorySuffixOptions,
  ): Promise<SessionHistorySuffix | undefined> {
    if (address.kind !== 'session') return undefined
    if (this.ctx.sessions.get(address.sessionId) !== undefined) return undefined
    const persistence = this.ctx.get('sessionPersistence')
    const read = persistence?.readHistorySuffix
    if (read === undefined) return undefined
    try {
      return await read.call(persistence, address.sessionId, options)
    } catch (error: unknown) {
      if (error instanceof SessionPersistenceNotFoundError) rejectNotFound(address)
      throw error
    }
  }

  /**
   * Paginate a persistence suffix without restoring a Session.
   * @param address - durable address of the suffix.
   * @param suffix - covering tail returned by persistence.
   * @param beforeSeq - exclusive upper bound of an older page.
   * @param maxMessages - append-surface message budget.
   * @param throughSeq - inclusive newest seq the page may include.
   * @returns the wire page.
   */
  private pageFromSuffix(
    address: SessionAddress,
    suffix: SessionHistorySuffix,
    beforeSeq: SessionLogOffsetType | undefined,
    maxMessages: number,
    throughSeq: SessionSeqCursor,
  ): SessionPage {
    if (suffix.header.cwd === undefined) rejectNotFound(address)
    validateAddress(address, suffix.header, suffix.inheritedEventCount, undefined)
    if (throughSeq > suffix.cursor) {
      throw new RemoteError(
        'gateway/bad-request',
        `session page through seq ${String(throughSeq)} is past cursor ${String(suffix.cursor)}`,
        {},
      )
    }
    if (throughSeq >= 0 && eventAtDense(suffix.events, throughSeq)?.seq !== throughSeq) {
      throw new RemoteError('gateway/internal', `session log does not contain through seq ${String(throughSeq)}`, {})
    }
    const page = paginate(suffix.events, beforeSeq, maxMessages, throughSeq)
    return {
      records: pageRecords(page.events),
      hasMore: page.hasMore,
    }
  }

}

function cursorBeforeNext(nextSeq: SessionLogOffsetType): SessionSeqCursor {
  return nextSeq === 0 ? -1 : SessionSeq(nextSeq - 1)
}

function wireAssistantStreamFrame(
  frame: AssistantStreamFrame,
  durableCursor: SessionSeqCursor,
): SessionAssistantStreamFrame {
  if (frame.type === 'start') return { ...frame, startedAfterSeq: durableCursor }
  if (frame.type === 'end') return frame
  return {
    ...frame,
    chunk: frame.chunk as JsonValue,
  }
}

function projectionBlock(
  snapshot: NonNullable<SessionObservation['projections']>,
): SessionProjectionBaseline {
  return {
    asOfSeq: snapshot.asOfSeq,
    // Projection definitions validate whole JSON values before snapshot publication.
    values: snapshot.values as SessionProjectionValues,
  }
}

function validatePageRequest(request: SessionPageRequest): void {
  if (!Number.isSafeInteger(request.throughSeq)
    || request.throughSeq < -1
    || Object.is(request.throughSeq, -0)) {
    throw new RemoteError('gateway/bad-request', 'throughSeq must be an integer greater than or equal to -1', {})
  }
  if (request.beforeSeq !== undefined
    && (!Number.isSafeInteger(request.beforeSeq)
      || request.beforeSeq < 0
      || Object.is(request.beforeSeq, -0))) {
    throw new RemoteError('gateway/bad-request', 'beforeSeq must be a non-negative safe integer', {})
  }
  if (request.maxMessages !== undefined
    && (!Number.isSafeInteger(request.maxMessages) || request.maxMessages <= 0)) {
    throw new RemoteError('gateway/bad-request', 'maxMessages must be a positive safe integer', {})
  }
}

function validateFollowRequest(request: SessionFollowRequest): void {
  if (request.maxMessages !== undefined
    && (!Number.isSafeInteger(request.maxMessages) || request.maxMessages <= 0)) {
    throw new RemoteError('gateway/bad-request', 'maxMessages must be a positive safe integer', {})
  }
}

function addressId(address: SessionAddress): SessionId {
  return address.kind === 'session' ? address.sessionId : address.childSessionId
}

function validateAddress(
  address: SessionAddress,
  header: SessionHeader,
  inheritedEventCount: SessionLogOffsetType,
  projections: SessionObservation['projections'],
): void {
  if (address.kind === 'session') {
    if (header.origin === 'subagent') {
      throw new RemoteError('session/agent-busy', 'subagent Sessions require their durable parent address', {
        reason: 'use subagent delivery for this child session',
      })
    }
    return
  }
  if (header.origin !== 'subagent' || header.parentSession !== address.parentSessionId) {
    throw new RemoteError('subagent/unauthorized', 'subagent does not belong to the supplied parent', {
      childSessionId: address.childSessionId,
    })
  }
  const identity = projections?.values.subagent
  if (identity === null) {
    throw new RemoteError('subagent/catalog-diagnostic', 'subagent descriptor is corrupt', {
      parentSessionId: address.parentSessionId,
      childSessionId: address.childSessionId,
      reason: 'corrupt',
    })
  }
  if (identity === undefined || identity.seq < inheritedEventCount) {
    throw new RemoteError('subagent/catalog-diagnostic', 'subagent descriptor is unavailable', {
      parentSessionId: address.parentSessionId,
      childSessionId: address.childSessionId,
      reason: 'unsupported',
    })
  }
  if (identity.mode !== address.mode) {
    throw new RemoteError('subagent/unauthorized', 'subagent mode does not match the supplied address', {
      childSessionId: address.childSessionId,
    })
  }
}

function rejectNotFound(address: SessionAddress): never {
  if (address.kind === 'session') {
    throw new RemoteError('session/not-found', `session "${address.sessionId}" not found`, { sessionId: address.sessionId })
  }
  throw new RemoteError('subagent/not-found', 'subagent is unavailable', {
    parentSessionId: address.parentSessionId,
    childSessionId: address.childSessionId,
  })
}

function paginate(
  events: readonly SessionEvent[],
  beforeSeq: SessionLogOffsetType | undefined,
  maxMessages: number,
  throughSeq: SessionSeqCursor,
): { readonly events: SessionEvent[]; readonly hasMore: boolean } {
  if (throughSeq === -1) return { events: [], hasMore: false }
  if (events.length === 0) return { events: [], hasMore: false }
  const origin = events[0]?.seq
  /* v8 ignore next -- suffix and observation events always carry seq. */
  if (origin === undefined) return { events: [], hasMore: false }
  /* v8 ignore next -- a non-empty covering suffix always has a last seq. */
  const last = events.at(-1)?.seq ?? origin
  const endSeq = Math.min(Math.min(throughSeq, last), (beforeSeq ?? throughSeq + 1) - 1)
  if (endSeq < origin) return { events: [], hasMore: origin > 0 }
  const endIndex = endSeq - origin + 1
  let count = 0
  let cutSeq = origin
  for (let index = endIndex - 1; index >= 0; index--) {
    const event = events[index] as SessionEvent
    if (!MESSAGE_TYPES.has(event.type) || !isAppendSurfaceEvent(event)) continue
    count++
    const sources = event.sourceEventSeqs
    let groupStart = event.seq
    if (sources !== undefined) {
      for (const source of sources) {
        if (source < groupStart) groupStart = source
      }
    }
    if (count >= maxMessages) {
      cutSeq = groupStart
      break
    }
  }
  const cutIndex = Math.max(0, cutSeq - origin)
  return {
    events: events.slice(cutIndex, endIndex) as SessionEvent[],
    hasMore: cutSeq > 0,
  }
}

function paginateLive(
  session: Session,
  beforeSeq: SessionLogOffsetType | undefined,
  maxMessages: number,
  throughSeq: SessionSeqCursor,
): { readonly events: readonly SessionEvent[]; readonly hasMore: boolean } {
  if (throughSeq === -1 || session.seq === 0) return { events: [], hasMore: false }
  const last = SessionSeq(session.seq - 1)
  const endSeq = Math.min(Math.min(throughSeq, last), (beforeSeq ?? throughSeq + 1) - 1)
  if (endSeq < 0) return { events: [], hasMore: false }
  const end = SessionLogOffset(endSeq + 1)
  let count = 0
  let cut = SessionLogOffset(0)
  for (let index = end - 1; index >= 0; index--) {
    const event = session.eventAt(SessionSeq(index))
    /* v8 ignore next -- live Sessions are dense from seq 0 through seq-1. */
    if (event === undefined) continue
    if (!MESSAGE_TYPES.has(event.type) || !isAppendSurfaceEvent(event)) continue
    count++
    const sources = event.sourceEventSeqs
    let groupStart = event.seq
    if (sources !== undefined) {
      for (const source of sources) {
        if (source < groupStart) groupStart = source
      }
    }
    if (count >= maxMessages) {
      cut = SessionLogOffset(groupStart)
      break
    }
  }
  return { events: session.snapshotEvents(cut, end), hasMore: cut > 0 }
}

function eventAtDense(events: readonly SessionEvent[], seq: number): SessionEvent | undefined {
  if (events.length === 0) return undefined
  const origin = events[0]?.seq
  /* v8 ignore next -- covering suffixes always carry seq on the first event. */
  if (origin === undefined) return undefined
  const index = seq - origin
  if (index < 0 || index >= events.length) return undefined
  const event = events[index]
  return event?.seq === seq ? event : undefined
}

/** Translate current logical Session metadata to the browser wire. */
function wireHeader(header: SessionHeader): SessionWireHeader {
  return { ...header }
}

function entryFor(event: SessionEvent): SessionEventEntry {
  return {
    type: 'event',
    // Session.append validates and freezes event data as JSON before publication.
    event: event as unknown as SessionWireEvent,
  }
}

/** Encode one bounded logical page without changing its pagination cut. */
function pageRecords(events: readonly SessionEvent[]): SessionHistoryRecord[] {
  return events.map(entryFor)
}
