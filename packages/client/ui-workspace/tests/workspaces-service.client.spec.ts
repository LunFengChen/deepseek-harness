import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  ISessions, SessionListState, SessionReference, SessionSummary,
} from '@x1a0f3n9/dsh-api-session-controller/client'
import type { SubagentAddress } from '@x1a0f3n9/dsh-subagent/client'
import type {
  IWorkspaces, WorkspaceId, WorkspaceSnapshot, WorkspaceView,
} from '@x1a0f3n9/dsh-api-workspace-controller/client'
import type { ClientRemote, DirectoryListing } from '@x1a0f3n9/dsh-api-remotes/client'
import { RemoteError } from '@x1a0f3n9/dsh-client-test-runtime'
import type { RemoteResult } from '@x1a0f3n9/dsh-api-remotes/client'
import { SessionId } from '@x1a0f3n9/dsh-session/types'
import { LayoutController } from '@x1a0f3n9/dsh-client-ui-layout/client'
import type { MainPanelId } from '@x1a0f3n9/dsh-client-ui-layout/client'
import { DirectoryBrowseError, UiWorkspaceService } from '../src/client/navigation.ts'

const sid = (id: string): SessionId => SessionId(id)
const wid = (id: string): WorkspaceId => id as WorkspaceId

const contexts: Context[] = []

afterEach(async () => {
  for (const ctx of contexts.splice(0)) await ctx.fiber.dispose()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function persistSelection(selection: {
  readonly sessionId?: SessionId
  readonly subagentAddress?: SubagentAddress
}): Map<string, string> {
  const backing = new Map([['dsh.sessions.current', JSON.stringify(selection)]])
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => backing.get(key) ?? null,
    setItem: (key: string, value: string) => { backing.set(key, value) },
    removeItem: (key: string) => { backing.delete(key) },
  })
  return backing
}

function workspace(
  id: string,
  sessionIds: readonly SessionId[] = [],
  createdAt = '2026-01-01T00:00:00.000Z',
): WorkspaceView {
  return {
    workspaceId: wid(id),
    path: `/w/${id}`,
    title: id,
    sessionIds,
    createdAt,
    updatedAt: createdAt,
  }
}

function summary(id: string, overrides: Partial<SessionSummary> = {}): SessionSummary {
  return {
    id: sid(id),
    displayTitle: id,
    running: false,
    blank: false,
    updatedAt: 0,
    ...overrides,
    retainedBy: overrides.retainedBy ?? {},
  }
}

function sessionState(
  summaries: readonly SessionSummary[] = [],
  phase: SessionListState['phase'] = 'ready',
): SessionListState {
  return {
    ids: summaries.map(item => item.id),
    byId: Object.fromEntries(summaries.map(item => [item.id, item])),
    phase,
    subagentsByParent: {},
    jobsBySession: {},
  }
}

function workspaceState(
  items: WorkspaceSnapshot['items'] = [],
  archivedSessionIds: readonly SessionId[] = [],
  phase: WorkspaceSnapshot['phase'] = 'ready',
): WorkspaceSnapshot {
  return {
    items,
    archivedSessionIds,
    phase,
    state: phase === 'ready' ? 'idle' : 'loading',
    error: null,
  }
}

class MutableSource<T> {
  private readonly listeners = new Set<() => void>()

  constructor(private value: T) {}

  getSnapshot(): T {
    return this.value
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  set(value: T): void {
    this.value = value
    for (const listener of [...this.listeners]) listener()
  }

  update(update: (value: T) => T): void {
    this.set(update(this.value))
  }

  listenersSnapshot(): readonly (() => void)[] {
    return [...this.listeners]
  }
}

interface RetainedSession {
  readonly reference: SessionReference
  readonly release: ReturnType<typeof vi.fn<() => void>>
}

class FakeSessions implements ISessions {
  readonly list: MutableSource<SessionListState>
  readonly create: ReturnType<typeof vi.fn<ISessions['create']>>
  readonly fork = vi.fn<ISessions['fork']>(async () => sid('forked'))
  readonly retained: RetainedSession[] = []
  readonly refreshSubagents = vi.fn<ISessions['refreshSubagents']>(() => Promise.resolve())
  readonly retain = vi.fn<ISessions['retain']>((target) => {
    const release = vi.fn<() => void>()
    const sessionId = typeof target === 'string' ? target : target.childSessionId
    const binding = { sessionId } as SessionReference['binding']
    const reference: SessionReference = {
      sessionId,
      binding,
      ready: Promise.resolve(binding),
      release,
      [Symbol.dispose]: release,
    }
    this.retained.push({ reference, release })
    return reference
  })
  readonly subagentAddress = vi.fn<ISessions['subagentAddress']>()
  declare readonly using: ISessions['using']
  declare readonly retainInfo: ISessions['retainInfo']
  declare readonly searchResultLimit: ISessions['searchResultLimit']
  declare readonly setSubagentCatalogOpen: ISessions['setSubagentCatalogOpen']
  declare readonly refresh: ISessions['refresh']
  declare readonly search: ISessions['search']
  declare readonly scope: ISessions['scope']
  declare readonly scopeOf: ISessions['scopeOf']
  declare readonly sessionOf: ISessions['sessionOf']
  declare readonly binding: ISessions['binding']

  constructor(initial: SessionListState) {
    this.list = new MutableSource(initial)
    this.create = vi.fn<ISessions['create']>(async options =>
      options?.sessionId ?? sid(`created-${String(options?.workspaceId ?? 'none')}`))
  }
}

class FakeWorkspaces implements IWorkspaces {
  readonly list: MutableSource<WorkspaceSnapshot>
  readonly archiveCalls: SessionId[] = []
  readonly unarchiveCalls: SessionId[] = []
  onArchive: IWorkspaces['archiveSession'] = async (sessionId) => {
    this.list.update(state => ({
      ...state,
      archivedSessionIds: [...state.archivedSessionIds, sessionId],
    }))
  }

  onUnarchive: IWorkspaces['unarchiveSession'] = async (sessionId) => {
    this.list.update(state => ({
      ...state,
      archivedSessionIds: state.archivedSessionIds.filter(id => id !== sessionId),
    }))
  }

  declare readonly create: IWorkspaces['create']
  declare readonly rename: IWorkspaces['rename']
  declare readonly delete: IWorkspaces['delete']
  declare readonly insertBefore: IWorkspaces['insertBefore']
  declare readonly insertSessionBefore: IWorkspaces['insertSessionBefore']

  constructor(initial: WorkspaceSnapshot) {
    this.list = new MutableSource(initial)
  }

  archiveSession(sessionId: SessionId): Promise<void> {
    this.archiveCalls.push(sessionId)
    return this.onArchive(sessionId)
  }

  unarchiveSession(sessionId: SessionId): Promise<void> {
    this.unarchiveCalls.push(sessionId)
    return this.onUnarchive(sessionId)
  }
}

const listing: DirectoryListing = {
  path: '/home/u',
  home: '/home/u',
  crumbs: [{ name: '/', path: '/', hidden: false }],
  entries: [{ name: 'project', path: '/home/u/project', hidden: false }],
  truncated: false,
}

/** The directory-picking Remote namespace, recorded and scripted per case. */
class FakeDirectoryPicker {
  readonly calls: { method: string; payload: unknown }[] = []

  onPick: () => Promise<RemoteResult<string | null>> = () => Promise.resolve({ ok: true, value: null })
  onList: () => Promise<RemoteResult<DirectoryListing>> = () => Promise.resolve({ ok: true, value: listing })
  onCreateDirectory: () => Promise<RemoteResult<string>> =
    () => Promise.resolve({ ok: true, value: '/home/u/new' })

  readonly remote: ClientRemote['directoryPicker'] = {
    pick: () => this.record('pick', {}, this.onPick()),
    list: (path?: string) => this.record('list', { path }, this.onList()),
    createDirectory: (path: string, name: string) =>
      this.record('createDirectory', { path, name }, this.onCreateDirectory()),
  }

  callsOf(method: string): unknown[] {
    return this.calls.filter(call => call.method === method).map(call => call.payload)
  }

  private record<T>(method: string, payload: unknown, result: Promise<T>): Promise<T> {
    this.calls.push({ method, payload })
    return result
  }
}

interface BenchOptions {
  readonly workspaces?: WorkspaceSnapshot
  readonly sessions?: SessionListState
  readonly configureSessions?: (sessions: FakeSessions) => void
}

function bench(options: BenchOptions = {}) {
  const ctx = new Context()
  contexts.push(ctx)
  const layout = new LayoutController({
    selectPanel: vi.fn(), retainMainPanels: vi.fn(),
    setSidebar: vi.fn(), toggleSidebar: vi.fn(), setViewportWidth: vi.fn(),
    setRightbar: vi.fn(), openRightbar: vi.fn(), closeRightbar: vi.fn(),
  }, () => true)
  const selectPanel = vi.spyOn(layout, 'selectPanel')
  ctx.provide('layout', layout)
  ctx.effect(() => () => { layout.dispose() })
  const directoryPicker = new FakeDirectoryPicker()
  const workspaces = new FakeWorkspaces(options.workspaces ?? workspaceState([], [], 'pending'))
  const sessions = new FakeSessions(options.sessions ?? sessionState([], 'pending'))
  options.configureSessions?.(sessions)
  const uiWorkspace = new UiWorkspaceService(
    ctx,
    directoryPicker.remote,
    workspaces,
    sessions,
  )
  return { ctx, directoryPicker, sessions, uiWorkspace, workspaces, layout, selectPanel }
}

describe('UiWorkspaceService', () => {
  it('retains an explicit main target before revealing its Conversation', () => {
    const b = bench()
    b.uiWorkspace.openSession(sid('target'))
    expect(b.selectPanel).toHaveBeenCalledWith(null)
    expect(b.sessions.retain).toHaveBeenCalledWith(sid('target'), { source: 'mainView' })
    expect(b.sessions.refreshSubagents).toHaveBeenCalledWith(sid('target'))
  })

  it('keeps the current panel when retaining the target fails', () => {
    const b = bench()
    b.sessions.retain.mockImplementationOnce(() => { throw new Error('open failed') })
    expect(() => { b.uiWorkspace.openSession(sid('target')) }).toThrow('open failed')
    expect(b.selectPanel).not.toHaveBeenCalled()
  })

  it('releases a newly retained target when Workspace preparation throws', async () => {
    const b = bench({
      workspaces: workspaceState([workspace('a')]),
      sessions: sessionState([], 'pending'),
    })
    b.uiWorkspace.openSession(sid('current'))
    const failure = new Error('preparation failed')

    await expect(b.uiWorkspace.openWorkspace(wid('a'), () => { throw failure })).rejects.toBe(failure)

    expect(b.sessions.retained.map(item => item.reference.sessionId)).toEqual([sid('current'), sid('created-a')])
    expect(b.sessions.retained[0]!.release).not.toHaveBeenCalled()
    expect(b.sessions.retained[1]!.release).toHaveBeenCalledOnce()
  })

  it('opens only the latest Workspace when creation finishes out of order', async () => {
    const b = bench({ workspaces: workspaceState([workspace('a'), workspace('b')]) })
    const first = Promise.withResolvers<SessionId>()
    const second = Promise.withResolvers<SessionId>()
    b.sessions.create.mockImplementation(options => options?.workspaceId === wid('a') ? first.promise : second.promise)
    const prepareA = vi.fn()
    const prepareB = vi.fn()
    const openingA = b.uiWorkspace.openWorkspace(wid('a'), prepareA)
    const openingB = b.uiWorkspace.openWorkspace(wid('b'), prepareB)
    second.resolve(sid('newer'))
    await openingB
    first.resolve(sid('older'))
    await openingA
    expect(b.sessions.retain).toHaveBeenCalledExactlyOnceWith(sid('newer'), { source: 'mainView' })
    expect(prepareB).toHaveBeenCalledExactlyOnceWith(sid('newer'))
    expect(prepareA).not.toHaveBeenCalled()
  })

  it('does not reopen a Workspace after a later panel or Session navigation', async () => {
    for (const panel of [true, false]) {
      const b = bench({ workspaces: workspaceState([workspace('a')]) })
      const created = Promise.withResolvers<SessionId>()
      b.sessions.create.mockReturnValueOnce(created.promise)
      const opening = b.uiWorkspace.openWorkspace(wid('a'))
      if (panel) b.layout.selectPanel('other-panel' as MainPanelId)
      else b.uiWorkspace.openSession(sid('chosen'))
      created.resolve(sid('late'))
      await opening
      expect(b.sessions.retain.mock.calls.map(args => args[0])).toEqual(panel ? [] : [sid('chosen')])
    }
  })

  it('does not deliver pending Workspace and fork targets after disposal', async () => {
    for (const kind of ['workspace', 'fork'] as const) {
      const b = bench({ workspaces: workspaceState([workspace('a')]) })
      const created = Promise.withResolvers<SessionId>()
      b.sessions.create.mockReturnValueOnce(created.promise)
      b.sessions.fork.mockReturnValueOnce(created.promise)
      const pending = kind === 'workspace' ? b.uiWorkspace.openWorkspace(wid('a')) : b.uiWorkspace.forkSession(sid('source'))
      await b.ctx.fiber.dispose()
      created.resolve(sid('late'))
      await pending
      expect(b.sessions.retain).not.toHaveBeenCalled()
    }
  })

  it('ignores a rejected startup selection and stale catalog callbacks after disposal', async () => {
    const created = Promise.withResolvers<SessionId>()
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const b = bench({
      workspaces: workspaceState([workspace('a')], [], 'ready'),
      sessions: sessionState([], 'pending'),
      configureSessions: (sessions) => { sessions.create.mockReturnValue(created.promise) },
    })
    const staleReconcile = b.sessions.list.listenersSnapshot()[0]!
    b.sessions.list.set(sessionState())
    await b.ctx.fiber.dispose()
    staleReconcile()
    created.reject(new Error('late failure'))
    await Promise.resolve()

    expect(warning).not.toHaveBeenCalled()
  })

  it('does not run startup selection after a main Session was chosen while catalogs loaded', () => {
    const b = bench()
    b.uiWorkspace.openSession(sid('chosen'))

    b.workspaces.list.set(workspaceState([workspace('a')]))
    b.sessions.list.set(sessionState())

    expect(b.sessions.retain).toHaveBeenCalledExactlyOnceWith(sid('chosen'), { source: 'mainView' })
    expect(b.sessions.create).not.toHaveBeenCalled()
  })

  it('forwards fork policy and rejects a failed fork', async () => {
    const b = bench()
    await b.uiWorkspace.forkSession(sid('source'))
    expect(b.sessions.fork).toHaveBeenCalledWith({ sessionId: sid('source'), increaseTitle: true })
    expect(b.sessions.retain).toHaveBeenCalledWith(sid('forked'), { source: 'mainView' })
    b.sessions.fork.mockRejectedValueOnce(new Error('fork failed'))
    await expect(b.uiWorkspace.forkSession(sid('source'))).rejects.toThrow('fork failed')
  })

  it('reuses only an unarchived member blank and coalesces concurrent creation', async () => {
    const b = bench({
      sessions: sessionState([
        summary('stray', { blank: true, cwd: '/w/a' }),
        summary('blank', { blank: true, cwd: '/w/a' }),
        summary('archived', { blank: true, cwd: '/w/b' }),
      ]),
      workspaces: workspaceState([workspace('a', [sid('blank')]), workspace('b', [sid('archived')])], [sid('archived')]),
    })
    await expect(b.uiWorkspace.connectWorkspace(wid('a'))).resolves.toBe(sid('blank'))
    expect(b.sessions.create).not.toHaveBeenCalled()
    b.sessions.retain.mockClear()
    const created = Promise.withResolvers<SessionId>()
    b.sessions.create.mockReturnValue(created.promise)
    const first = b.uiWorkspace.connectWorkspace(wid('b'))
    const second = b.uiWorkspace.connectWorkspace(wid('b'))
    expect(b.sessions.create).toHaveBeenCalledOnce()
    created.resolve(sid('new'))
    await expect(Promise.all([first, second])).resolves.toEqual([sid('new'), sid('new')])
    await expect(b.uiWorkspace.connectWorkspace(wid('missing'))).rejects.toThrow('unknown workspace')
    expect(b.sessions.retain).not.toHaveBeenCalled()
  })

  it('uses only an explicit Workspace or the recent-Workspace policy for new Sessions', async () => {
    const current = summary('current', { cwd: '/w/current-home', updatedAt: 1 })
    const recent = summary('recent', { cwd: '/w/recent-home', updatedAt: 2 })
    const b = bench({
      sessions: sessionState([current, recent]),
      workspaces: workspaceState([
        workspace('old'),
        workspace('current-home', [current.id]),
        workspace('recent-home', [recent.id]),
      ]),
    })
    b.uiWorkspace.startSession(wid('old'))
    await vi.waitFor(() => {
      expect(b.sessions.retain).toHaveBeenLastCalledWith(sid('created-old'), { source: 'mainView' })
    })
    b.uiWorkspace.openSession(current.id)
    b.uiWorkspace.startSession()
    await vi.waitFor(() => {
      expect(b.sessions.retain).toHaveBeenLastCalledWith(sid('created-current-home'), { source: 'mainView' })
    })
    const recentOnly = bench({
      sessions: sessionState([current, recent]),
      workspaces: workspaceState([
        workspace('current-home', [current.id]),
        workspace('recent-home', [recent.id]),
      ]),
    })
    recentOnly.uiWorkspace.startSession()
    await vi.waitFor(() => {
      expect(recentOnly.sessions.retain).toHaveBeenLastCalledWith(sid('created-recent-home'), { source: 'mainView' })
    })
    b.sessions.create.mockRejectedValueOnce(new Error('create failed'))
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    b.uiWorkspace.startSession(wid('recent-home'))
    await vi.waitFor(() => { expect(warning).toHaveBeenCalledWith('new session failed:', expect.any(Error)) })
    const empty = bench()
    empty.uiWorkspace.startSession()
    expect(empty.selectPanel).toHaveBeenCalledWith(null)

    const missingMember = bench({
      sessions: sessionState(),
      workspaces: workspaceState([
        workspace('older', [sid('missing')], '2026-01-01T00:00:00.000Z'),
        workspace('newer', [], '2026-02-01T00:00:00.000Z'),
      ]),
    })
    missingMember.uiWorkspace.startSession()
    await vi.waitFor(() => {
      expect(missingMember.sessions.create).toHaveBeenCalledWith({ workspaceId: wid('newer') })
    })
  })

  it('releases a prepared Workspace target when synchronous preparation supersedes it', async () => {
    const b = bench({ workspaces: workspaceState([workspace('a')]) })

    await b.uiWorkspace.openWorkspace(wid('a'), () => {
      b.uiWorkspace.openSession(sid('override'))
    })

    expect(b.sessions.retained.map(item => item.reference.sessionId)).toEqual([
      sid('created-a'), sid('override'),
    ])
    expect(b.sessions.retained[0]!.release).toHaveBeenCalledOnce()
    expect(b.sessions.retained[1]!.release).not.toHaveBeenCalled()
  })

  it('opens the most recent Workspace after both startup catalogs become ready', async () => {
    const b = bench()
    b.workspaces.list.set(workspaceState([
      workspace('newest', [], '2026-03-01T00:00:00.000Z'),
      workspace('same-time', [], '2026-03-01T00:00:00.000Z'),
      workspace('older', [], '2026-01-01T00:00:00.000Z'),
    ]))
    b.sessions.list.set(sessionState())
    await vi.waitFor(() => {
      expect(b.sessions.retain).toHaveBeenCalledWith(sid('created-newest'), { source: 'mainView' })
    })
  })

  it('does not let a pending startup Workspace replace a manual Session selection', async () => {
    const created = Promise.withResolvers<SessionId>()
    const b = bench({
      workspaces: workspaceState([workspace('a')]),
      sessions: sessionState(),
      configureSessions: (sessions) => { sessions.create.mockReturnValue(created.promise) },
    })
    b.uiWorkspace.openSession(sid('chosen'))

    created.resolve(sid('automatic'))
    await b.uiWorkspace.connectWorkspace(wid('a'))

    expect(b.sessions.retain.mock.calls.map(([target]) => target)).toEqual([sid('chosen')])
  })

  it('restores a persisted subagent address without a parent catalog', () => {
    const address: SubagentAddress = {
      parentSessionId: sid('parent'),
      childSessionId: sid('child'),
      mode: 'continuable',
    }
    persistSelection({ sessionId: address.childSessionId, subagentAddress: address })

    const b = bench({
      workspaces: workspaceState(),
      sessions: sessionState(),
    })

    expect(b.sessions.retain).toHaveBeenCalledExactlyOnceWith(address, { source: 'mainView' })
    expect(b.sessions.refreshSubagents.mock.calls).toEqual([
      [address.parentSessionId],
      [address.childSessionId],
    ])
  })

  it('persists a catalog-resolved address after string subagent navigation', () => {
    const address: SubagentAddress = {
      parentSessionId: sid('parent'),
      childSessionId: sid('child'),
      mode: 'continuable',
    }
    const backing = persistSelection({})
    const b = bench({
      configureSessions: (sessions) => { sessions.subagentAddress.mockReturnValue(address) },
    })

    b.uiWorkspace.openSession(address.childSessionId)

    expect(JSON.parse(backing.get('dsh.sessions.current')!)).toEqual({
      sessionId: address.childSessionId,
      subagentAddress: address,
    })
  })

  it('reports and retries a failed persisted Session restoration', () => {
    const failure = new Error('restore failed')
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const sessions = sessionState([summary('saved')])
    persistSelection({ sessionId: sid('saved') })
    const b = bench({
      workspaces: workspaceState(),
      sessions,
      configureSessions: (face) => {
        face.retain.mockImplementationOnce(() => { throw failure })
      },
    })

    expect(warning).toHaveBeenCalledWith('initial Session restoration failed:', failure)
    b.sessions.list.set(sessions)

    expect(b.sessions.retain).toHaveBeenCalledTimes(2)
    expect(b.sessions.retained).toHaveLength(1)
    expect(b.sessions.retained[0]!.reference.sessionId).toBe(sid('saved'))
  })

  it('clears a selected Session when an external archive snapshot arrives', () => {
    const b = bench()
    b.uiWorkspace.openSession(sid('current'))

    b.workspaces.list.set(workspaceState([], [sid('current')]))

    expect(b.sessions.retained[0]!.release).toHaveBeenCalledOnce()
    expect(b.selectPanel).toHaveBeenCalledTimes(2)
  })

  it('clears a selected Session after archiving it without an intervening snapshot', async () => {
    const b = bench()
    b.workspaces.onArchive = async () => {}
    b.uiWorkspace.openSession(sid('current'))

    await b.uiWorkspace.archiveSession(sid('current'))

    expect(b.sessions.retained[0]!.release).toHaveBeenCalledOnce()
    expect(b.selectPanel).toHaveBeenCalledTimes(2)
  })

  it('forwards archive commands and preserves failures', async () => {
    const idle = sid('idle')
    const b = bench()

    await b.uiWorkspace.archiveSession(idle)
    expect(b.workspaces.archiveCalls).toEqual([idle])

    b.workspaces.onArchive = () => Promise.reject(new Error('archive rejected'))
    await expect(b.uiWorkspace.archiveSession(idle)).rejects.toThrow('archive rejected')
    expect(b.workspaces.archiveCalls).toEqual([idle, idle])
  })

  it('forwards unarchive commands and preserves failures', async () => {
    const idle = sid('idle')
    const b = bench()

    await b.uiWorkspace.unarchiveSession(idle)
    expect(b.workspaces.unarchiveCalls).toEqual([idle])

    b.workspaces.onUnarchive = () => Promise.reject(new Error('unarchive rejected'))
    await expect(b.uiWorkspace.unarchiveSession(idle)).rejects.toThrow('unarchive rejected')
    expect(b.workspaces.unarchiveCalls).toEqual([idle, idle])
  })

  it('passes directory operations to the Host and preserves structured browse failures', async () => {
    const b = bench()
    b.directoryPicker.onPick = () => Promise.resolve({ ok: true, value: '/w/alpha' })
    await expect(b.uiWorkspace.pickDirectory()).resolves.toBe('/w/alpha')
    b.directoryPicker.onPick = () => Promise.resolve({ ok: true, value: null })
    await expect(b.uiWorkspace.pickDirectory()).resolves.toBeNull()
    expect(b.directoryPicker.callsOf('pick')).toEqual([{}, {}])

    await expect(b.uiWorkspace.listDirectory()).resolves.toEqual(listing)
    await expect(b.uiWorkspace.listDirectory('/home/u')).resolves.toEqual(listing)
    expect(b.directoryPicker.callsOf('list')).toEqual([{ path: undefined }, { path: '/home/u' }])
    await expect(b.uiWorkspace.createDirectory('/home/u', 'new')).resolves.toBe('/home/u/new')
    expect(b.directoryPicker.callsOf('createDirectory')).toEqual([{ path: '/home/u', name: 'new' }])
    b.directoryPicker.onPick = () => Promise.resolve({
      ok: false, error: new RemoteError('gateway/internal', 'no chooser', {}),
    })
    await expect(b.uiWorkspace.pickDirectory()).rejects.toThrow('directory picker failed: no chooser')
    b.directoryPicker.onList = () => Promise.resolve({
      ok: false, error: new RemoteError('directory-picker/unreadable', 'denied', { path: '/private' }),
    })
    const listFailure = b.uiWorkspace.listDirectory('/private')
    await expect(listFailure).rejects.toBeInstanceOf(DirectoryBrowseError)
    await expect(listFailure).rejects.toMatchObject({ rpcError: { code: 'directory-picker/unreadable' } })
    b.directoryPicker.onCreateDirectory = () => Promise.resolve({
      ok: false, error: new RemoteError('directory-picker/exists', 'taken', { path: '/home/u/new' }),
    })
    await expect(b.uiWorkspace.createDirectory('/home/u', 'new')).rejects.toMatchObject({
      rpcError: { code: 'directory-picker/exists' },
    })
  })
})
