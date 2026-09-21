import { Context } from '@deepseek-ai/cordis'
import AgentRegistry from '@x1a0f3n9/dsh-agent'
import type { Agent } from '@x1a0f3n9/dsh-agent'
import { createUserMessage, LlmAdapter, type StreamChunk } from '@x1a0f3n9/dsh-llm'
import SessionStore, { SessionId, SessionSeq } from '@x1a0f3n9/dsh-session'
import {
  createInboxStub,
  mountAgentLoopTestDependencies,
  mountAgentLoopTestHarness,
} from '@x1a0f3n9/dsh-agent-loop-testkit'
import { describe, expect, it, vi } from 'vitest'
import { ApiSessionAgentController } from '../src/agent.ts'
import { SessionCommandController } from '../src/commands.ts'

function commandContext(): Context {
  const ctx = new Context()
  ctx.provide('workspaceRegistry', { get: () => undefined, list: () => [] } as never)
  return ctx
}

class ScriptedAdapter extends LlmAdapter {
  constructor(private readonly replies: string[]) {
    super()
  }

  override resolveModel(provider: string, model: string) {
    return Promise.resolve({ provider, id: model, name: model })
  }

  async *stream(): AsyncIterable<StreamChunk> {
    const text = this.replies.shift() ?? 'ok'
    yield { type: 'block-start', index: 0, blockType: 'text' }
    yield { type: 'text-delta', index: 0, text }
    yield { type: 'block-end', index: 0, block: { type: 'text', text } }
    yield { type: 'usage', usage: { inputTokens: 1, outputTokens: 1 } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}

function userMessageTexts(agent: Agent): string[] {
  return agent.session.snapshotEvents().flatMap((event) => {
    if (event.type !== 'user/message') return []
    return event.data.content.flatMap(part => (
      part.type === 'text' ? [part.text] : []
    ))
  })
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
      inbox: createInboxStub(),
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
      inbox: createInboxStub(),
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

  it('cancels a running turn before truncating history', async () => {
    const ctx = commandContext()
    await ctx.plugin(SessionStore)
    const session = ctx.sessions.create(SessionId('delete-running'), { meta: { cwd: '/workspace' } })
    session.append('turn/start', { turn: 1 })
    session.append('user/message', createUserMessage({
      content: [{ type: 'text', text: 'remove me' }], source: { kind: 'user' },
    }), { surfaceOp: 'append' })
    session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
    const truncate = vi.fn(() => Promise.resolve())
    ctx.provide('sessionPersistence', { truncate } as never)
    const phase = { status: 'running' as 'idle' | 'running' }
    const agent = {
      id: session.id,
      session,
      inbox: createInboxStub(),
      get status() { return phase.status },
      ctx,
      cancel: vi.fn(() => { phase.status = 'idle' }),
      whenIdle: vi.fn(() => Promise.resolve()),
      runMaintenance: (job: (signal: AbortSignal) => Promise<unknown>) => job(new AbortController().signal),
    }
    const agents = {
      resolveAgent: () => Promise.resolve({ agent }),
    } as unknown as ApiSessionAgentController
    const controller = new SessionCommandController(ctx, agents, '/workspace')

    await expect(controller.deleteFrom({ sessionId: session.id, fromSeq: SessionSeq(1) }))
      .resolves.toEqual({ accepted: true })
    expect(agent.cancel).toHaveBeenCalledWith({ kind: 'user' }, { keepInbox: true })
    expect(agent.whenIdle).toHaveBeenCalledOnce()
    expect(truncate).toHaveBeenCalledOnce()
    await ctx.fiber.dispose()
  })

  it('drains a restored wake splice so regenerate does not resend as steering', async () => {
    const ctx = commandContext()
    const adapter = new ScriptedAdapter(['first', 'second'])
    await mountAgentLoopTestDependencies(ctx)
    ctx.llm.registerAdapter(['mock'], adapter)
    const loop = await mountAgentLoopTestHarness(ctx)
    const agent = await loop.create(
      SessionId('delete-restored-inbox'),
      { provider: 'mock', model: 'mock' },
      { cwd: '/workspace' },
    )
    ctx.provide('sessionPersistence', { truncate: () => Promise.resolve() } as never)
    const controller = new SessionCommandController(
      ctx,
      { resolveAgent: () => Promise.resolve({ agent }) } as unknown as ApiSessionAgentController,
      '/workspace',
    )

    agent.followup(createUserMessage({
      content: [{ type: 'text', text: 'question' }],
      source: { kind: 'user' },
    }))
    await agent.whenIdle()
    const userEvent = agent.session.snapshotEvents().find(event => event.type === 'user/message')
    if (userEvent === undefined) throw new Error('expected a user/message after the first turn')

    await expect(controller.deleteFrom({ sessionId: agent.id, fromSeq: userEvent.seq }))
      .resolves.toEqual({ accepted: true })
    expect(agent.inbox.nextTurn).toEqual([])
    expect(agent.inbox.nextStep).toEqual([])
    expect(userMessageTexts(agent)).toEqual([])

    agent.followup(createUserMessage({
      content: [{ type: 'text', text: 'question' }],
      source: { kind: 'user' },
    }))
    await agent.whenIdle()

    expect(userMessageTexts(agent)).toEqual(['question'])
    expect(agent.inbox.nextTurn).toEqual([])
    expect(agent.inbox.nextStep).toEqual([])
    expect(agent.session.snapshotEvents().filter(event => event.type === 'turn/start')).toHaveLength(1)
    await ctx.fiber.dispose()
  })
})
