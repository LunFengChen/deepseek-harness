import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { createUserMessage } from '@x1a0f3n9/dsh-llm'
import SessionStore, {
  SESSION_FORMAT_VERSION,
  SESSION_LIVE_WINDOW_EVENTS,
  Session,
  SessionForkError,
  SessionId,
  SessionLogOffset,
  SessionSeq,
} from '@x1a0f3n9/dsh-session'

function appendClosedTurn(session: Session, turn: number): void {
  session.append('turn/start', { turn })
  session.append('user/message', createUserMessage({
    content: [{ type: 'text', text: `hello ${turn}` }],
    source: { kind: 'user' },
  }), { surfaceOp: 'append' })
  session.append('turn/end', { turn, reason: { kind: 'completed' } })
}

describe('Session live window', () => {
  it('keeps a contiguous tail and prefixHot after releaseLiveWindow', () => {
    const session = Session.create(SessionId('live-window'))
    const turns = Math.floor(SESSION_LIVE_WINDOW_EVENTS / 3) + 10
    for (let turn = 1; turn <= turns; turn++) appendClosedTurn(session, turn)

    const nextSeq = session.seq
    expect(session.liveBaseSeq).toBe(0)
    session.releaseLiveWindow()

    expect(session.liveBaseSeq).toBeGreaterThan(0)
    expect(session.seq).toBe(nextSeq)
    expect(session.eventAt(SessionSeq(2))).toBeUndefined()
    expect(session.eventAt(SessionSeq(0))?.type).toBe('turn/start')
    expect(session.eventAt(SessionSeq(1))?.type).toBe('user/message')
    expect(session.deriveMessages()[0]?.content).toEqual([{ type: 'text', text: 'hello 1' }])

    session.append('turn/start', { turn: turns + 1 })
    expect(session.seq).toBe(nextSeq + 1)
    expect(session.eventAt(SessionSeq(nextSeq))?.type).toBe('turn/start')
  })

  it('rejects in-memory fork of a boundary outside the live RAM window', async () => {
    const ctx = new Context()
    await ctx.plugin(SessionStore)
    const source = ctx.sessions.create(SessionId('windowed-parent'))
    const turns = Math.floor(SESSION_LIVE_WINDOW_EVENTS / 3) + 10
    for (let turn = 1; turn <= turns; turn++) appendClosedTurn(source, turn)
    source.releaseLiveWindow()

    expect(() => ctx.sessions.fork(source, SessionSeq(2), SessionId('windowed-child')))
      .toThrow(new SessionForkError(
        'fork boundary 2 is outside the live RAM window of session "windowed-parent"',
        'INVALID_BOUNDARY',
      ))
    expect(() => source.truncate(source.inheritedEventCount))
      .toThrow(/outside the live window/)
  })

  it('adopts a persisted restore into the live window without retaining the full log', async () => {
    const ctx = new Context()
    await ctx.plugin(SessionStore)
    const id = SessionId('stream-restore')
    const donor = Session.create(SessionId('donor'))
    const turns = Math.floor(SESSION_LIVE_WINDOW_EVENTS / 3) + 10
    for (let turn = 1; turn <= turns; turn++) appendClosedTurn(donor, turn)
    // oxlint-disable-next-line typescript/no-deprecated -- Donor is unwindowed; this is the restore input.
    const events = donor.snapshotEvents()

    const session = Session.beginPersistedRestore(id, {
      version: SESSION_FORMAT_VERSION,
      id,
      createdAt: 1,
      isSeeded: false,
    })
    for (const event of events) session.adoptRestoredEvent(event)
    session.finishPersistedRestore(SessionLogOffset(0))

    expect(session.seq).toBe(events.length + 1)
    // oxlint-disable-next-line typescript/no-deprecated -- Window bound is the live tail length.
    expect(session.snapshotEvents().length).toBeLessThanOrEqual(SESSION_LIVE_WINDOW_EVENTS + 4)
    // oxlint-disable-next-line typescript/no-deprecated -- Window bound is the live tail length.
    expect(session.snapshotEvents().length).toBeLessThan(events.length)
    expect(session.eventAt(SessionSeq(0))?.type).toBe('turn/start')
    expect(session.eventAt(SessionSeq(1))?.type).toBe('user/message')
    expect(session.deriveMessages()[0]?.content).toEqual([{ type: 'text', text: 'hello 1' }])

    ctx.sessions.enter(session)
    expect(() => ctx.sessions.fork(session, SessionSeq(2), SessionId('stream-child')))
      .toThrow(new SessionForkError(
        'fork boundary 2 is outside the live RAM window of session "stream-restore"',
        'INVALID_BOUNDARY',
      ))
  })
})
