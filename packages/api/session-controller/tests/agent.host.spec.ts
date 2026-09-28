import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import AgentRegistry from '@x1a0f3n9/dsh-agent'
import type { Agent } from '@x1a0f3n9/dsh-agent'
import { agentPresetProjectionDefinition } from '@x1a0f3n9/dsh-agent-preset-registry'
import SessionStore, { SESSION_FORMAT_VERSION, SessionLogOffset, SessionId } from '@x1a0f3n9/dsh-session'
import type { SessionEvent, SessionHeader } from '@x1a0f3n9/dsh-session'
import { SessionAlreadyOwnedError } from '@x1a0f3n9/dsh-session-persistence'
import type { SessionObservation } from '@x1a0f3n9/dsh-session-query'
import TypertRegistry from '@x1a0f3n9/dsh-typert-registry'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  API_SESSION_IDLE_ORDINARY_AGENT_CACHE_SIZE,
  ApiSessionAgentController,
  ApiSessionCwdConflict,
  ApiSessionNotFound,
  ApiSessionSubagentOwnership,
  inspectApiSession,
} from '../src/agent.ts'
import { installModelSelectionProjection } from '../src/model-selection-projection.ts'
import { installSessionReadTestServices, testSessionPersistence } from './test-remote.ts'

const roots: Context[] = []

/** Session cwd roots created per test, removed after their context settles. */
const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(ctx => ctx.fiber.dispose()))
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

async function harness(): Promise<{ ctx: Context; agents: ApiSessionAgentController }> {
  const ctx = new Context()
  roots.push(ctx)
  await ctx.plugin(TypertRegistry)
  await ctx.plugin(SessionStore)
  await ctx.plugin(AgentRegistry)
  installSessionReadTestServices(ctx)
  ctx.sessionProjections.register(agentPresetProjectionDefinition)
  installModelSelectionProjection(ctx)
  ctx.provide('agentDefaultModel', {
    currentSelection: () => ({ provider: 'fixture', model: 'fixture-model' }),
    saveSelection: () => Promise.resolve(),
  } as never)
  return { ctx, agents: new ApiSessionAgentController(ctx) }
}

function header(id: string, cwd: string | null = '/workspace'): SessionHeader {
  return {
    version: SESSION_FORMAT_VERSION,
    id: SessionId(id),
    createdAt: 1,
    isSeeded: false,
    ...(cwd === null ? {} : { cwd }),
  }
}

function providePersistence(ctx: Context, persistence: Record<string, unknown>): () => void {
  return ctx.provide('sessionPersistence', testSessionPersistence(ctx, persistence) as never)
}

function agent(ctx: Context, meta: SessionHeader): Agent {
  const session = ctx.sessions.create(meta.id, { meta })
  return { id: meta.id, session, status: 'idle', ctx } as Agent
}

function unpublishedAgent(ctx: Context, meta: SessionHeader): Agent {
  return {
    id: meta.id,
    session: { id: meta.id, header: meta, events: [] },
    status: 'idle',
    ctx,
  } as unknown as Agent
}

describe('ApiSession identity failures', () => {
  it('describes cwd conflicts with and without a recorded cwd', () => {
    expect(new ApiSessionCwdConflict(SessionId('missing-cwd'), '/wanted', undefined).message)
      .toContain('records no cwd')
    expect(new ApiSessionCwdConflict(SessionId('wrong-cwd'), '/wanted', '/existing').message)
      .toContain('belongs to "/existing"')
  })

  it('maps absent and cwd-less point observations to not found', async () => {
    const ctx = new Context()
    roots.push(ctx)
    await ctx.plugin(SessionStore)
    installSessionReadTestServices(ctx)
    await expect(inspectApiSession(ctx, SessionId('missing')))
      .rejects.toBeInstanceOf(ApiSessionNotFound)

    const inspect = vi.fn(() => Promise.resolve(undefined))
    const stat = vi.fn(() => Promise.resolve(undefined))
    const disposeMissing = providePersistence(ctx, {
      list: () => Promise.resolve([]),
      stat,
      inspect,
    })
    await expect(inspectApiSession(ctx, SessionId('missing'))).rejects.toBeInstanceOf(ApiSessionNotFound)
    // Absence is decided by the stat preflight; the log itself is never opened.
    expect(stat).toHaveBeenCalledOnce()
    expect(inspect).not.toHaveBeenCalled()
    disposeMissing()

    const listed = header('cwd-less-catalog', null)
    const disposeListed = providePersistence(ctx, {
      list: () => Promise.resolve([listed]),
      inspect: () => Promise.resolve({ meta: listed, events: [] }),
    })
    await expect(inspectApiSession(ctx, listed.id)).rejects.toBeInstanceOf(ApiSessionNotFound)
    disposeListed()

    const catalog = header('cwd-less-inspect')
    const inspected = header('cwd-less-inspect', null)
    providePersistence(ctx, {
      list: () => Promise.resolve([catalog]),
      inspect: () => Promise.resolve({ meta: inspected, events: [] }),
    })
    await expect(inspectApiSession(ctx, catalog.id)).rejects.toBeInstanceOf(ApiSessionNotFound)
  })

  it('forwards an explicit inspection signal', async () => {
    const ctx = new Context()
    roots.push(ctx)
    await ctx.plugin(SessionStore)
    installSessionReadTestServices(ctx)
    const meta = header('signalled-inspection')
    const inspect = vi.fn(() => Promise.resolve({ meta, inheritedEventCount: SessionLogOffset(0), events: [] }))
    providePersistence(ctx, {
      list: () => Promise.resolve([meta]),
      inspect,
    })
    const signal = new AbortController().signal

    await expect(inspectApiSession(ctx, meta.id, signal)).resolves.toEqual({ meta, inheritedEventCount: SessionLogOffset(0), events: [] })
    expect(inspect).toHaveBeenCalledWith(meta.id, signal)
  })
})

describe('ApiSession Agent lookup and recovery', () => {
  it('resumes directly from a retained observation and rejects an invalid observed header', async () => {
    const { ctx, agents } = await harness()
    const meta = header('observed-resume')
    const resumed = unpublishedAgent(ctx, meta)
    const resume = vi.spyOn(ctx.agents, 'resume').mockResolvedValue({
      agent: resumed,
      dispose: () => Promise.resolve(),
    })
    const observed = {
      source: 'prepared',
      header: meta,
      events: [],
      cursor: -1,
      projections: { asOfSeq: -1, values: {} },
      retain: vi.fn(),
      [Symbol.dispose]: vi.fn(),
    } as unknown as SessionObservation

    await expect(agents.resolveObservedAgent(observed)).resolves.toEqual({ agent: resumed })
    expect(resume).toHaveBeenCalledWith(expect.objectContaining({ resumeSessionId: meta.id }))

    const invalid = {
      ...observed,
      header: header('observed-without-cwd', null),
    } as SessionObservation
    await expect(agents.resolveObservedAgent(invalid)).resolves.toMatchObject({
      error: { code: 'session/not-found' },
    })
  })

  it('projects live Agent contexts and maps missing cold identities through Typert lookup failures', async () => {
    const { ctx } = await harness()
    const live = agent(ctx, header('live'))
    await ctx.agents.register(live)
    providePersistence(ctx, {
      list: () => Promise.resolve([]),
      inspect: vi.fn(),
    })
    const host = ctx.typert.contexts.getHost('agent')
    if (host === undefined) throw new Error('Agent Context resolver was not registered')

    await expect(host.resolve(live.id)).resolves.toBe(live.ctx)
    await expect(host.resolve(SessionId('missing'))).rejects.toMatchObject({ code: 'session/not-found' })
  })

  it('returns raced ordinary Agents and ownership failures after resume throws', async () => {
    const ordinary = await harness()
    const ordinaryMeta = header('ordinary-race')
    providePersistence(ordinary.ctx, {
      list: () => Promise.resolve([ordinaryMeta]),
      inspect: () => Promise.resolve({ meta: ordinaryMeta, events: [] }),
    })
    const winner = agent(ordinary.ctx, ordinaryMeta)
    vi.spyOn(ordinary.ctx.agents, 'resume').mockImplementation(async () => {
      await ordinary.ctx.agents.register(winner)
      throw new Error('raced publication')
    })
    await expect(ordinary.agents.resolveAgent(ordinaryMeta.id)).resolves.toEqual({ agent: winner })

    const child = await harness()
    const childMeta = header('child-race')
    providePersistence(child.ctx, {
      list: () => Promise.resolve([childMeta]),
      inspect: () => Promise.resolve({ meta: childMeta, events: [] }),
    })
    vi.spyOn(child.ctx.agents, 'resume').mockImplementation(async () => {
      child.ctx.sessions.create(childMeta.id, {
        meta: { ...childMeta, parentSession: SessionId('parent'), origin: 'subagent' },
      })
      throw new Error('raced child publication')
    })
    await expect(child.agents.resolveAgent(childMeta.id)).resolves.toMatchObject({
      error: { code: 'session/agent-busy' },
    })
  })

  it('reports not-found and ordinary resume failures without fabricating an Agent', async () => {
    const missing = await harness()
    providePersistence(missing.ctx, {
      list: () => Promise.resolve([]),
      inspect: vi.fn(),
    })
    await expect(missing.agents.resolveAgent(SessionId('missing'))).resolves.toMatchObject({
      error: { code: 'session/not-found' },
    })

    const failed = await harness()
    const meta = header('failed')
    providePersistence(failed.ctx, {
      list: () => Promise.resolve([meta]),
      inspect: () => Promise.resolve({ meta, events: [] }),
    })
    vi.spyOn(failed.ctx.agents, 'resume').mockRejectedValue(new Error('factory unavailable'))
    await expect(failed.agents.resolveAgent(meta.id)).resolves.toMatchObject({
      error: { code: 'gateway/internal', message: expect.stringContaining('factory unavailable') as string },
    })
  })

  it('identifies a held Session writer without classifying other resume failures as contention', async () => {
    const { ctx, agents } = await harness()
    const meta = header('owned-session')
    providePersistence(ctx, {
      list: () => Promise.resolve([meta]),
      inspect: () => Promise.resolve({ meta, events: [] }),
    })
    const resume = vi.spyOn(ctx.agents, 'resume').mockRejectedValue(new SessionAlreadyOwnedError(meta.id))
    await expect(agents.resolveAgent(meta.id)).resolves.toMatchObject({
      error: { code: 'session/writer-held', details: { sessionId: meta.id } },
    })
    resume.mockRejectedValue(Object.assign(new Error('another module copy'), { name: 'SessionAlreadyOwnedError' }))
    await expect(agents.resolveAgent(meta.id)).resolves.toMatchObject({
      error: { code: 'session/writer-held', details: { sessionId: meta.id } },
    })
    resume.mockRejectedValue(new Error('unrelated failure'))
    await expect(agents.resolveAgent(meta.id)).resolves.toMatchObject({
      error: { code: 'gateway/internal' },
    })
  })

  it('retains resume diagnostics without a persistence service', async () => {
    const { ctx, agents } = await harness()
    const meta = header('memory-only-resume')
    ctx.sessions.create(meta.id, { meta })
    vi.spyOn(ctx.agents, 'resume').mockRejectedValue(new Error('factory unavailable'))
    await expect(agents.resolveAgent(meta.id)).resolves.toMatchObject({
      error: { code: 'gateway/internal', message: expect.stringContaining('factory unavailable') as string },
    })
  })

  it('requires projected observations before activation', async () => {
    const { agents } = await harness()
    const meta = header('unprojected-observation')
    const observed = {
      source: 'prepared',
      header: meta,
      events: [],
      cursor: -1,
      retain: vi.fn(),
      [Symbol.dispose]: vi.fn(),
    } as unknown as SessionObservation

    expect(() => agents.presetForObservation(observed)).toThrow(
      'Agent activation requires a projected Session observation',
    )
  })
})

describe('ApiSession model selection', () => {
  it('requires the model-selection projection', async () => {
    const { ctx, agents } = await harness()
    const live = agent(ctx, header('missing-model-projection'))
    vi.spyOn(ctx.sessionProjections, 'stateOf').mockReturnValue(undefined)

    expect(() => agents.selectionFor(live)).toThrow('required modelSelection projection')
  })

  it('reads a reasoning-free request and consumes only the exact pending selection', async () => {
    const { ctx, agents } = await harness()
    const logged = agent(ctx, header('logged-model'))
    logged.session.append('request/header', {
      header: { config: { provider: 'logged-provider', model: 'logged-model' } },
      reason: 'initial',
    })
    expect(agents.selectionFor(logged).current).toEqual({
      provider: 'logged-provider',
      model: 'logged-model',
    })

    const pending = agent(ctx, header('pending-model'))
    const selection = agents.selectionFor(pending)
    agents.selectForNextRequest(pending, {
      provider: 'selected-provider',
      model: 'selected-model',
      reasoningEffort: 'high' as never,
    })
    expect(selection.current).toMatchObject({
      provider: 'selected-provider', model: 'selected-model', reasoningEffort: 'high',
    })
    expect(agents.consumeSelection(pending, 'other-provider', 'selected-model', 'high')).toBe(false)
    expect(agents.consumeSelection(pending, 'selected-provider', 'other-model', 'high')).toBe(false)
    expect(agents.consumeSelection(pending, 'selected-provider', 'selected-model', 'low')).toBe(false)
    expect(agents.consumeSelection(pending, 'selected-provider', 'selected-model', 'high')).toBe(true)
    expect(selection.current).toEqual({ provider: 'fixture', model: 'fixture-model' })

    const untouched = agent(ctx, header('uninstalled-model'))
    expect(agents.consumeSelection(untouched, 'fixture', 'fixture-model', undefined)).toBe(false)
  })
})

describe('ApiSession create or adoption', () => {
  it('shares one in-flight creation between concurrent callers', async () => {
    const { ctx, agents } = await harness()
    const cwd = mkdtempSync(join(tmpdir(), 'dsh-session-controller-concurrent-'))
    tempDirs.push(cwd)
    const meta = header('concurrent-create', cwd)
    const created = unpublishedAgent(ctx, meta)
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    const create = vi.spyOn(ctx.agents, 'create').mockImplementation(async () => {
      await gate
      return { agent: created, dispose: () => Promise.resolve() }
    })

    const first = agents.ensureSession(meta.id, cwd, false)
    const second = agents.ensureSession(meta.id, cwd, false)
    release()

    await expect(Promise.all([first, second])).resolves.toEqual([created, created])
    expect(create).toHaveBeenCalledOnce()
  })

  it('accepts a raced ordinary creation and rejects a raced attached child', async () => {
    const ordinary = await harness()
    const cwd = mkdtempSync(join(tmpdir(), 'dsh-session-controller-create-'))
    tempDirs.push(cwd)
    const ordinaryMeta = header('create-race', cwd)
    const winner = agent(ordinary.ctx, ordinaryMeta)
    vi.spyOn(ordinary.ctx.agents, 'create').mockImplementation(async () => {
      await ordinary.ctx.agents.register(winner)
      throw new Error('raced creation')
    })
    await expect(ordinary.agents.ensureSession(ordinaryMeta.id, cwd, false))
      .resolves.toBe(winner)

    const child = await harness()
    const childCwd = mkdtempSync(join(tmpdir(), 'dsh-session-controller-child-'))
    tempDirs.push(childCwd)
    const childId = SessionId('create-child-race')
    vi.spyOn(child.ctx.agents, 'create').mockImplementation(async () => {
      child.ctx.sessions.create(childId, {
        meta: { cwd: childCwd, parentSession: SessionId('parent'), origin: 'subagent' },
      })
      throw new Error('raced child creation')
    })
    await expect(child.agents.ensureSession(childId, childCwd, false))
      .rejects.toBeInstanceOf(ApiSessionSubagentOwnership)
  })

  it('validates ownership and cwd on the Agent returned by creation', async () => {
    const child = await harness()
    const childCwd = mkdtempSync(join(tmpdir(), 'dsh-session-controller-returned-child-'))
    tempDirs.push(childCwd)
    const childMeta = {
      ...header('returned-child', childCwd),
      parentSession: SessionId('parent'),
      origin: 'subagent' as const,
    }
    const childAgent = unpublishedAgent(child.ctx, childMeta)
    vi.spyOn(child.ctx.agents, 'create').mockResolvedValue({
      agent: childAgent,
      dispose: () => Promise.resolve(),
    })
    await expect(child.agents.ensureSession(childMeta.id, childCwd, false))
      .rejects.toBeInstanceOf(ApiSessionSubagentOwnership)

    const wrong = await harness()
    const requestedCwd = mkdtempSync(join(tmpdir(), 'dsh-session-controller-wrong-cwd-'))
    tempDirs.push(requestedCwd)
    const wrongAgent = unpublishedAgent(wrong.ctx, header('wrong-returned-cwd', '/other'))
    vi.spyOn(wrong.ctx.agents, 'create').mockResolvedValue({
      agent: wrongAgent,
      dispose: () => Promise.resolve(),
    })
    await expect(wrong.agents.ensureSession(wrongAgent.id, requestedCwd, false))
      .rejects.toBeInstanceOf(ApiSessionCwdConflict)
  })

  it('resumes a matching persisted identity and preserves its selected preset', async () => {
    const { ctx, agents } = await harness()
    const meta = { ...header('stored'), agentPreset: 'minimal' }
    const events = [{
      type: 'agent-preset/selected',
      seq: 0,
      time: 1,
      data: { agentPreset: 'minimal' },
    }] as SessionEvent[]
    providePersistence(ctx, {
      list: () => Promise.resolve([meta]),
      inspect: () => Promise.resolve({ meta, events }),
    })
    ctx.provide('agentPresets', {
      resolve: (id?: string) => Promise.resolve({ id: id ?? 'minimal' }),
      mount: () => Promise.resolve(),
    } as never)
    const resumed = {
      id: meta.id,
      session: {
        id: meta.id,
        header: meta,
        snapshotEvents: () => events,
        eventAt: (seq: number) => events[seq],
        seq: events.length,
      },
      status: 'idle',
      ctx,
    } as unknown as Agent
    const resume = vi.spyOn(ctx.agents, 'resume').mockResolvedValue({
      agent: resumed,
      dispose: () => Promise.resolve(),
    })

    await expect(agents.ensureSession(meta.id, '/workspace', true, 'minimal')).resolves.toBe(resumed)
    expect(resume).toHaveBeenCalledWith(expect.objectContaining({ resumeSessionId: meta.id }))
  })

  it('rejects an ownership race before resume and a persisted cwd conflict', async () => {
    const child = await harness()
    const childMeta = header('resume-child-race')
    providePersistence(child.ctx, {
      list: () => Promise.resolve([childMeta]),
      inspect: () => Promise.resolve({ meta: childMeta, events: [] }),
    })
    child.ctx.provide('agentPresets', {
      resolve: () => {
        child.ctx.sessions.create(childMeta.id, {
          meta: { ...childMeta, parentSession: SessionId('parent'), origin: 'subagent' },
        })
        return Promise.resolve({ id: 'standard' })
      },
      mount: () => Promise.resolve(),
    } as never)
    await expect(child.agents.resolveAgent(childMeta.id)).resolves.toMatchObject({
      error: { code: 'session/agent-busy' },
    })

    const conflict = await harness()
    const stored = header('stored-cwd-conflict', '/stored')
    providePersistence(conflict.ctx, {
      list: () => Promise.resolve([stored]),
      inspect: () => Promise.resolve({ meta: stored, events: [] }),
    })
    await expect(conflict.agents.ensureSession(stored.id, '/requested', true))
      .rejects.toBeInstanceOf(ApiSessionCwdConflict)
  })

  it('surfaces directory creation failure', async () => {
    const { agents } = await harness()
    const parent = mkdtempSync(join(tmpdir(), 'dsh-session-controller-file-'))
    tempDirs.push(parent)
    const file = join(parent, 'file')
    writeFileSync(file, 'not a directory')
    await expect(agents.ensureSession(SessionId('mkdir-failure'), join(file, 'child'), false))
      .rejects.toThrow('failed to ensure project directory')
  })

  it('keeps idle ordinary Agents until the recent-session cache is full', async () => {
    const { ctx, agents } = await harness()
    const idleMeta = header('idle-root')
    const nextMeta = header('next-root')
    providePersistence(ctx, {
      list: () => Promise.resolve([idleMeta, nextMeta]),
      inspect: (id: SessionId) => Promise.resolve({
        meta: id === idleMeta.id ? idleMeta : nextMeta,
        events: [],
      }),
    })
    const idleDispose = vi.fn(() => Promise.resolve())
    const nextDispose = vi.fn(() => Promise.resolve())
    const idleAgent = unpublishedAgent(ctx, idleMeta)
    const nextAgent = unpublishedAgent(ctx, nextMeta)
    vi.spyOn(ctx.agents, 'resume').mockImplementation(async (options) => {
      if (options.resumeSessionId === idleMeta.id) {
        return { agent: idleAgent, dispose: idleDispose }
      }
      return { agent: nextAgent, dispose: nextDispose }
    })

    await expect(agents.resolveAgent(idleMeta.id)).resolves.toEqual({ agent: idleAgent })
    expect(idleDispose).not.toHaveBeenCalled()
    await expect(agents.resolveAgent(nextMeta.id)).resolves.toEqual({ agent: nextAgent })
    expect(idleDispose).not.toHaveBeenCalled()
    expect(nextDispose).not.toHaveBeenCalled()
  })

  it('disposes the least-recent idle ordinary Agent when the cache overflows', async () => {
    const { ctx, agents } = await harness()
    const metas = Array.from({ length: API_SESSION_IDLE_ORDINARY_AGENT_CACHE_SIZE + 1 }, (_, index) => (
      header(`idle-cache-${String(index + 1)}`)
    ))
    providePersistence(ctx, {
      list: () => Promise.resolve(metas),
      inspect: (id: SessionId) => {
        const meta = metas.find(item => item.id === id)
        if (meta === undefined) return Promise.resolve(undefined)
        return Promise.resolve({ meta, events: [] })
      },
    })
    const disposers = new Map(metas.map(meta => [meta.id, vi.fn(() => Promise.resolve())]))
    const live = new Map(metas.map(meta => [meta.id, unpublishedAgent(ctx, meta)]))
    const handles = new Map(metas.map(meta => [
      meta.id,
      { agent: live.get(meta.id)!, dispose: disposers.get(meta.id)! },
    ]))
    vi.spyOn(ctx.agents, 'resume').mockImplementation(async options => handles.get(options.resumeSessionId)!)

    for (const meta of metas.slice(0, API_SESSION_IDLE_ORDINARY_AGENT_CACHE_SIZE)) {
      await expect(agents.resolveAgent(meta.id)).resolves.toEqual({ agent: live.get(meta.id) })
    }
    for (const meta of metas.slice(0, API_SESSION_IDLE_ORDINARY_AGENT_CACHE_SIZE)) {
      expect(disposers.get(meta.id)).not.toHaveBeenCalled()
    }

    const extra = metas[API_SESSION_IDLE_ORDINARY_AGENT_CACHE_SIZE]!
    await expect(agents.resolveAgent(extra.id)).resolves.toEqual({ agent: live.get(extra.id) })
    expect(disposers.get(metas[0]!.id)).toHaveBeenCalledOnce()
    for (const meta of metas.slice(1)) {
      expect(disposers.get(meta.id)).not.toHaveBeenCalled()
    }
  })

  it('treats a reused idle Agent as most recent before cache overflow', async () => {
    const { ctx, agents } = await harness()
    const metas = Array.from({ length: API_SESSION_IDLE_ORDINARY_AGENT_CACHE_SIZE + 1 }, (_, index) => (
      header(`idle-reuse-${String(index + 1)}`)
    ))
    providePersistence(ctx, {
      list: () => Promise.resolve(metas),
      inspect: (id: SessionId) => {
        const meta = metas.find(item => item.id === id)
        if (meta === undefined) return Promise.resolve(undefined)
        return Promise.resolve({ meta, events: [] })
      },
    })
    const disposers = new Map(metas.map(meta => [meta.id, vi.fn(() => Promise.resolve())]))
    const live = new Map(metas.map(meta => [meta.id, unpublishedAgent(ctx, meta)]))
    const handles = new Map(metas.map(meta => [
      meta.id,
      { agent: live.get(meta.id)!, dispose: disposers.get(meta.id)! },
    ]))
    vi.spyOn(ctx.agents, 'resume').mockImplementation(async options => handles.get(options.resumeSessionId)!)

    for (const meta of metas.slice(0, API_SESSION_IDLE_ORDINARY_AGENT_CACHE_SIZE)) {
      await expect(agents.resolveAgent(meta.id)).resolves.toEqual({ agent: live.get(meta.id) })
    }
    await expect(agents.resolveAgent(metas[0]!.id)).resolves.toEqual({ agent: live.get(metas[0]!.id) })
    const extra = metas[API_SESSION_IDLE_ORDINARY_AGENT_CACHE_SIZE]!
    await expect(agents.resolveAgent(extra.id)).resolves.toEqual({ agent: live.get(extra.id) })
    expect(disposers.get(metas[0]!.id)).not.toHaveBeenCalled()
    expect(disposers.get(metas[1]!.id)).toHaveBeenCalledOnce()
    expect(disposers.get(extra.id)).not.toHaveBeenCalled()
  })

  it('keeps a running ordinary Agent while resuming another Session', async () => {
    const { ctx, agents } = await harness()
    const runningMeta = header('running-root')
    const nextMeta = header('keep-running-next')
    providePersistence(ctx, {
      list: () => Promise.resolve([runningMeta, nextMeta]),
      inspect: (id: SessionId) => Promise.resolve({
        meta: id === runningMeta.id ? runningMeta : nextMeta,
        events: [],
      }),
    })
    const runningDispose = vi.fn(() => Promise.resolve())
    const nextDispose = vi.fn(() => Promise.resolve())
    const runningAgent = { ...unpublishedAgent(ctx, runningMeta), status: 'running' as const }
    const nextAgent = unpublishedAgent(ctx, nextMeta)
    vi.spyOn(ctx.agents, 'resume').mockImplementation(async (options) => {
      if (options.resumeSessionId === runningMeta.id) {
        return { agent: runningAgent, dispose: runningDispose }
      }
      return { agent: nextAgent, dispose: nextDispose }
    })

    await expect(agents.resolveAgent(runningMeta.id)).resolves.toEqual({ agent: runningAgent })
    await expect(agents.resolveAgent(nextMeta.id)).resolves.toEqual({ agent: nextAgent })
    expect(runningDispose).not.toHaveBeenCalled()
  })

  it('disposes owned Agent handles when the Host fiber unloads', async () => {
    const { ctx, agents } = await harness()
    const meta = header('fiber-dispose-root')
    providePersistence(ctx, {
      list: () => Promise.resolve([meta]),
      inspect: () => Promise.resolve({ meta, events: [] }),
    })
    const dispose = vi.fn(() => Promise.resolve())
    const live = unpublishedAgent(ctx, meta)
    vi.spyOn(ctx.agents, 'resume').mockResolvedValue({ agent: live, dispose })

    await expect(agents.resolveAgent(meta.id)).resolves.toEqual({ agent: live })
    await ctx.fiber.dispose()
    expect(dispose).toHaveBeenCalledOnce()
  })

  it('keeps a repeated resume handle for the same unpublished Session', async () => {
    const { ctx, agents } = await harness()
    const meta = header('same-handle')
    providePersistence(ctx, {
      list: () => Promise.resolve([meta]),
      inspect: () => Promise.resolve({ meta, events: [] }),
    })
    const dispose = vi.fn(() => Promise.resolve())
    const live = unpublishedAgent(ctx, meta)
    const handle = { agent: live, dispose }
    vi.spyOn(ctx.agents, 'resume').mockResolvedValue(handle)

    await expect(agents.resolveAgent(meta.id)).resolves.toEqual({ agent: live })
    await expect(agents.resolveAgent(meta.id)).resolves.toEqual({ agent: live })
    expect(dispose).not.toHaveBeenCalled()
  })

  it('replaces a previous handle when the same unpublished Session is resumed again', async () => {
    const { ctx, agents } = await harness()
    const meta = header('replace-handle')
    providePersistence(ctx, {
      list: () => Promise.resolve([meta]),
      inspect: () => Promise.resolve({ meta, events: [] }),
    })
    const firstDispose = vi.fn(() => Promise.resolve())
    const secondDispose = vi.fn(() => Promise.resolve())
    const live = unpublishedAgent(ctx, meta)
    vi.spyOn(ctx.agents, 'resume')
      .mockResolvedValueOnce({ agent: live, dispose: firstDispose })
      .mockResolvedValueOnce({ agent: live, dispose: secondDispose })

    await expect(agents.resolveAgent(meta.id)).resolves.toEqual({ agent: live })
    await expect(agents.resolveAgent(meta.id)).resolves.toEqual({ agent: live })
    expect(firstDispose).toHaveBeenCalledOnce()
    expect(secondDispose).not.toHaveBeenCalled()
  })

  it('keeps a subagent-owned idle Agent while resuming another Session', async () => {
    const { ctx, agents } = await harness()
    const childMeta = header('idle-subagent')
    const nextMeta = header('after-subagent')
    providePersistence(ctx, {
      list: () => Promise.resolve([childMeta, nextMeta]),
      inspect: (id: SessionId) => Promise.resolve({
        meta: id === childMeta.id ? childMeta : nextMeta,
        events: [],
      }),
    })
    const childDispose = vi.fn(() => Promise.resolve())
    const nextDispose = vi.fn(() => Promise.resolve())
    const childAgent = unpublishedAgent(ctx, {
      ...childMeta,
      origin: 'subagent',
      parentSession: SessionId('parent-root'),
    })
    const nextAgent = unpublishedAgent(ctx, nextMeta)
    vi.spyOn(ctx.agents, 'resume').mockImplementation(async (options) => {
      if (options.resumeSessionId === childMeta.id) {
        return { agent: childAgent, dispose: childDispose }
      }
      return { agent: nextAgent, dispose: nextDispose }
    })

    await expect(agents.resolveAgent(childMeta.id)).resolves.toEqual({ agent: childAgent })
    await expect(agents.resolveAgent(nextMeta.id)).resolves.toEqual({ agent: nextAgent })
    expect(childDispose).not.toHaveBeenCalled()
  })

  it('keeps an Agent owned by the Session being activated', async () => {
    const { ctx, agents } = await harness()
    const parentMeta = header('owner-parent')
    const childMeta = header('owned-by-parent')
    providePersistence(ctx, {
      list: () => Promise.resolve([parentMeta, childMeta]),
      inspect: (id: SessionId) => Promise.resolve({
        meta: id === parentMeta.id ? parentMeta : childMeta,
        events: [],
      }),
    })
    const parentDispose = vi.fn(() => Promise.resolve())
    const childDispose = vi.fn(() => Promise.resolve())
    const parentAgent = unpublishedAgent(ctx, parentMeta)
    const childAgent = unpublishedAgent(ctx, childMeta)
    vi.spyOn(ctx.agents, 'resume').mockImplementation(async (options) => {
      if (options.resumeSessionId === childMeta.id) {
        return { agent: childAgent, dispose: childDispose }
      }
      return { agent: parentAgent, dispose: parentDispose }
    })
    vi.spyOn(ctx.agents, 'isOwnedBy').mockImplementation((id, owner) => (
      id === childMeta.id && owner.id === parentMeta.id
    ))

    await expect(agents.resolveAgent(childMeta.id)).resolves.toEqual({ agent: childAgent })
    const originalGet = ctx.agents.get.bind(ctx.agents)
    vi.spyOn(ctx.agents, 'get').mockImplementation((id) => {
      if (id === parentMeta.id) return parentAgent
      return originalGet(id)
    })
    await expect(agents.resolveAgent(parentMeta.id)).resolves.toEqual({ agent: parentAgent })
    expect(childDispose).not.toHaveBeenCalled()
  })
})
