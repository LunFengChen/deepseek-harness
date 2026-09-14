// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PluginInventorySettingsTab } from '../src/client/PluginInventorySettingsTab.tsx'
import type {
  PluginInventorySettingsTabInjected,
  PluginInventorySettingsTabProps,
} from '../src/client/PluginInventorySettingsTab.tsx'
import { en, type PluginInventoryLocaleKey } from '../src/client/locales.ts'

afterEach(cleanup)

type Snapshot = Awaited<ReturnType<PluginInventorySettingsTabInjected['list']>>
const t = ((key: PluginInventoryLocaleKey, params?: Record<string, string>): string =>
  Object.entries(params ?? {}).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, value),
    en[key],
  )) as PluginInventorySettingsTabProps['t']

function props(
  list: PluginInventorySettingsTabInjected['list'],
  presetName: PluginInventorySettingsTabInjected['presetName'] = preset => preset.name ?? preset.id,
  setEnabled: PluginInventorySettingsTabInjected['setEnabled'] = async request => ({ enabled: request.enabled }),
  surface: PluginInventorySettingsTabInjected['surface'] = 'inventory',
): PluginInventorySettingsTabProps {
  return {
    t,
    list,
    setEnabled,
    presetName,
    surface,
  } as PluginInventorySettingsTabProps
}

/** A deployment with a roster: one failed global row, two preset-provided rows. */
const SNAPSHOT = {
  entries: [
    { entryId: 'telemetry', moduleName: '@fixture/telemetry', enabled: true, fiberPhase: 'failed' },
    { entryId: 'timer', moduleName: 'cordis:timer', enabled: true, fiberPhase: 'active' },
    { entryId: '8a1b2c3d', moduleName: '@deepseek-ai/cordis-plugin-hmr', enabled: true, fiberPhase: 'active' },
    { entryId: 'unobserved', moduleName: '@fixture/unobserved-name', enabled: true, fiberPhase: null },
    { entryId: 'bash-host', moduleName: '@x1a0f3n9/dsh-tool-bash', enabled: false, fiberPhase: null },
    { entryId: 'fs-host', moduleName: '@x1a0f3n9/dsh-tool-fs', enabled: false, fiberPhase: null },
    { entryId: 'dormant', moduleName: '@fixture/dormant', enabled: false, fiberPhase: null },
  ],
  agentPresets: [
    {
      id: 'standard',
      trust: 'system',
      name: '标准模式',
      isDefault: true,
      rows: [
        { entryId: 'bash', moduleName: '@x1a0f3n9/dsh-tool-bash', enabled: true, fiberPhase: 'active' },
        { entryId: 'fs', moduleName: '@x1a0f3n9/dsh-tool-fs', enabled: true, fiberPhase: null },
        {
          entryId: 'pwsh',
          moduleName: '@fixture/pwsh',
          enabled: 'conditional',
          condition: 'process.platform === \'win32\'',
          fiberPhase: null,
        },
        { entryId: 'codex', moduleName: '@fixture/codex', enabled: false, fiberPhase: null },
        { entryId: 'crashy', moduleName: '@fixture/crashy', enabled: true, fiberPhase: 'failed' },
        { entryId: null, moduleName: '@fixture/anonymous', enabled: true, fiberPhase: null },
      ],
    },
    {
      id: 'ptc',
      trust: 'system',
      isDefault: false,
      rows: [
        { entryId: 'bash', moduleName: '@x1a0f3n9/dsh-tool-bash', enabled: true, fiberPhase: null },
        { entryId: 'bash-fork', moduleName: '@x1a0f3n9/dsh-tool-bash', enabled: true, fiberPhase: null },
        { entryId: 'fs', moduleName: '@x1a0f3n9/dsh-tool-fs', enabled: 'conditional', fiberPhase: null },
      ],
    },
    { id: 'shattered', trust: 'user', name: '坏预设', isDefault: false, broken: 'the composition file is missing', rows: [] },
  ],
} as unknown as Snapshot

async function renderReady(snapshot: Snapshot = SNAPSHOT): Promise<ReturnType<typeof render>> {
  const view = render(<PluginInventorySettingsTab {...props(async () => snapshot)} />)
  await screen.findByRole('searchbox', { name: en.search })
  return view
}

const globalToggle = (): HTMLElement =>
  screen.getByRole('button', { name: (name: string) => name.startsWith(en.globalTitle) })

describe('PluginInventorySettingsTab', () => {
  it('shows xfdsh preset plugins and persists a toggle', async () => {
    const setEnabled = vi.fn().mockResolvedValue({ enabled: false })
    render(<PluginInventorySettingsTab {...props(async () => ({
      entries: [],
      catalog: [{
        id: 'schedule',
        entryId: 'schedule-entry',
        packageName: '@x1a0f3n9/dsh-client-ui-schedule',
        version: '2.4.1',
        title: 'Schedule',
        description: 'Schedule management UI and runtime',
        author: 'vectorize-io',
        homepage: 'https://github.com/vectorize-io/hindsight/tree/main/hindsight-integrations/coding-agents',
        required: false,
        defaultEnabled: true,
        installed: true,
        enabled: true,
      }, {
        id: 'other',
        entryId: 'other-entry',
        packageName: 'other-plugin',
        required: false,
        defaultEnabled: true,
        installed: true,
        enabled: true,
      }],
    } as unknown as Snapshot), undefined, setEnabled, 'catalog')} />)
    await screen.findByRole('searchbox', { name: en.search })
    expect(screen.getByText(en.catalogVersion.replace('{version}', '2.4.1'))).toBeTruthy()
    const homepage = 'https://github.com/vectorize-io/hindsight/tree/main/hindsight-integrations/coding-agents'
    const pkg = screen.getByRole('link', { name: en.openPackageGithub.replace('{name}', '@x1a0f3n9/dsh-client-ui-schedule') })
    expect(pkg.getAttribute('href')).toBe(homepage)
    expect(pkg.getAttribute('target')).toBe('_blank')
    expect(pkg.textContent).toBe('@x1a0f3n9/dsh-client-ui-schedule')
    expect(screen.queryByText('vectorize-io')).toBeNull()
    expect(screen.queryByText('vectorize-io/hindsight')).toBeNull()
    expect(screen.getAllByRole('link')).toHaveLength(1)
    expect(pkg.getAttribute('href') ?? '').not.toContain('npmjs.com')
    const toggle = screen.getByRole('switch', { name: en.disablePlugin.replace('{name}', 'Schedule') })
    expect(toggle.getAttribute('aria-checked')).toBe('true')
    fireEvent.click(toggle)
    await waitFor(() => expect(setEnabled).toHaveBeenCalledWith({ entryId: 'schedule-entry', enabled: false }))
  })

  it('keeps a package name as text when the catalog omits homepage', async () => {
    render(<PluginInventorySettingsTab {...props(async () => ({
      entries: [],
      catalog: [{
        id: 'timeline',
        entryId: 'dsh-session-timeline',
        packageName: '@x1a0f3n9/dsh-session-timeline',
        title: 'Session timeline',
        author: 'LunFengChen',
        required: false,
        defaultEnabled: true,
        installed: true,
        enabled: true,
      }],
    } as unknown as Snapshot), undefined, undefined, 'catalog')} />)
    await screen.findByRole('searchbox', { name: en.search })
    expect(screen.getByText('@x1a0f3n9/dsh-session-timeline').closest('a')).toBeNull()
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.queryByText('LunFengChen')).toBeNull()
  })

  it('links the package name when homepage is GitHub without an owner/repo path', async () => {
    render(<PluginInventorySettingsTab {...props(async () => ({
      entries: [],
      catalog: [{
        id: 'market',
        entryId: 'dsh-market',
        packageName: 'dshmarket',
        title: 'Plugin market',
        author: 'LunFengChen',
        homepage: 'https://github.com/LunFengChen',
        required: false,
        defaultEnabled: true,
        installed: true,
        enabled: true,
      }],
    } as unknown as Snapshot), undefined, undefined, 'catalog')} />)
    await screen.findByRole('searchbox', { name: en.search })
    const pkg = screen.getByRole('link', { name: en.openPackageGithub.replace('{name}', 'dshmarket') })
    expect(pkg.getAttribute('href')).toBe('https://github.com/LunFengChen')
    expect(pkg.textContent).toBe('dshmarket')
    expect(screen.queryByText('LunFengChen')).toBeNull()
    expect(screen.getAllByRole('link')).toHaveLength(1)
  })

  it('filters catalog cards by GitHub owner/repo', async () => {
    render(<PluginInventorySettingsTab {...props(async () => ({
      entries: [],
      catalog: [{
        id: 'context',
        entryId: 'dsh-context',
        packageName: 'dsh-context',
        title: 'Context dashboard',
        author: 'LunFengChen',
        homepage: 'https://github.com/LunFengChen/dsh-context',
        required: false,
        defaultEnabled: true,
        installed: true,
        enabled: true,
      }, {
        id: 'sidebar',
        entryId: 'better-sidebar',
        packageName: 'dsh-better-sidebar',
        title: 'Better sidebar',
        author: 'LunFengChen',
        homepage: 'https://github.com/LunFengChen/DSH-better-sidebar',
        required: false,
        defaultEnabled: true,
        installed: true,
        enabled: true,
      }],
    } as unknown as Snapshot), undefined, undefined, 'catalog')} />)
    await screen.findByRole('searchbox', { name: en.search })
    fireEvent.change(screen.getByRole('searchbox', { name: en.search }), { target: { value: 'LunFengChen/dsh-context' } })
    expect(screen.getByText('Context dashboard')).toBeTruthy()
    expect(screen.getByRole('link', { name: en.openPackageGithub.replace('{name}', 'dsh-context') })).toBeTruthy()
    expect(screen.queryByText('Better sidebar')).toBeNull()
    expect(screen.queryByText('LunFengChen/dsh-context')).toBeNull()
  })

  it('links declared homepages without inventing npmjs URLs', async () => {
    render(<PluginInventorySettingsTab {...props(async () => ({
      entries: [],
      catalog: [
        {
          id: 'empty',
          entryId: 'empty',
          packageName: 'empty-home',
          title: 'Empty homepage',
          author: 'EmptyAuthor',
          homepage: '',
          required: false,
          defaultEnabled: true,
          installed: true,
          enabled: true,
        },
        {
          id: 'invalid',
          entryId: 'invalid',
          packageName: 'invalid-home',
          title: 'Invalid homepage',
          author: 'InvalidAuthor',
          homepage: 'not a url',
          required: false,
          defaultEnabled: true,
          installed: true,
          enabled: true,
        },
        {
          id: 'other',
          entryId: 'other',
          packageName: 'other-host',
          title: 'Other host',
          author: 'OtherAuthor',
          homepage: 'https://example.com/acme/plugin',
          required: false,
          defaultEnabled: true,
          installed: true,
          enabled: true,
        },
        {
          id: 'www',
          entryId: 'www',
          packageName: 'www-git',
          title: 'WWW git',
          author: 'WwwAuthor',
          homepage: 'https://www.github.com/LunFengChen/dsh-market.git',
          required: false,
          defaultEnabled: true,
          installed: true,
          enabled: true,
        },
        {
          id: 'dotgit',
          entryId: 'dotgit',
          packageName: 'dot-git-home',
          title: 'Dot git homepage',
          author: 'DotGitAuthor',
          homepage: 'https://github.com/LunFengChen/.git',
          required: false,
          defaultEnabled: true,
          installed: true,
          enabled: true,
        },
      ],
    } as unknown as Snapshot), undefined, undefined, 'catalog')} />)
    await screen.findByRole('searchbox', { name: en.search })
    expect(screen.getByText('empty-home').closest('a')).toBeNull()
    expect(screen.queryByText('EmptyAuthor')).toBeNull()
    expect(screen.getByRole('link', { name: en.openPackageGithub.replace('{name}', 'invalid-home') }).getAttribute('href')).toBe('not a url')
    expect(screen.getByRole('link', { name: en.openPackageGithub.replace('{name}', 'other-host') }).getAttribute('href')).toBe('https://example.com/acme/plugin')
    const www = screen.getByRole('link', { name: en.openPackageGithub.replace('{name}', 'www-git') })
    expect(www.getAttribute('href')).toBe('https://www.github.com/LunFengChen/dsh-market.git')
    expect(www.textContent).toBe('www-git')
    expect(screen.queryByText('LunFengChen/dsh-market')).toBeNull()
    const dotgit = screen.getByRole('link', { name: en.openPackageGithub.replace('{name}', 'dot-git-home') })
    expect(dotgit.getAttribute('href')).toBe('https://github.com/LunFengChen/.git')
    expect(screen.queryByText('DotGitAuthor')).toBeNull()
    for (const link of screen.getAllByRole('link')) {
      expect(link.getAttribute('href') ?? '').not.toContain('npmjs.com')
    }
    fireEvent.change(screen.getByRole('searchbox', { name: en.search }), { target: { value: 'LunFengChen/dsh-market' } })
    expect(screen.getByText('WWW git')).toBeTruthy()
    expect(screen.queryByText('Empty homepage')).toBeNull()
    expect(screen.queryByText('Dot git homepage')).toBeNull()
  })

  it('hides catalog cards when search matches none of them', async () => {
    render(<PluginInventorySettingsTab {...props(async () => ({
      entries: [],
      catalog: [{
        id: 'timeline',
        entryId: 'dsh-session-timeline',
        packageName: '@x1a0f3n9/dsh-session-timeline',
        title: 'Session timeline',
        author: 'LunFengChen',
        homepage: 'https://github.com/LunFengChen/deepseek-harness',
        required: false,
        defaultEnabled: true,
        installed: true,
        enabled: true,
      }],
    } as unknown as Snapshot), undefined, undefined, 'catalog')} />)
    await screen.findByRole('searchbox', { name: en.search })
    fireEvent.change(screen.getByRole('searchbox', { name: en.search }), { target: { value: 'no-such-plugin' } })
    expect(screen.getByText(en.emptySearch)).toBeTruthy()
    expect(screen.queryByText('Session timeline')).toBeNull()
  })

  it('ignores clicks on required catalog plugins and plugins already saving', async () => {
    const setEnabled = vi.fn().mockImplementation(() => new Promise(() => {}))
    render(<PluginInventorySettingsTab {...props(async () => ({
      entries: [],
      catalog: [{
        id: 'required',
        entryId: 'required-entry',
        packageName: 'required-plugin',
        title: 'Required plugin',
        required: true,
        defaultEnabled: true,
        installed: true,
        enabled: true,
      }, {
        id: 'saving',
        entryId: 'saving-entry',
        packageName: 'saving-plugin',
        title: 'Saving plugin',
        required: false,
        defaultEnabled: true,
        installed: true,
        enabled: true,
      }, {
        id: 'other',
        entryId: 'other-entry',
        packageName: 'other-plugin',
        title: 'Other plugin',
        required: false,
        defaultEnabled: true,
        installed: true,
        enabled: true,
      }],
    } as unknown as Snapshot), undefined, setEnabled, 'catalog')} />)
    await screen.findByRole('searchbox', { name: en.search })
    fireEvent.click(screen.getByRole('switch', { name: en.disablePlugin.replace('{name}', 'Saving plugin') }))
    await waitFor(() => expect(setEnabled).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('switch', { name: en.disablePlugin.replace('{name}', 'Other plugin') }))
    expect(setEnabled).toHaveBeenCalledTimes(1)
  })

  it('keeps a homepage link without an author byline when GitHub has no owner/repo', async () => {
    render(<PluginInventorySettingsTab {...props(async () => ({
      entries: [],
      catalog: [{
        id: 'orphan',
        entryId: 'orphan-entry',
        packageName: 'orphan-plugin',
        title: 'Orphan plugin',
        homepage: 'https://github.com/LunFengChen/.git',
        required: false,
        defaultEnabled: true,
        installed: true,
        enabled: true,
      }],
    } as unknown as Snapshot), undefined, undefined, 'catalog')} />)
    await screen.findByRole('searchbox', { name: en.search })
    expect(screen.getByRole('link', { name: en.openPackageGithub.replace('{name}', 'orphan-plugin') }).getAttribute('href')).toBe(
      'https://github.com/LunFengChen/.git',
    )
    expect(screen.queryByRole('link', { name: en.openPackageGithub.replace('{name}', 'LunFengChen/.git') })).toBeNull()
    expect(screen.queryByText('LunFengChen')).toBeNull()
  })

  it('shows the host error when a catalog toggle fails', async () => {
    const setEnabled = vi.fn().mockRejectedValue(new Error('prebundled plugin "dsh-context" is not installed'))
    render(<PluginInventorySettingsTab {...props(async () => ({
      entries: [],
      catalog: [{
        id: 'context',
        entryId: 'dsh-context',
        packageName: 'dsh-context',
        title: 'Context dashboard',
        required: false,
        defaultEnabled: true,
        installed: false,
        enabled: false,
      }],
    } as unknown as Snapshot), undefined, setEnabled, 'catalog')} />)
    await screen.findByRole('searchbox', { name: en.search })
    fireEvent.click(screen.getByRole('switch', { name: en.enablePlugin.replace('{name}', 'Context dashboard') }))
    expect((await screen.findByRole('alert')).textContent).toBe(
      en.updateError.replace('{message}', 'prebundled plugin "dsh-context" is not installed'),
    )
  })

  it('falls back to a generic catalog update error when the host throws a non-Error', async () => {
    const setEnabled = vi.fn()
      .mockRejectedValueOnce('')
      .mockRejectedValueOnce({ reason: 'bare' })
    render(<PluginInventorySettingsTab {...props(async () => ({
      entries: [],
      catalog: [{
        id: 'context',
        entryId: 'dsh-context',
        packageName: 'dsh-context',
        title: 'Context dashboard',
        required: false,
        defaultEnabled: true,
        installed: true,
        enabled: false,
      }],
    } as unknown as Snapshot), undefined, setEnabled, 'catalog')} />)
    await screen.findByRole('searchbox', { name: en.search })
    fireEvent.click(screen.getByRole('switch', { name: en.enablePlugin.replace('{name}', 'Context dashboard') }))
    expect((await screen.findByRole('alert')).textContent).toBe(en.updateError.replace('{message}', 'dsh-context'))
    fireEvent.click(screen.getByRole('switch', { name: en.enablePlugin.replace('{name}', 'Context dashboard') }))
    expect((await screen.findByRole('alert')).textContent).toBe(
      en.updateError.replace('{message}', '[object Object]'),
    )
  })

  it('ignores a catalog toggle result after the snapshot is no longer ready', async () => {
    const deferred = Promise.withResolvers<{ enabled: boolean }>()
    const snapshot = {
      entries: [],
      catalog: [{
        id: 'schedule',
        entryId: 'schedule-entry',
        packageName: '@x1a0f3n9/dsh-client-ui-schedule',
        title: 'Schedule',
        required: false,
        defaultEnabled: true,
        installed: true,
        enabled: true,
      }],
    } as unknown as Snapshot
    const setEnabled = vi.fn().mockReturnValue(deferred.promise)
    const view = render(<PluginInventorySettingsTab {...props(async () => snapshot, undefined, setEnabled, 'catalog')} />)
    await screen.findByRole('searchbox', { name: en.search })
    fireEvent.click(screen.getByRole('switch', { name: en.disablePlugin.replace('{name}', 'Schedule') }))
    await waitFor(() => expect(setEnabled).toHaveBeenCalledTimes(1))
    view.rerender(<PluginInventorySettingsTab {...props(async () => {
      throw new Error('inventory closed')
    }, undefined, setEnabled, 'catalog')} />)
    expect((await screen.findByRole('alert')).textContent).toBe(en.error)
    await act(async () => { deferred.resolve({ enabled: false }) })
    expect(screen.getByRole('alert').textContent).toBe(en.error)
  })

  it('keeps prebundled plugins off the plugin list', async () => {
    await renderReady({
      entries: [
        { entryId: 'dsh-session-timeline', moduleName: '@x1a0f3n9/dsh-session-timeline', enabled: true, fiberPhase: 'active' },
        { entryId: 'include-web:dsh-context', moduleName: 'other-context-module', enabled: true, fiberPhase: 'active' },
        { entryId: 'dsh-market', moduleName: 'not-the-market-package', enabled: true, fiberPhase: 'active' },
        { entryId: 'hmr', moduleName: '@deepseek-ai/cordis-plugin-hmr', enabled: true, fiberPhase: 'active' },
      ],
      catalog: [
        {
          id: 'timeline',
          entryId: 'dsh-session-timeline',
          packageName: '@x1a0f3n9/dsh-session-timeline',
          title: 'Session timeline',
          required: false,
          defaultEnabled: true,
          installed: true,
          enabled: true,
        },
        {
          id: 'context',
          entryId: 'dsh-context',
          packageName: 'dsh-context',
          title: 'Context dashboard',
          required: false,
          defaultEnabled: true,
          installed: true,
          enabled: true,
        },
        {
          id: 'market',
          entryId: 'dsh-market',
          packageName: 'dshmarket',
          title: 'Plugin market',
          required: false,
          defaultEnabled: true,
          installed: true,
          enabled: true,
        },
      ],
    } as unknown as Snapshot)

    expect(screen.queryByText(en.catalogTitle)).toBeNull()
    expect(screen.queryByText('Session timeline')).toBeNull()
    expect(screen.queryByText('Context dashboard')).toBeNull()
    expect(screen.queryByText('Plugin market')).toBeNull()
    expect(screen.queryByText('@x1a0f3n9/dsh-session-timeline')).toBeNull()
    expect(screen.getByText('hmr')).toBeTruthy()
    expect(screen.queryByText('other-context-module')).toBeNull()
    expect(screen.queryByText('not-the-market-package')).toBeNull()
  })

  it('renders xfdsh preset plugins without the session or global inventory', async () => {
    render(<PluginInventorySettingsTab {...props(async () => ({
      entries: [
        { entryId: 'hmr', moduleName: '@deepseek-ai/cordis-plugin-hmr', enabled: true, fiberPhase: 'active' },
      ],
      agentPresets: [{
        id: 'solo',
        trust: 'user',
        isDefault: false,
        rows: [{ entryId: 'one', moduleName: '@fixture/one', enabled: true, fiberPhase: null }],
      }],
      catalog: [{
        id: 'timeline',
        entryId: 'dsh-session-timeline',
        packageName: '@x1a0f3n9/dsh-session-timeline',
        title: 'Session timeline',
        required: false,
        defaultEnabled: true,
        installed: true,
        enabled: true,
      }],
    } as unknown as Snapshot), undefined, undefined, 'catalog')} />)
    await screen.findByRole('searchbox', { name: en.search })
    expect(screen.getByText(en.catalogTitle)).toBeTruthy()
    expect(screen.getByText('Session timeline')).toBeTruthy()
    expect(screen.queryByText(en.globalTitle)).toBeNull()
    expect(screen.queryByText(en.presetTitle)).toBeNull()
    expect(screen.queryByText('hmr')).toBeNull()
  })

  it('hides the xfdsh preset section when the catalog is empty', async () => {
    render(<PluginInventorySettingsTab {...props(async () => ({
      entries: [
        { entryId: 'hmr', moduleName: '@deepseek-ai/cordis-plugin-hmr', enabled: true, fiberPhase: 'active' },
      ],
      catalog: [],
    } as unknown as Snapshot), undefined, undefined, 'catalog')} />)
    await screen.findByRole('searchbox', { name: en.search })
    expect(screen.getByText(en.empty)).toBeTruthy()
    expect(screen.queryByText(en.catalogTitle)).toBeNull()
    expect(screen.queryByText('hmr')).toBeNull()
  })

  it('shows the default preset first and keeps the global plane collapsed', async () => {
    const view = await renderReady()

    const switcher = screen.getByRole('button', { name: en.switcherLabel })
    expect(switcher.textContent).toBe('标准模式 (default)')
    fireEvent.click(switcher)
    expect(screen.getAllByRole('menuitem').map(item => item.textContent)).toEqual([
      '标准模式 (default)',
      'ptc',
      '坏预设 (failed to load)',
    ])
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryAllByRole('menuitem')).toHaveLength(0)
    expect(screen.getByText(en.presetSubtitle)).toBeTruthy()
    expect(view.container.querySelector('[data-preset-plugin-count]')?.getAttribute('data-preset-plugin-count')).toBe('6')

    // Only the preset group lists rows while the global plane stays collapsed.
    expect(screen.getAllByRole('listitem')).toHaveLength(6)
    expect(screen.getAllByText(en.enabledTag)).toHaveLength(3)
    expect(screen.getByText(en.conditionalTag)).toBeTruthy()
    expect(screen.getByText(en.disabledTag)).toBeTruthy()
    expect(screen.getByText(en.failedTag)).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Running' })).toBeTruthy()
    // No live fiber, no dot: file-state rows carry only their enablement tag.
    expect(screen.queryByRole('img', { name: 'Not running' })).toBeNull()

    expect(globalToggle().getAttribute('aria-expanded')).toBe('false')
    expect(view.container.querySelector('[data-plugin-count]')?.getAttribute('data-plugin-count')).toBe('7')
    expect(screen.getByText(`1 ${en.failedCountLabel}`)).toBeTruthy()

    // A preset row expands into its provenance facts.
    fireEvent.click(screen.getByRole('button', { name: 'pwsh, Conditional' }))
    expect(screen.getByText(en.fromPreset)).toBeTruthy()
    expect(screen.getByText('标准模式')).toBeTruthy()
    expect(screen.getByText(en.condition)).toBeTruthy()
    expect(screen.getByText('process.platform === \'win32\'')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'pwsh, Conditional' }))
    expect(screen.queryByText(en.condition)).toBeNull()

    // A failed preset row names its runtime state instead of a condition.
    fireEvent.click(screen.getByRole('button', { name: 'crashy, Failed' }))
    expect(screen.getByText(en.runtime)).toBeTruthy()
    expect(screen.getByText('Failed to start')).toBeTruthy()

    // A row declaring no id has no Loader identity line, only its module.
    fireEvent.click(screen.getByRole('button', { name: 'anonymous, Enabled' }))
    expect(view.container.querySelector('[data-loader-entry]')).toBeNull()
    expect(screen.getByText(en.moduleLabel).nextElementSibling?.textContent).toBe('@fixture/anonymous')
  })

  it('expands the global plane with failures first and preset-provided rows inline', async () => {
    const view = await renderReady()

    expect(screen.queryByText(en.presetEnabledTag)).toBeNull()
    fireEvent.click(globalToggle())
    expect(globalToggle().getAttribute('aria-expanded')).toBe('true')
    const failed = view.container.querySelector('[data-plugin-scope="global"] [data-failed="true"]')
    expect(failed?.getAttribute('data-plugin-entry')).toBe('telemetry')
    // Failures float above the Loader-ordered remainder.
    expect(view.container.querySelector('[data-plugin-scope="global"] li')).toBe(failed)

    // Rows the presets took over sit inline, marked instead of plainly disabled.
    expect(screen.getAllByText(en.presetEnabledTag)).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: 'tool-bash, Enabled via presets' }))
    expect(screen.getByText(en.presetProvidedDetail)).toBeTruthy()
    expect(screen.getByText(en.enabledIn)).toBeTruthy()
    expect(screen.getByText('标准模式 · ptc')).toBeTruthy()

    // The failed global card reports its runtime state.
    fireEvent.click(screen.getByRole('button', { name: 'telemetry, Failed' }))
    expect(screen.getByText('Failed to start')).toBeTruthy()

    // An enabled entry with no live fiber says so in its details, dot-free.
    fireEvent.click(screen.getByRole('button', { name: 'unobserved-name, Enabled' }))
    expect(screen.getByText('Not running')).toBeTruthy()

    // A disabled row outside every preset stays plainly disabled.
    fireEvent.click(screen.getByRole('button', { name: 'dormant, Disabled' }))
    expect(screen.queryByText(en.presetProvidedDetail)).toBeNull()

    fireEvent.click(globalToggle())
    expect(globalToggle().getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText(en.presetEnabledTag)).toBeNull()
  })

  it('switches the inspected preset in place, including broken ones', async () => {
    const view = await renderReady()
    const pickPreset = (label: string): void => {
      fireEvent.click(screen.getByRole('button', { name: en.switcherLabel }))
      fireEvent.click(screen.getByRole('menuitem', { name: label }))
    }

    pickPreset('ptc')
    expect(view.container.querySelector('[data-preset-plugin-count]')?.getAttribute('data-preset-plugin-count')).toBe('3')
    fireEvent.click(screen.getAllByRole('button', { name: 'tool-bash, Enabled' })[0]!)
    // An unnamed preset labels provenance by its id.
    expect(screen.getByText(en.fromPreset).nextElementSibling?.textContent).toBe('ptc')

    pickPreset('坏预设 (failed to load)')
    expect(screen.getByRole('alert').textContent).toBe('the composition file is missing')
    expect(view.container.querySelector('[data-preset-plugin-count]')?.getAttribute('data-preset-plugin-count')).toBe('0')
  })

  it('collapses the preset group until a search forces it open', async () => {
    const view = await renderReady()
    const toggle = screen.getByRole('button', { name: en.presetTitle })

    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    // The header keeps its count while the rows are folded away.
    expect(view.container.querySelector('[data-preset-plugin-count]')?.getAttribute('data-preset-plugin-count')).toBe('6')
    expect(view.container.querySelectorAll('[data-plugin-scope="preset"] li')).toHaveLength(0)

    fireEvent.change(screen.getByRole('searchbox', { name: en.search }), { target: { value: 'pwsh' } })
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText(en.conditionalTag)).toBeTruthy()

    fireEvent.change(screen.getByRole('searchbox', { name: en.search }), { target: { value: '' } })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
  })

  it('routes every preset name through the display resolver', async () => {
    // The resolver stands in for presetDisplayText: shipped presets localize,
    // user-authored ones keep their own metadata.
    const localized: PluginInventorySettingsTabInjected['presetName'] = preset =>
      preset.trust === 'system' ? `Localized ${preset.id}` : preset.name ?? preset.id
    render(<PluginInventorySettingsTab {...props(async () => SNAPSHOT, localized)} />)
    await screen.findByRole('searchbox', { name: en.search })

    const switcher = screen.getByRole('button', { name: en.switcherLabel })
    expect(switcher.textContent).toBe('Localized standard (default)')
    fireEvent.click(switcher)
    expect(screen.getAllByRole('menuitem').map(item => item.textContent)).toEqual([
      'Localized standard (default)',
      'Localized ptc',
      '坏预设 (failed to load)',
    ])
    fireEvent.keyDown(document, { key: 'Escape' })

    fireEvent.click(screen.getByRole('button', { name: 'pwsh, Conditional' }))
    expect(screen.getByText(en.fromPreset).nextElementSibling?.textContent).toBe('Localized standard')

    fireEvent.click(globalToggle())
    fireEvent.click(screen.getByRole('button', { name: 'tool-bash, Enabled via presets' }))
    expect(screen.getByText('Localized standard · Localized ptc')).toBeTruthy()
  })

  it('jumps from a preset-provided row to the preset that enables it', async () => {
    await renderReady()
    fireEvent.click(screen.getByRole('button', { name: en.switcherLabel }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'ptc' }))

    fireEvent.click(globalToggle())
    fireEvent.click(screen.getByRole('button', { name: 'tool-bash, Enabled via presets' }))
    fireEvent.click(screen.getByRole('button', { name: en.viewInPreset }))
    expect(screen.getByRole('button', { name: en.switcherLabel }).textContent)
      .toBe('标准模式 (default)')
  })

  it('searches across scopes and points at matches in other presets', async () => {
    const view = await renderReady()
    const search = screen.getByRole('searchbox', { name: en.search })

    fireEvent.change(search, { target: { value: 'tool-bash' } })
    // Searching forces the collapsed global plane and drawer open.
    expect(view.container.querySelector('[data-preset-plugin-count]')?.getAttribute('data-preset-plugin-count')).toBe('1')
    expect(view.container.querySelector('[data-plugin-count]')?.getAttribute('data-plugin-count')).toBe('1')
    expect(screen.getByText(en.presetEnabledTag)).toBeTruthy()
    expect(screen.queryByText(`1 ${en.failedCountLabel}`)).toBeNull()
    const hint = screen.getByText((text: string) => text.startsWith('2 more matches'))
    expect(hint).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'ptc' }))
    expect(screen.getByRole('button', { name: en.switcherLabel }).textContent).toBe('ptc')

    // A match visible only in another preset keeps the pointer without rows.
    fireEvent.change(search, { target: { value: 'crashy' } })
    expect(view.container.querySelector('[data-preset-plugin-count]')?.getAttribute('data-preset-plugin-count')).toBe('0')
    expect(screen.getByText((text: string) => text.startsWith('1 more matches'))).toBeTruthy()
    expect(screen.queryByText(en.emptySearch)).toBeNull()

    // A match on a Loader entry id only reaches the global plane.
    fireEvent.change(search, { target: { value: '8a1b2c3d' } })
    expect(view.container.querySelector('[data-plugin-count]')?.getAttribute('data-plugin-count')).toBe('1')
    expect(screen.queryByText((text: string) => text.includes('more matches'))).toBeNull()

    fireEvent.change(search, { target: { value: 'not-a-plugin' } })
    expect(screen.getByText(en.emptySearch)).toBeTruthy()
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })

  it('renders a rosterless deployment as one expanded global list', async () => {
    const view = await renderReady({
      entries: [
        { entryId: 'hmr', moduleName: '@deepseek-ai/cordis-plugin-hmr', enabled: true, fiberPhase: 'active' },
        { entryId: 'off', moduleName: '@fixture/off', enabled: false, fiberPhase: null },
      ],
    } as unknown as Snapshot)

    expect(screen.queryByRole('button', { name: en.switcherLabel })).toBeNull()
    expect(globalToggle().getAttribute('aria-expanded')).toBe('true')
    expect(screen.getAllByRole('listitem')).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: 'hmr, Enabled' }))
    expect(screen.getByText(en.runtime)).toBeTruthy()
    expect(view.container.querySelector('[data-loader-entry]')?.textContent).toBe('hmr')
    fireEvent.click(screen.getByRole('button', { name: 'off, Disabled' }))
    expect(screen.getAllByText(en.moduleLabel).length).toBeGreaterThan(0)
    expect(screen.queryByText(en.runtime)).toBeNull()
  })

  it('renders a preset-only snapshot without the global section', async () => {
    await renderReady({
      entries: [],
      agentPresets: [{
        id: 'solo',
        trust: 'user',
        isDefault: false,
        rows: [{ entryId: 'one', moduleName: '@fixture/one', enabled: true, fiberPhase: null }],
      }],
    })

    expect(screen.queryByRole('button', { name: (name: string) => name.startsWith(en.globalTitle) })).toBeNull()
    expect(screen.queryByText(en.empty)).toBeNull()
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })

  it('shows a generic failure and retries into the empty state', async () => {
    const list = vi.fn<PluginInventorySettingsTabInjected['list']>()
      .mockRejectedValueOnce(new Error('private transport detail'))
      .mockResolvedValueOnce({ entries: [] })
    render(<PluginInventorySettingsTab {...props(list)} />)

    expect((await screen.findByRole('alert')).textContent).toBe(en.error)
    expect(screen.queryByText('private transport detail')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: en.retry }))
    await waitFor(() => { expect(list).toHaveBeenCalledTimes(2) })
    expect(await screen.findByText(en.empty)).toBeTruthy()
  })

  it('contains a synchronous Remote failure and ignores a result after unmount', async () => {
    const syncFailure = vi.fn(() => { throw new Error('namespace unavailable') }) as PluginInventorySettingsTabInjected['list']
    const failed = render(<PluginInventorySettingsTab {...props(syncFailure)} />)
    expect((await screen.findByRole('alert')).textContent).toBe(en.error)
    failed.unmount()

    const deferred = Promise.withResolvers<Snapshot>()
    const pending = render(<PluginInventorySettingsTab {...props(() => deferred.promise)} />)
    expect(screen.getByText(en.loading)).toBeTruthy()
    pending.unmount()
    await act(async () => { deferred.resolve(SNAPSHOT) })

    const deferredFailure = Promise.withResolvers<Snapshot>()
    const pendingFailure = render(<PluginInventorySettingsTab {...props(() => deferredFailure.promise)} />)
    pendingFailure.unmount()
    await act(async () => { deferredFailure.reject(new Error('late failure')) })
  })
})
