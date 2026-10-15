import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { createUserMessage } from '@x1a0f3n9/dsh-llm'
import SessionStore, { SESSION_LIVE_WINDOW_EVENTS, SessionId } from '@x1a0f3n9/dsh-session'
import SessionProjectionRegistry from '@x1a0f3n9/dsh-session-projection'
import SessionTitleService from '@x1a0f3n9/dsh-session-title'

const CONFIG = {
  fallbackMaxWords: 5,
  fallbackMaxBytes: 40,
  maxTitleBytes: 80,
} as const

async function settle(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 0))
}

function appendHumanPrompt(session: ReturnType<Context['sessions']['create']>, text: string) {
  return session.append('user/message', createUserMessage({
    content: [{ type: 'text', text }],
    source: { kind: 'user' },
  }), { surfaceOp: 'append' })
}

function padClosedTurns(
  session: ReturnType<Context['sessions']['create']>,
  fromTurn: number,
  turnCount: number,
): void {
  for (let turn = fromTurn; turn < fromTurn + turnCount; turn++) {
    session.append('turn/start', { turn })
    session.append('turn/end', { turn, reason: { kind: 'completed' } })
  }
}

describe('SessionTitleService live window', () => {
  it('does not rewrite a user pin from the inherited first prompt after releaseLiveWindow', async () => {
    const ctx = new Context()
    await ctx.plugin(SessionStore)
    await ctx.plugin(SessionProjectionRegistry)
    await ctx.plugin(SessionTitleService, CONFIG)
    const session = ctx.sessions.create(SessionId('window-pin'))
    session.append('turn/start', { turn: 1 })
    appendHumanPrompt(session, 'session-f7c65f0c-557c-445f-be66-fb98bd52392c original')
    await settle()
    ctx.sessionTitle.rename(session, '数盟指纹')
    session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })

    padClosedTurns(session, 2, Math.floor(SESSION_LIVE_WINDOW_EVENTS / 2) + 16)
    session.releaseLiveWindow()
    expect(session.snapshotEvents().some(event => event.type === 'session/title')).toBe(false)
    expect(ctx.sessionTitle.get(session)).toMatchObject({
      title: '数盟指纹',
      source: { kind: 'user' },
    })

    session.append('turn/start', { turn: SESSION_LIVE_WINDOW_EVENTS })
    appendHumanPrompt(session, 'continue after the window cut')
    await settle()

    expect(ctx.sessionTitle.get(session)).toMatchObject({
      title: '数盟指纹',
      source: { kind: 'user' },
    })
    expect(session.snapshotEvents().filter(event => event.type === 'session/title')).toEqual([])
  })

  it('does not append a second fallback once the first title event has left the live tail', async () => {
    const ctx = new Context()
    await ctx.plugin(SessionStore)
    await ctx.plugin(SessionProjectionRegistry)
    await ctx.plugin(SessionTitleService, CONFIG)
    const session = ctx.sessions.create(SessionId('window-fallback'))
    session.append('turn/start', { turn: 1 })
    appendHumanPrompt(session, 'session-f7c65f0c-557c-445f-be66-fb98bd52392c original')
    await settle()
    const first = ctx.sessionTitle.get(session)
    expect(first?.source).toEqual({ kind: 'fallback' })
    session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })

    padClosedTurns(session, 2, Math.floor(SESSION_LIVE_WINDOW_EVENTS / 2) + 16)
    session.releaseLiveWindow()
    expect(session.snapshotEvents().some(event => event.type === 'session/title')).toBe(false)

    session.append('turn/start', { turn: SESSION_LIVE_WINDOW_EVENTS })
    appendHumanPrompt(session, 'later prompt after the window cut')
    await settle()

    expect(ctx.sessionTitle.get(session)).toEqual(first)
    expect(session.snapshotEvents().filter(event => event.type === 'session/title')).toEqual([])
  })
})
