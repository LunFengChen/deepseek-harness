import { Context } from '@deepseek-ai/cordis'
import AgentRegistry from '@x1a0f3n9/dsh-agent'
import type { Agent } from '@x1a0f3n9/dsh-agent'
import { createUserMessage } from '@x1a0f3n9/dsh-llm'
import SessionStore, { SessionId, SessionSeq } from '@x1a0f3n9/dsh-session'
import { describe, expect, it, vi } from 'vitest'
import { ApiSessionAgentController } from '../src/agent.ts'
import { SessionCommandController } from '../src/commands.ts'

function commandContext(): Context {
  const ctx = new Context()
  ctx.provide('workspaceRegistry', { get: () => undefined, list: () => [] } as never)
  return ctx
}

describe('Session deletion command', () => {
  it('truncates durable and live history when deleting from a visible turn', async () => {
    const ctx = commandContext()
    await ctx.plugin(SessionStore)
    await ctx.plugin(AgentRegistry)
    const session = ctx.sessions.create(SessionId('delete-session'), { meta: { cwd: '/workspace' } })
    session.append('turn/start', { turn: 1 })
    session.append('user/message', createUserMessage({
      content: [{ type: 'text', text: 'remove me' }], source: { kind: 'user' },
    }), { surfaceOp: 'append' })
    session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
    session.append('turn/start', { turn: 2 })
    const length = session.deletionStart(SessionSeq(3))
    const truncate = vi.fn(() => Promise.resolve())
    ctx.provide('sessionPersistence', { truncate } as never)
    const agent = {
      id: session.id,
      session,
      status: 'idle',
      ctx,
      runMaintenance: (job: (signal: AbortSignal) => Promise<unknown>) => job(new AbortController().signal),
    } as unknown as Agent
    const agents = {
      resolveAgent: () => Promise.resolve({ agent }),
    } as unknown as ApiSessionAgentController
    const controller = new SessionCommandController(ctx, agents, '/workspace')

    await expect(controller.deleteFrom({ sessionId: session.id, fromSeq: SessionSeq(3) }))
      .resolves.toEqual({ accepted: true })

    expect(truncate).toHaveBeenCalledWith(session.id, length)
    expect(session.snapshotEvents().map(event => event.type)).toEqual([
      'turn/start', 'user/message', 'turn/end',
    ])
    await ctx.fiber.dispose()
  })

  it('returns a domain error instead of accessing an absent persistence service', async () => {
    const ctx = commandContext()
    await ctx.plugin(SessionStore)
    const session = ctx.sessions.create(SessionId('delete-without-persistence'), { meta: { cwd: '/workspace' } })
    session.append('turn/start', { turn: 1 })
    const agent = {
      id: session.id,
      session,
      status: 'idle',
      ctx,
      runMaintenance: (job: (signal: AbortSignal) => Promise<unknown>) => job(new AbortController().signal),
    } as unknown as Agent
    const agents = { resolveAgent: () => Promise.resolve({ agent }) } as unknown as ApiSessionAgentController
    const controller = new SessionCommandController(ctx, agents, '/workspace')

    await expect(controller.deleteFrom({ sessionId: session.id, fromSeq: SessionSeq(0) }))
      .rejects.toMatchObject({
        code: 'gateway/internal',
        message: 'session persistence is unavailable; cannot delete conversation history',
      })
    await ctx.fiber.dispose()
  })
})
